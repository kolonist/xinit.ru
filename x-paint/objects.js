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

const personOutlines = [
  "M12 2.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5Z",
  "M9.5 9.1h5c1.1 0 1.7.6 2.2 1.7l2 3.8c.5 1.1-.7 1.8-1.4.9l-2.4-3.1-.5 3.2 1.1 5.2" +
    "c.3 1.3-1.4 1.8-1.9.6L12 17l-1.6 4.4c-.5 1.2-2.2.7-1.9-.6l1.1-5.2-.5-3.2-2.4 3.1" +
    "c-.7.9-1.9.2-1.4-.9l2-3.8c.5-1.1 1.1-1.7 2.2-1.7Z",
];
const serverRackOutline = "M4 3h16q1 0 1 1v16q0 1-1 1H4q-1 0-1-1V4q0-1 1-1Z";
const serverRackDetail = "M3 9h18M3 15h18M6 6h3m-3 6h3m-3 6h3M17 6h.5m-.5 6h.5m-.5 6h.5";
const laptopOutline = "M5 4h14q1 0 1 1v10l2.5 4q0 1-1 1h-19q-1 0-1-1L4 15V5q0-1 1-1Z";
const laptopHinge = "M4 15h16";
const laptopKeyboard = "M6 16.65h12M5 18.3h14";
const defaultCurvedViewBox = { x: 0, y: 0, width: 100, height: 100 };
const tensorCorners = [
  [2.5, 6.5], [4.75, 6.5], [4.75, 4.25], [7, 4.25], [7, 2], [21.5, 2],
  [21.5, 16.5], [19.25, 16.5], [19.25, 18.75], [17, 18.75], [17, 21], [2.5, 21],
];

