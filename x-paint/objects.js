"use strict";

const paintFont = '24px "JetBrains Mono", monospace';
const paintLineHeight = 34;
const defaultStrokeWeight = 3;
const defaultMarkerWeight = 16;

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

function createObject(type, point, color) {
  return { type, x: point.x, y: point.y, color, scaleX: 1, scaleY: 1 };
}

function isFillable(object) {
  return object.type === "rect" || object.type === "circle";
}

function isSegment(object) {
  return object?.type === "line" || object?.type === "arrow";
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
  const end = { x: point.x - object.x, y: point.y - object.y };
  if (constrained && isFillable(object)) {
    const side = Math.max(Math.abs(end.x), Math.abs(end.y));
    end.x = Math.sign(end.x || 1) * side;
    end.y = Math.sign(end.y || 1) * side;
  }
  setShapeEnd(object, end);
}

function setShapeEnd(object, end) {
  object.weight ??= defaultStrokeWeight;
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
  } else {
    path.moveTo(0, 0);
    path.lineTo(end.x, end.y);
    if (object.type === "arrow") {
      const angle = Math.atan2(end.y, end.x);
      const halfAngle = Math.PI / 9;
      const length = Math.min(Math.max(20, object.weight * 3.5), Math.hypot(end.x, end.y) * 0.5);
      const tips = [angle - halfAngle, angle + halfAngle].map(direction => ({
        x: end.x - Math.cos(direction) * length,
        y: end.y - Math.sin(direction) * length,
      }));
      object.arrowhead = new Path2D();
      object.arrowhead.moveTo(tips[0].x, tips[0].y);
      object.arrowhead.lineTo(end.x, end.y);
      object.arrowhead.lineTo(tips[1].x, tips[1].y);
      bounds = {
        left: Math.min(bounds.left, ...tips.map(tip => tip.x)),
        top: Math.min(bounds.top, ...tips.map(tip => tip.y)),
        right: Math.max(bounds.right, ...tips.map(tip => tip.x)),
        bottom: Math.max(bounds.bottom, ...tips.map(tip => tip.y)),
      };
    }
  }

  object.end = end;
  object.path = path;
  object.bounds = padBounds(bounds, object.weight / 2);
}

function setStrokeWeight(object, weight) {
  object.weight = weight;
  if (object.points) object.bounds = padBounds(object.geometry, weight / 2);
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

function createImageObject(image, blob, center, scale) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const object = createObject("image", { x: center.x - width * scale / 2, y: center.y - height * scale / 2 });
  object.image = image;
  object.blob = blob;
  object.source = { x: 0, y: 0, width, height };
  object.bounds = { left: 0, top: 0, right: width, bottom: height };
  object.scaleX = scale;
  object.scaleY = scale;
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
  const { weight, lineStyle, arrowhead } = object;
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

