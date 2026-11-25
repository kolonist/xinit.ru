"use strict";

const paintFont = '24px "JetBrains Mono", monospace';
const paintLineHeight = 34;
const defaultStrokeWeight = 3;
const defaultMarkerWeight = 16;
const lineStartArrow = 1;
const lineEndArrow = 2;

const blockArrowDefaults = { headBase: 0.6, headInset: 0, shaftInset: 0.25 };
const trapezoidDefaults = { topInset: 0.25 };
const calloutDefaults = { tailX: 0.3, tailY: 1.3 };
const parallelogramDefaults = { slant: 0.22 };
const maxParallelogramSlant = 0.48;
const shapeAdjustmentDefaults = new Map([
  ["blockArrow", blockArrowDefaults],
  ["trapezoid", trapezoidDefaults],
  ["callout", calloutDefaults],
  ["parallelogram", parallelogramDefaults],
]);
const arrowInsetGap = 0.06;

const polygonShapes = new Map([
  ["blockArrow", ({ headBase, headInset, shaftInset } = blockArrowDefaults) => [
    [0, shaftInset], [headBase, shaftInset], [headBase, headInset], [1, 0.5],
    [headBase, 1 - headInset], [headBase, 1 - shaftInset], [0, 1 - shaftInset],
  ]],
  ["triangle", () => [[0.5, 0], [1, 1], [0, 1]]],
  ["trapezoid", ({ topInset } = trapezoidDefaults) => [[topInset, 0], [1 - topInset, 0], [1, 1], [0, 1]]],
  ["hexagon", () => [[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]]],
  ["diamond", () => [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]],
  ["parallelogram", ({ slant } = parallelogramDefaults) => {
    const topInset = Math.max(0, slant);
    const bottomInset = Math.max(0, -slant);
    return [[topInset, 0], [1 - bottomInset, 0], [1 - topInset, 1], [bottomInset, 1]];
  }],
  ["callout", calloutOutline],
]);

// Curves use a 100 × 100 view box so resizing scales the outline and its details together.
const curvedShapes = new Map([
  ["cylinder", [
    "M0 15C0 6.72 22.39 0 50 0S100 6.72 100 15V85C100 93.28 77.61 100 50 100S0 93.28 0 85Z",
    "M0 15C0 23.28 22.39 30 50 30S100 23.28 100 15",
  ]],
  ["roundedRect", ["M15 0H85Q100 0 100 15V85Q100 100 85 100H15Q0 100 0 85V15Q0 0 15 0Z"]],
  ["cloud", [
    "M22 100C9 100 0 87 0 71C0 56 7 43 18 38C18 16 28 0 42 0C51 0 57 6 61 15" +
    "C66 8 73 6 80 12C89 18 93 31 92 45C97 50 100 59 100 70C100 87 91 100 78 100Z",
  ]],
]);
const shapeLibraryTypes = [...polygonShapes.keys(), ...curvedShapes.keys()];

function calloutOutline({ tailX, tailY } = calloutDefaults) {
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const dx = tailX - 0.5;
  const dy = tailY - 0.5;
  const distance = Math.max(Math.abs(dx), Math.abs(dy));
  if (distance <= 0.5) return corners;

  const side = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
  const [x, y] = corners[side];
  const [nextX, nextY] = corners[(side + 1) % corners.length];
  const along = ((nextX - x) * dx + (nextY - y) * dy) / (2 * distance);
  const center = Math.max(0.15, Math.min(0.85, 0.5 + along));
  const basePoint = fraction => [x + (nextX - x) * fraction, y + (nextY - y) * fraction];
  corners.splice(side + 1, 0, basePoint(center - 0.1), [tailX, tailY], basePoint(center + 0.1));
  return corners;
}

function rectangleBetween(from, to) {
  return {
    left: Math.min(from.x, to.x),
    top: Math.min(from.y, to.y),
    right: Math.max(from.x, to.x),
    bottom: Math.max(from.y, to.y),
  };
}