const curvedShapes = new Map([
  ["cylinder", {
    outlines: ["M0 15C0 6.72 22.39 0 50 0S100 6.72 100 15V85C100 93.28 77.61 100 50 100S0 93.28 0 85Z"],
    detail: "M0 15C0 23.28 22.39 30 50 30S100 23.28 100 15",
  }],
  ["roundedRect", { outlines: ["M15 0H85Q100 0 100 15V85Q100 100 85 100H15Q0 100 0 85V15Q0 0 15 0Z"] }],
  ["cloud", {
    outlines: ["M22 100C9 100 0 87 0 71C0 56 7 43 18 38C18 16 28 0 42 0C51 0 57 6 61 15" +
      "C66 8 73 6 80 12C89 18 93 31 92 45C97 50 100 59 100 70C100 87 91 100 78 100Z"],
  }],
  ["person", {
    outlines: personOutlines,
    viewBox: { x: 5, y: 2.5, width: 14, height: 20 },
    markers: [[12, 2.5], [18.7, 14.6], [15.5, 20.8], [8.5, 20.8], [5.3, 14.6]],
  }],
  ["serverRack", {
    outlines: [serverRackOutline],
    detail: serverRackDetail,
    viewBox: { x: 3, y: 3, width: 18, height: 18 },
  }],
  ["laptop", {
    outlines: [laptopOutline],
    detail: `${laptopHinge} ${laptopKeyboard}`,
    viewBox: { x: 1.5, y: 4, width: 21, height: 16 },
  }],
  ["router", {
    outlines: ["M12 2.5a9.5 9.5 0 1 0 0 19a9.5 9.5 0 1 0 0-19Z"],
    detail: "M12 9V5.7M10.4 7.3 12 5.7l1.6 1.6M12 15v3.3M10.4 16.7 12 18.3l1.6-1.6" +
      "M5.7 12H9M7.4 10.4 9 12l-1.6 1.6M18.3 12H15M16.6 10.4 15 12l1.6 1.6",
    viewBox: { x: 2.5, y: 2.5, width: 19, height: 19 },
  }],
  ["textFile", {
    outlines: ["M5 2.5h9l5 5V21q0 1-1 1H6q-1 0-1-1Z"],
    detail: "M14 2.5v5h5M8 11h8m-8 3h8m-8 3h5",
    viewBox: { x: 5, y: 2.5, width: 14, height: 19.5 },
    corners: [[5, 2.5], [14, 2.5], [19, 7.5]],
  }],
  ["tensor", {
    outlines: [`M${tensorCorners.map(corner => corner.join(" ")).join("L")}Z`],
    detail: "M4.75 6.5H17V18.75M7 4.25H19.25V16.5" +
      "M2.5 11.33H17M2.5 16.17H17M7.33 6.5V21M12.17 6.5V21",
    viewBox: { x: 2.5, y: 2, width: 19, height: 19 },
    vertices: tensorCorners,
  }],
  ["queue", {
    outlines: ["M3 8h18q1 0 1 1v6q0 1-1 1H3q-1 0-1-1V9q0-1 1-1Z"],
    detail: "M7 8v8m5-8v8m5-8v8",
    viewBox: { x: 2, y: 8, width: 20, height: 8 },
  }],
  ["chip", {
    outlines: ["M7 5.5h10q1.5 0 1.5 1.5v10q0 1.5-1.5 1.5H7q-1.5 0-1.5-1.5V7Q5.5 5.5 7 5.5Z"],
    detail: "M9 2.5v3m3-3v3m3-3v3M9 18.5v3m3-3v3m3-3v3M2.5 9h3m-3 3h3m-3 3h3" +
      "M18.5 9h3m-3 3h3m-3 3h3M9 9h6v6H9Z",
    viewBox: { x: 2.5, y: 2.5, width: 19, height: 19 },
  }],
]);
// Straight sections in the same view box as the curves.
const curvedShapeSides = new Map([
  ["cylinder", [[[0, 15], [0, 85]], [[100, 15], [100, 85]]]],
  ["roundedRect", [[[15, 0], [85, 0]], [[100, 15], [100, 85]], [[85, 100], [15, 100]], [[0, 85], [0, 15]]]],
  ["cloud", [[[22, 100], [78, 100]]]],
  ["serverRack", [[[4, 3], [20, 3]], [[21, 4], [21, 20]], [[20, 21], [4, 21]], [[3, 20], [3, 4]]]],
  ["laptop", [
    [[5, 4], [19, 4]], [[20, 5], [20, 15]], [[20, 15], [22.5, 19]],
    [[21.5, 20], [2.5, 20]], [[1.5, 19], [4, 15]], [[4, 15], [4, 5]],
  ]],
  ["textFile", [[[5, 2.5], [14, 2.5]], [[14, 2.5], [19, 7.5]], [[19, 7.5], [19, 21]],
    [[18, 22], [6, 22]], [[5, 21], [5, 2.5]]]],
  ["tensor", tensorCorners.map((corner, index) => [corner, tensorCorners[(index + 1) % tensorCorners.length]])],
  ["queue", [[[3, 8], [21, 8]], [[22, 9], [22, 15]], [[21, 16], [3, 16]], [[2, 15], [2, 9]]]],
  ["chip", [[[7, 5.5], [17, 5.5]], [[18.5, 7], [18.5, 17]], [[17, 18.5], [7, 18.5]], [[5.5, 17], [5.5, 7]]]],
]);
const shapeLibraryTypes = [...polygonShapes.keys(), ...curvedShapes.keys()];

function calloutOutline({ tailX, tailY } = calloutDefaults) {
  // Keep the rectangular corners and the tail addressable as the tail changes sides.
  const corners = [[0, 0, 0], [1, 0, 1], [1, 1, 2], [0, 1, 3]];
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
  corners.splice(side + 1, 0, [...basePoint(center - 0.1), 4], [tailX, tailY, 5], [...basePoint(center + 0.1), 6]);
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
  const object = { type, x: point.x, y: point.y, color, scaleX: 1, scaleY: 1 };
  if (isFillableShape(type)) object.shapeId = crypto.randomUUID();
  return object;
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

function hasLineConnections(object) {
  return Boolean(object.startShapeId || object.endShapeId);
}

function lineVertices(object) {
  return object.type === "polyline" ? object.points : [{ x: 0, y: 0 }, object.end];
}

function shapeCenter(shape) {
  return objectToWorld(shape, { x: shape.end.x / 2, y: shape.end.y / 2 });
}

const connectionAxes = [{ x: 1, y: 0 }, { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: 0, y: 1 }, { x: -Math.SQRT1_2, y: Math.SQRT1_2 }];

function connectionDirection(from, to) {
  const step = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / (Math.PI / 4));
  return (step + 4) % 4;
}

function projection(point, axis) {
  return point.x * axis.x + point.y * axis.y;
}

function perpendicular(axis) {
  return { x: -axis.y, y: axis.x };
}

function connectionOffset(shape, point, direction) {
  const axis = perpendicular(connectionAxes[direction]);
  return projection(point, axis) - projection(shapeCenter(shape), axis);
}

const curvedShapeOutlines = new Map();

function curvedShapeTransform(shape) {
  const { left, top, right, bottom } = rectangleBetween({ x: 0, y: 0 }, shape.end);
  const { viewBox = defaultCurvedViewBox } = curvedShapes.get(shape.type);
  const scaleX = (right - left) / viewBox.width;
  const scaleY = (bottom - top) / viewBox.height;
  return new DOMMatrix([scaleX, 0, 0, scaleY, left - viewBox.x * scaleX, top - viewBox.y * scaleY]);
}

function connectionContours(shape) {
  if (polygonShapes.has(shape.type)) return [polygonShapePoints(shape)];
  if (shape.type === "rect") {
    const { left, top, right, bottom } = rectangleBetween({ x: 0, y: 0 }, shape.end);
    return [[{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }]];
  }
  const { outlines, vertices } = curvedShapes.get(shape.type);
  const { a, d, e, f } = curvedShapeTransform(shape);
  if (vertices) return [vertices.map(([x, y]) => ({ x: a * x + e, y: d * y + f }))];
  // Sample each closed outline separately so connections never land in a gap between contours.
  if (!curvedShapeOutlines.has(shape.type)) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const contours = outlines.map(outline => {
      path.setAttribute("d", outline);
      const length = path.getTotalLength();
      const samples = 256;
      return Array.from({ length: samples }, (_, index) => path.getPointAtLength(length * index / samples));
    });
    curvedShapeOutlines.set(shape.type, contours);
  }
  return curvedShapeOutlines.get(shape.type).map(contour => contour.map(({ x, y }) => ({ x: a * x + e, y: d * y + f })));
}

function shapeLineRange(shape, origin, axis) {
  const center = { x: shape.end.x / 2, y: shape.end.y / 2 };
  if (!center.x || !center.y) return null;
  const local = worldToObject(shape, origin);
  const { a, b, c, d } = objectMatrix(shape);
  const determinant = a * d - b * c;
  const dx = (d * axis.x - c * axis.y) / determinant;
  const dy = (a * axis.y - b * axis.x) / determinant;
  if (shape.type === "circle") {
    const x = (local.x - center.x) / center.x;
    const y = (local.y - center.y) / center.y;
    const u = dx / center.x;
    const v = dy / center.y;
    const speed = Math.hypot(u, v);
    const distance = (x * v - y * u) / speed;
    if (Math.abs(distance) > 1 + 1e-9) return null;
    const middle = -(x * u + y * v) / (speed * speed);
    const radius = Math.sqrt(Math.max(0, 1 - distance * distance)) / speed;
    return { min: middle - radius, max: middle + radius };
  }
  let min = Infinity;
  let max = -Infinity;
  const length = Math.hypot(dx, dy);
  const lengthSquared = length * length;
  for (const outline of connectionContours(shape)) {
    let previous = outline.at(-1);
    for (const point of outline) {
      const x = previous.x - local.x;
      const y = previous.y - local.y;
      const nextX = point.x - local.x;
      const nextY = point.y - local.y;
      const side = (dx * y - dy * x) / length;
      const nextSide = (dx * nextY - dy * nextX) / length;
      if (Math.abs(side) < 1e-7) {
        const hit = (x * dx + y * dy) / lengthSquared;
        min = Math.min(min, hit);
        max = Math.max(max, hit);
      }
      if (side * nextSide < 0) {
        const ratio = side / (side - nextSide);
        const hit = ((x + (nextX - x) * ratio) * dx + (y + (nextY - y) * ratio) * dy) / lengthSquared;
        min = Math.min(min, hit);
        max = Math.max(max, hit);
      }
      previous = point;
    }
  }
  return min <= max ? { min, max } : null;
}