function objectMatrix({ angle = 0, scaleX, scaleY, shear = 0 }) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    a: cosine * scaleX,
    b: sine * scaleX,
    c: cosine * shear - sine * scaleY,
    d: sine * shear + cosine * scaleY,
  };
}

function objectToWorld(object, { x, y }) {
  const { a, b, c, d } = objectMatrix(object);
  return { x: object.x + a * x + c * y, y: object.y + b * x + d * y };
}

function worldToObject(object, point) {
  const { a, b, c, d } = objectMatrix(object);
  const x = point.x - object.x;
  const y = point.y - object.y;
  const determinant = a * d - b * c;
  return { x: (d * x - c * y) / determinant, y: (a * y - b * x) / determinant };
}

function worldBounds(object) {
  return transformedBounds(object.bounds, objectMatrix(object), object.x, object.y);
}

function transformedBounds({ left, top, right, bottom }, { a, b, c, d }, x, y) {
  return {
    left: x + Math.min(a * left, a * right) + Math.min(c * top, c * bottom),
    top: y + Math.min(b * left, b * right) + Math.min(d * top, d * bottom),
    right: x + Math.max(a * left, a * right) + Math.max(c * top, c * bottom),
    bottom: y + Math.max(b * left, b * right) + Math.max(d * top, d * bottom),
  };
}

function padBounds(bounds, padding) {
  return {
    left: bounds.left - padding,
    top: bounds.top - padding,
    right: bounds.right + padding,
    bottom: bounds.bottom + padding,
  };
}

function containsPoint(bounds, { x, y }) {
  return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
}