function pointAlong(origin, axis, distance) {
  return { x: origin.x + axis.x * distance, y: origin.y + axis.y * distance };
}

function shapeConnectionGeometry(shape) {
  const geometry = { corner: [], side: [], midpoint: [] };
  if (!shape.end.x || !shape.end.y) return geometry;
  if (shape.type === "rect" || polygonShapes.has(shape.type)) {
    geometry.sideMidpoints = true;
    const [outline] = connectionContours(shape);
    const vertices = outline.map(point => objectToWorld(shape, point));
    vertices.forEach((point, index) => {
      const key = outline[index].connectionIndex ?? index;
      const next = vertices[(index + 1) % vertices.length];
      geometry.corner[key] = point;
      if (distanceBetween(point, next) < 1e-7) return;
      geometry.side[key] = [point, next];
      geometry.midpoint[key] = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
    });
    return geometry;
  }

  const curved = curvedShapes.get(shape.type);
  if (curved) {
    const { a, d, e, f } = curvedShapeTransform(shape);
    const project = ([x, y]) => objectToWorld(shape, { x: a * x + e, y: d * y + f });
    geometry.side = (curvedShapeSides.get(shape.type) ?? []).map(side => side.map(project));
    const corners = curved.corners ?? curved.vertices;
    if (corners) geometry.corner = corners.map(project);
    if (curved.markers) {
      geometry.midpoint = curved.markers.map(project);
      return geometry;
    }
  }
  const center = shapeCenter(shape);
  const { a, b, c, d } = objectMatrix(shape);
  [{ x: a, y: b }, { x: c, y: d }].forEach((axis, index) => {
    const range = shapeLineRange(shape, center, axis);
    if (!range) return;
    geometry.midpoint[index * 2] = pointAlong(center, axis, range.min);
    geometry.midpoint[index * 2 + 1] = pointAlong(center, axis, range.max);
  });
  return geometry;
}

function isConnectionAnchor(anchor) {
  return typeof anchor === "string" && /^(corner|side|midpoint):(?:0|[1-9][0-9]?)$/.test(anchor);
}

function connectionAnchorGeometry(geometry, anchor) {
  if (!anchor) return null;
  const [kind, index] = anchor.split(":");
  return geometry[kind]?.[index];
}

function projectOntoSide([start, end], point) {
  const axis = { x: end.x - start.x, y: end.y - start.y };
  const fraction = projection({ x: point.x - start.x, y: point.y - start.y }, axis) / projection(axis, axis);
  return pointAlong(start, axis, Math.min(1, Math.max(0, fraction)));
}

function shapeConnectionMarkers(geometry, minimumSideLength) {
  return geometry.midpoint.flatMap((point, index) => {
    const side = geometry.sideMidpoints && geometry.side[index];
    return !side || distanceBetween(...side) >= minimumSideLength ? [{ point, index }] : [];
  });
}

function connectionPoint(shape, toward, fallback, direction) {
  if (direction != null) {
    const axis = connectionAxes[direction];
    const range = shapeLineRange(shape, toward, axis);
    if (range) {
      const distance = Math.abs(range.min) < Math.abs(range.max) ? range.min : range.max;
      return pointAlong(toward, axis, distance);
    }
  }
  const center = shapeCenter(shape);
  if (distanceBetween(center, toward) < 1e-7 && fallback) toward = fallback;
  if (distanceBetween(center, toward) < 1e-7) toward = objectToWorld(shape, { x: 0, y: shape.end.y / 2 });
  const axis = { x: toward.x - center.x, y: toward.y - center.y };
  const range = shapeLineRange(shape, center, axis);
  return range ? pointAlong(center, axis, range.max) : fallback;
}

function shapeProjectionRange(shape, axis) {
  const { a, b, c, d } = objectMatrix(shape);
  const localAxis = { x: a * axis.x + b * axis.y, y: c * axis.x + d * axis.y };
  if (shape.type === "circle") {
    const middle = projection(shapeCenter(shape), axis);
    const radius = Math.hypot(shape.end.x / 2 * localAxis.x, shape.end.y / 2 * localAxis.y);
    return { min: middle - radius, max: middle + radius };
  }
  const origin = projection(shape, axis);
  const offsets = connectionContours(shape).flatMap(outline => outline.map(point => projection(point, localAxis)));
  return { min: origin + Math.min(...offsets), max: origin + Math.max(...offsets) };
}

function parallelConnections(startShape, endShape, direction, offset) {
  const axis = connectionAxes[direction];
  const normal = perpendicular(axis);
  const startRange = shapeProjectionRange(startShape, normal);
  const endRange = shapeProjectionRange(endShape, normal);
  const min = Math.max(startRange.min, endRange.min);
  const max = Math.min(startRange.max, endRange.max);
  if (min > max + 1e-7) return null;
  const start = shapeCenter(startShape);
  const startOffset = projection(start, normal);
  const sharedOffset = Math.min(max, Math.max(min, startOffset + (offset ?? 0)));
  const origin = pointAlong(start, normal, sharedOffset - startOffset);
  const first = shapeLineRange(startShape, origin, axis);
  const last = shapeLineRange(endShape, origin, axis);
  if (!first || !last) return null;
  const forward = projection(shapeCenter(endShape), axis) >= projection(start, axis);
  return [pointAlong(origin, axis, forward ? first.max : first.min),
    pointAlong(origin, axis, forward ? last.min : last.max)];
}

function updateLineConnections(line, startShape, endShape) {
  if (!startShape && !endShape) return;
  const vertices = lineVertices(line);
  if (vertices.length < 2) return;
  const start = objectToWorld(line, vertices[0]);
  const end = objectToWorld(line, vertices.at(-1));
  const bothEnds = vertices.length === 2 && startShape && endShape;
  const startAnchor = startShape && line.startConnectionAnchor &&
    connectionAnchorGeometry(shapeConnectionGeometry(startShape), line.startConnectionAnchor);
  const endAnchor = endShape && line.endConnectionAnchor &&
    connectionAnchorGeometry(shapeConnectionGeometry(endShape), line.endConnectionAnchor);
  const direction = line.startConnectionDirection ?? line.endConnectionDirection;
  const parallel = bothEnds && !startAnchor && !endAnchor && direction != null
    ? parallelConnections(startShape, endShape, direction, line.connectionOffset) : null;
  const next = bothEnds ? shapeCenter(endShape) : objectToWorld(line, vertices[1]);
  const previous = bothEnds ? shapeCenter(startShape) : objectToWorld(line, vertices.at(-2));
  let connectedStart = parallel?.[0] || startAnchor;
  let connectedEnd = parallel?.[1] || endAnchor;
  // Project in canvas coordinates. If two sides disagree, favor a right angle at the end.
  if (Array.isArray(connectedEnd)) connectedEnd = projectOntoSide(connectedEnd, previous);
  if (Array.isArray(connectedStart)) connectedStart = projectOntoSide(connectedStart, (bothEnds && connectedEnd) || next);
  if (Array.isArray(endAnchor) && bothEnds && connectedStart) {
    connectedEnd = projectOntoSide(endAnchor, connectedStart);
  }
  if (!connectedStart) {
    const followDirection = !bothEnds || (endAnchor && !Array.isArray(endAnchor));
    connectedStart = startShape
      ? connectionPoint(startShape, (bothEnds && connectedEnd) || next, start, followDirection ? line.startConnectionDirection : undefined)
      : start;
  }
  if (!connectedEnd) {
    const followDirection = !bothEnds || (startAnchor && !Array.isArray(startAnchor));
    connectedEnd = endShape
      ? connectionPoint(endShape, (bothEnds && startAnchor && connectedStart) || previous, end,
        followDirection ? line.endConnectionDirection : undefined)
      : end;
  }
  const startChanged = distanceBetween(start, connectedStart) > 1e-7;
  const endChanged = distanceBetween(end, connectedEnd) > 1e-7;
  if (!startChanged && !endChanged) return;
  if (isSegment(line)) {
    Object.assign(line, connectedStart);
    setShapeEnd(line, worldToObject(line, connectedEnd));
  } else {
    const points = vertices.slice();
    if (startChanged) points[0] = worldToObject(line, connectedStart);
    if (endChanged) points[points.length - 1] = worldToObject(line, connectedEnd);
    setPolylinePoints(line, points);
  }
}