function distanceBetween(from, to) {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function snapSegmentEnd(anchor, point) {
  const step = Math.PI / 4;
  const angle = Math.atan2(point.y - anchor.y, point.x - anchor.x);
  const snapped = Math.round(angle / step) * step;
  const distance = distanceBetween(anchor, point);
  return { x: anchor.x + Math.cos(snapped) * distance, y: anchor.y + Math.sin(snapped) * distance };
}

function createObject(type, point, color) {
  return { type, x: point.x, y: point.y, color, scaleX: 1, scaleY: 1 };
}

function isFillableShape(type) {
  return type === "rect" || type === "circle" || shapeLibraryTypes.includes(type);
}

function isSegment(object) {
  return object?.type === "line";
}

function hasLineEnds(object) {
  return isSegment(object) || object?.type === "polyline";
}

function addLineArrows(object, points, bounds) {
  object.arrowhead = null;
  const ends = object.lineEnds ?? 0;
  if (!ends || points.length < 2) return bounds;
  const arrows = new Path2D();
  for (const [flag, tip, neighbor] of [
    [lineStartArrow, points[0], points[1]],
    [lineEndArrow, points.at(-1), points.at(-2)],
  ]) {
    if (!(ends & flag)) continue;
    const angle = Math.atan2(tip.y - neighbor.y, tip.x - neighbor.x);
    const size = Math.min(Math.max(20, object.weight * 3.5), distanceBetween(tip, neighbor) * 0.5);
    if (!size) continue;
    const [first, last] = [angle - Math.PI / 9, angle + Math.PI / 9].map(direction => ({
      x: tip.x - Math.cos(direction) * size,
      y: tip.y - Math.sin(direction) * size,
    }));
    arrows.moveTo(first.x, first.y);
    arrows.lineTo(tip.x, tip.y);
    arrows.lineTo(last.x, last.y);
    bounds.left = Math.min(bounds.left, first.x, last.x);
    bounds.top = Math.min(bounds.top, first.y, last.y);
    bounds.right = Math.max(bounds.right, first.x, last.x);
    bounds.bottom = Math.max(bounds.bottom, first.y, last.y);
  }
  object.arrowhead = arrows;
  return bounds;
}

function setPolylinePoints(object, points) {
  object.weight ??= defaultStrokeWeight;
  object.points = points;
  const path = new Path2D();
  const vertices = points.filter((point, index) => !index || distanceBetween(points[index - 1], point) > 0);
  const first = vertices[0];
  const bounds = rectangleBetween(first, first);
  path.moveTo(first.x, first.y);
  for (let index = 1; index < vertices.length; index++) {
    const point = vertices[index];
    const next = vertices[index + 1];
    bounds.left = Math.min(bounds.left, point.x);
    bounds.top = Math.min(bounds.top, point.y);
    bounds.right = Math.max(bounds.right, point.x);
    bounds.bottom = Math.max(bounds.bottom, point.y);
    if (!next) {
      path.lineTo(point.x, point.y);
      break;
    }
    const previous = vertices[index - 1];
    const before = distanceBetween(point, previous);
    const after = distanceBetween(point, next);
    const trim = Math.min(7, before / 4, after / 4);
    path.lineTo(point.x + (previous.x - point.x) * trim / before, point.y + (previous.y - point.y) * trim / before);
    path.quadraticCurveTo(point.x, point.y, point.x + (next.x - point.x) * trim / after,
      point.y + (next.y - point.y) * trim / after);
  }
  object.path = path;
  object.bounds = padBounds(addLineArrows(object, vertices, bounds), object.weight / 2);
}

function setLineEnds(object, ends) {
  object.lineEnds = ends;
  if (isSegment(object)) setShapeEnd(object, object.end);
  else setPolylinePoints(object, object.points);
}

function polygonShapePoints({ type, end, shapeAdjustments }) {
  const width = Math.abs(end.x);
  const height = Math.abs(end.y);
  const left = Math.min(0, end.x);
  const top = Math.min(0, end.y);
  const flip = type === "blockArrow" && end.x < 0;
  return polygonShapes.get(type)(shapeAdjustments).map(([x, y]) => ({
    x: left + (flip ? 1 - x : x) * width,
    y: top + y * height,
  }));
}

function shapeAdjustmentHandles(object) {
  if (!shapeAdjustmentDefaults.has(object?.type) || !object.end.x || !object.end.y) return [];
  if (object.type === "callout") {
    const { tailX, tailY } = object.shapeAdjustments ?? calloutDefaults;
    return [{ kind: "calloutTail", point: {
      x: Math.min(0, object.end.x) + tailX * Math.abs(object.end.x),
      y: Math.min(0, object.end.y) + tailY * Math.abs(object.end.y),
    } }];
  }
  if (object.type === "parallelogram") {
    const [left, right] = polygonShapePoints(object);
    return [{ kind: "slant", point: { x: (left.x + right.x) / 2, y: left.y } }];
  }
  const [topLeft, shaftCorner, headCorner] = polygonShapePoints(object);
  if (object.type === "trapezoid") return [{ kind: "topEdge", point: topLeft }];
  return [{ kind: "arrowHead", point: headCorner }, { kind: "arrowShaft", point: shaftCorner }];
}

function adjustShape(object, original, handle, dx, dy) {
  const { type, end, shapeAdjustments } = original;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const initial = shapeAdjustments ?? shapeAdjustmentDefaults.get(type);
  const next = { ...initial };

  if (handle === "calloutTail") {
    next.tailX += dx / Math.abs(end.x);
    next.tailY += dy / Math.abs(end.y);
  } else if (handle === "topEdge") {
    next.topInset = clamp(initial.topInset + dx / Math.abs(end.x), 0, 0.48);
  } else if (handle === "slant") {
    next.slant = clamp(initial.slant + 2 * dx / Math.abs(end.x), -maxParallelogramSlant, maxParallelogramSlant);
  } else if (handle === "arrowHead") {
    next.headBase = clamp(initial.headBase + dx / end.x, 0.08, 0.92);
    next.headInset = clamp(initial.headInset + dy / Math.abs(end.y), 0, initial.shaftInset - arrowInsetGap);
  } else {
    next.shaftInset = clamp(initial.shaftInset + dy / Math.abs(end.y), initial.headInset + arrowInsetGap, 0.46);
  }

  // Keep paths and proportions immutable so undo and duplicated objects can share them.
  if (Object.keys(next).every(key => next[key] === initial[key])) {
    const { path, bounds } = original;
    Object.assign(object, { shapeAdjustments, path, bounds });
  } else {
    object.shapeAdjustments = next;
    setShapeEnd(object, end);
  }
}

function createStroke(type, point, color, weight = type === "marker" ? defaultMarkerWeight : defaultStrokeWeight) {
  const object = createObject(type, point, color);
  object.weight = weight;
  object.points = [{ x: 0, y: 0 }];
  object.path = new Path2D();
  object.geometry = { left: 0, top: 0, right: 0, bottom: 0 };
  object.bounds = padBounds(object.geometry, object.weight / 2);
  return object;
}

function extendStroke(object, point) {
  const offset = { x: point.x - object.x, y: point.y - object.y };
  const previous = object.points.at(-1);
  if (distanceBetween(previous, offset) < 0.25) return;
  appendStrokePoint(object, offset);
}

function appendStrokePoint(object, offset) {
  if (object.points.length === 1) object.path.moveTo(0, 0);
  object.path.lineTo(offset.x, offset.y);
  object.points.push(offset);
  const { left, top, right, bottom } = object.geometry;
  object.geometry = {
    left: Math.min(left, offset.x),
    top: Math.min(top, offset.y),
    right: Math.max(right, offset.x),
    bottom: Math.max(bottom, offset.y),
  };
  object.bounds = padBounds(object.geometry, object.weight / 2);
}

function updateShape(object, point, constrained = false) {
  if (constrained && isSegment(object)) point = snapSegmentEnd(object, point);
  const end = { x: point.x - object.x, y: point.y - object.y };
  if (object.type === "hexagon" || (constrained && isFillableShape(object.type))) {
    const heightToWidth = object.type === "hexagon" ? Math.sqrt(3) / 2 : 1;
    const width = Math.max(Math.abs(end.x), Math.abs(end.y) / heightToWidth);
    end.x = Math.sign(end.x || 1) * width;
    end.y = Math.sign(end.y || 1) * width * heightToWidth;
  }
  setShapeEnd(object, end);
}

function setShapeEnd(object, end) {
  object.weight ??= defaultStrokeWeight;
  object.end = end;
  const path = new Path2D();
  let bounds = rectangleBetween({ x: 0, y: 0 }, end);
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;

  if (object.type === "rect") {
    path.rect(bounds.left, bounds.top, width, height);
  } else if (object.type === "circle") {
    if (width && height) {
      path.ellipse(bounds.left + width / 2, bounds.top + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    } else {
      path.moveTo(0, 0);
      path.lineTo(end.x, end.y);
    }
  } else if (polygonShapes.has(object.type)) {
    const points = polygonShapePoints(object);
    points.forEach(({ x, y }, index) => {
      if (index === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    path.closePath();
    bounds = {
      left: Math.min(...points.map(point => point.x)),
      top: Math.min(...points.map(point => point.y)),
      right: Math.max(...points.map(point => point.x)),
      bottom: Math.max(...points.map(point => point.y)),
    };
  } else if (curvedShapes.has(object.type)) {
    const [outline, detail] = curvedShapes.get(object.type);
    const transform = new DOMMatrix([width / 100, 0, 0, height / 100, bounds.left, bounds.top]);
    path.addPath(new Path2D(outline), transform);
    if (detail) {
      object.detailPath = new Path2D();
      object.detailPath.addPath(new Path2D(detail), transform);
    }
  } else {
    path.moveTo(0, 0);
    path.lineTo(end.x, end.y);
    bounds = addLineArrows(object, [{ x: 0, y: 0 }, end], bounds);
  }

  object.path = path;
  object.bounds = padBounds(bounds, object.weight / 2);
}

function setStrokeWeight(object, weight) {
  object.weight = weight;
  if (object.type === "polyline") setPolylinePoints(object, object.points);
  else if (object.points) object.bounds = padBounds(object.geometry, weight / 2);
  else setShapeEnd(object, object.end);
}

function textWidth(context, lines) {
  context.save();
  context.font = paintFont;
  const width = lines.reduce((max, line) => Math.max(max, context.measureText(line).width), 1);
  context.restore();
  return width;
}

function measureTextObject(context, object) {
  object.lines = object.text.split("\n");
  object.bounds = {
    left: 0,
    top: 0,
    right: textWidth(context, object.lines),
    bottom: object.lines.length * paintLineHeight,
  };
}

function createImageObject(image, blob, center) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const object = createObject("image", { x: center.x - width / 2, y: center.y - height / 2 });
  object.image = image;
  object.blob = blob;
  object.source = { x: 0, y: 0, width, height };
  object.bounds = { left: 0, top: 0, right: width, bottom: height };
  return object;
}

function applyImageCrop(object, bounds) {
  const { left, top, right, bottom } = bounds;
  const origin = objectToWorld(object, { x: left, y: top });
  const width = right - left;
  const height = bottom - top;
  object.source = {
    x: object.source.x + left,
    y: object.source.y + top,
    width,
    height,
  };
  object.x = origin.x;
  object.y = origin.y;
  object.bounds = { left: 0, top: 0, right: width, bottom: height };
}

function drawObject(context, object) {
  if (object.type === "marker") {
    drawHighlighter(context, object);
    return;
  }
  const { a, b, c, d } = objectMatrix(object);
  context.save();
  context.transform(a, b, c, d, object.x, object.y);
  context.fillStyle = context.strokeStyle = object.color || "#fff";

  if (object.type === "image") {
    const { x, y, width, height } = object.source;
    context.drawImage(object.image, x, y, width, height, 0, 0, width, height);
  } else if (object.type === "text") {
    context.font = paintFont;
    context.textBaseline = "alphabetic";
    object.lines.forEach((line, index) => context.fillText(line, 0, 25 + index * paintLineHeight));
  } else {
    if (object.fill) {
      context.save();
      context.globalAlpha = 1 - (object.fillTransparency ?? 0) / 100;
      context.fillStyle = object.fill;
      context.fill(object.path);
      context.restore();
    }
    drawStrokePath(context, object);
  }

  context.restore();
}

function drawStrokePath(context, object) {
  const { weight, lineStyle, arrowhead, detailPath } = object;
  context.lineWidth = weight;
  context.lineCap = context.lineJoin = "round";
  if (object.points?.length === 1) {
    context.beginPath();
    context.arc(0, 0, weight / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }
  if (lineStyle === "dashed") context.setLineDash([weight * 3, weight * 2.5]);
  if (lineStyle === "dotted") context.setLineDash([0.01, weight * 2.65]);
  context.stroke(object.path);
  if (detailPath) context.stroke(detailPath);
  if (arrowhead) {
    context.setLineDash([]);
    context.stroke(arrowhead);
  }
}

function objectContainsPoint(context, object, point, tolerance) {
  if (!containsPoint(padBounds(worldBounds(object), tolerance), point)) return false;
  const local = worldToObject(object, point);
  const localTolerance = tolerance / Math.min(object.scaleX, object.scaleY);
  if (!object.path || object.points?.length === 1) return containsPoint(padBounds(object.bounds, localTolerance), local);

  context.save();
  context.lineWidth = object.weight + localTolerance * 2;
  context.lineCap = context.lineJoin = "round";
  const { x, y } = local;
  const hit = (object.fill && object.fillTransparency !== 100 && context.isPointInPath(object.path, x, y)) ||
    context.isPointInStroke(object.path, x, y) ||
    (object.detailPath && context.isPointInStroke(object.detailPath, x, y)) ||
    (object.arrowhead && context.isPointInStroke(object.arrowhead, x, y));
  context.restore();
  return hit;
}

async function decodePaintImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sceneBounds(objects) {
  return objects.map(worldBounds).reduce((area, next) => ({
    left: Math.min(area.left, next.left),
    top: Math.min(area.top, next.top),
    right: Math.max(area.right, next.right),
    bottom: Math.max(area.bottom, next.bottom),
  }));
}