function syncLineConnections(objects, clearMissing = false) {
  if (!objects.some(hasLineConnections)) return;
  const shapes = new Map(objects.filter(object => object.shapeId).map(object => [object.shapeId, object]));
  for (const line of objects) {
    if (!hasLineConnections(line)) continue;
    const start = shapes.get(line.startShapeId);
    const end = shapes.get(line.endShapeId);
    updateLineConnections(line, start, end);
    if (clearMissing && !start) line.startShapeId = line.startConnectionDirection = line.startConnectionAnchor = undefined;
    if (clearMissing && !end) line.endShapeId = line.endConnectionDirection = line.endConnectionAnchor = undefined;
    if (clearMissing && (!start || !end)) line.connectionOffset = undefined;
  }
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
  return polygonShapes.get(type)(shapeAdjustments).map(([x, y, connectionIndex]) => ({
    x: left + (flip ? 1 - x : x) * width,
    y: top + y * height,
    connectionIndex,
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
    const viewBox = curvedShapes.get(object.type)?.viewBox;
    const heightToWidth = viewBox ? viewBox.height / viewBox.width : object.type === "hexagon" ? Math.sqrt(3) / 2 : 1;
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
    const { outlines, detail } = curvedShapes.get(object.type);
    const transform = curvedShapeTransform(object);
    for (const outline of outlines) path.addPath(new Path2D(outline), transform);
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

function layoutShapeLabel(context, object, shape) {
  const { x, y } = shape.end;
  const center = { x: x / 2, y: y / 2 };
  const { a, b, c, d } = objectMatrix(shape);
  const horizontalScale = Math.hypot(a, b);
  const verticalScale = Math.hypot(c, d);
  const width = Math.max(object.bounds.right, textWidth(context, ["WWWWWWWWW"]));
  const halfWidth = (width / 2 + 3) / horizontalScale;
  const halfHeight = (object.bounds.bottom / 2 + 3) / verticalScale;
  let scale = Math.min(1, Math.abs(x) / (2 * halfWidth), Math.abs(y) / (2 * halfHeight));
  const inset = 0.9;
  context.save();
  context.resetTransform();
  const fits = size => [-1, 0, 1].every(vertical => [-1, 1].every(horizontal =>
    context.isPointInPath(shape.path, center.x + horizontal * halfWidth * size, center.y + vertical * halfHeight * size)));
  if (!fits(scale / inset)) {
    let low = 0;
    let high = scale;
    for (let index = 0; index < 20; index++) {
      const middle = (low + high) / 2;
      if (fits(middle / inset)) low = middle;
      else high = middle;
    }
    scale = low;
  }
  context.restore();
  const scaleX = Math.max(scale, Number.EPSILON) / horizontalScale;
  const scaleY = Math.max(scale, Number.EPSILON) / verticalScale;
  const origin = objectToWorld(shape, {
    x: center.x - object.bounds.right * scaleX / 2,
    y: center.y - object.bounds.bottom * scaleY / 2,
  });
  Object.assign(object, origin, {
    scaleX: shape.scaleX * scaleX,
    scaleY: shape.scaleY * scaleY,
    angle: shape.angle,
    shear: (shape.shear ?? 0) * scaleY,
  });
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
    const centered = object.labelShapeId !== undefined;
    context.textAlign = centered ? "center" : "left";
    const x = centered ? object.bounds.right / 2 : 0;
    object.lines.forEach((line, index) => context.fillText(line, x, 25 + index * paintLineHeight));
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

function objectContainsPoint(context, object, point, tolerance, includeShapeInterior = false) {
  if (!containsPoint(padBounds(worldBounds(object), tolerance), point)) return false;
  const local = worldToObject(object, point);
  const localTolerance = tolerance / Math.min(object.scaleX, object.scaleY);
  if (!object.path || object.points?.length === 1) return containsPoint(padBounds(object.bounds, localTolerance), local);

  context.save();
  context.lineWidth = object.weight + localTolerance * 2;
  context.lineCap = context.lineJoin = "round";
  const { x, y } = local;
  const hit = (((object.fill && object.fillTransparency !== 100) || (includeShapeInterior && object.shapeId)) &&
    context.isPointInPath(object.path, x, y)) ||
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

