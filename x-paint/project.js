"use strict";

const paintProjectVersion = 1;
const paintSharePrefix = "#paint=";
const paintShareLimit = 11000;
const paintShareBytes = 8 * 1024 * 1024;
// Type indexes are saved in .xpaint files and share links.
const paintProjectTypes = ["brush", "marker", "rect", "circle", "line", "arrow", "text", "image",
  "blockArrow", "triangle", "trapezoid", "hexagon", "diamond", "parallelogram", "callout", "cylinder", "roundedRect", "cloud",
  "polyline", "person", "serverRack", "laptop", "router", "textFile", "tensor", "queue", "chip"];
const paintProjectLineStyles = ["solid", "dashed", "dotted"];
const paintPointPrecision = 8;

function packPaintProject(scene, forLink = false) {
  // A length-prefixed JSON header describes the objects and points to binary data after it.
  const { view, color, backgroundColor, fillEnabled, fillTransparency, strokeWeights, lineStyle } = scene;
  const settings = [view.x, view.y, view.zoom, color, backgroundColor, fillEnabled, fillTransparency,
    strokeWeights.stroke, strokeWeights.marker, paintProjectLineStyles.indexOf(lineStyle), scene.lineEnds ?? 0];
  const parts = [];
  const images = new Map();
  let offset = 0;
  function addPart(part) {
    const size = part instanceof Blob ? part.size : part.byteLength;
    const range = [offset, size];
    offset += size;
    parts.push(part);
    return range;
  }
  const shapeIndexes = new Map();
  scene.objects.forEach((object, index) => {
    if (object.shapeId) shapeIndexes.set(object.shapeId, index);
  });
  const records = scene.objects.map(object => {
    const { type, x, y, color, points, end, text, blob, source, weight } = object;
    let data;
    if (points) {
      data = forLink ? addPart(packPaintPoints(points)) : points.flatMap(point => [point.x, point.y]);
    } else if (end) {
      data = [end.x, end.y];
    } else if (type === "text") {
      data = text;
    } else {
      if (!images.has(blob)) images.set(blob, addPart(blob));
      data = [...images.get(blob), blob.type, source.x, source.y, source.width, source.height];
    }
    const options = [
      object.scaleX === 1 ? null : object.scaleX,
      object.scaleY === 1 ? null : object.scaleY,
      object.angle || null,
      object.shear || null,
      object.fill,
      object.fillTransparency || null,
      object.groupId,
      weight === (type === "marker" ? defaultMarkerWeight : defaultStrokeWeight) ? null : weight,
      object.lineStyle && object.lineStyle !== "solid" ? paintProjectLineStyles.indexOf(object.lineStyle) : null,
      object.shapeAdjustments,
      object.lineEnds || null,
    ];
    const startIndex = shapeIndexes.get(object.startShapeId);
    const endIndex = shapeIndexes.get(object.endShapeId);
    if (startIndex != null || endIndex != null) {
      options.push([startIndex, endIndex]);
      const startDirection = startIndex != null ? object.startConnectionDirection : undefined;
      const endDirection = endIndex != null ? object.endConnectionDirection : undefined;
      if (startDirection != null || endDirection != null) {
        options.push([startDirection, endDirection, startIndex != null && endIndex != null ? object.connectionOffset : null]);
      }
      const startAnchor = startIndex != null ? object.startConnectionAnchor : undefined;
      const endAnchor = endIndex != null ? object.endConnectionAnchor : undefined;
      if (startAnchor || endAnchor) options[14] = [startAnchor, endAnchor];
    }
    if (object.labelShapeId !== undefined) options[13] = shapeIndexes.get(object.labelShapeId) ?? -1;
    while (options.length && options.at(-1) == null) options.pop();
    const record = [paintProjectTypes.indexOf(type), x, y, color, data];
    if (options.length) record.push(options);
    return record;
  });
  const header = new TextEncoder().encode(JSON.stringify([paintProjectVersion, forLink, settings, records]));
  const headerSize = new DataView(new ArrayBuffer(4));
  headerSize.setUint32(0, header.byteLength);
  return new Blob([headerSize, header, ...parts], { type: "application/octet-stream" });
}

function packPaintPoints(points) {
  const bytes = [];
  let x = 0;
  let y = 0;
  for (const point of points) {
    const nextX = Math.round(point.x * paintPointPrecision);
    const nextY = Math.round(point.y * paintPointPrecision);
    for (const delta of [nextX - x, nextY - y]) {
      // Zigzag keeps both positive and negative displacements small before varint encoding.
      checkPaintProject(Number.isSafeInteger(2 * delta));
      let value = delta < 0 ? -2 * delta - 1 : 2 * delta;
      while (value >= 128) {
        bytes.push(128 + value % 128);
        value = Math.floor(value / 128);
      }
      bytes.push(value);
    }
    x = nextX;
    y = nextY;
  }
  return Uint8Array.from(bytes);
}

function unpackPaintPoints(bytes) {
  const coordinates = [];
  let value = 0;
  let factor = 1;
  let x = 0;
  let y = 0;
  for (const byte of bytes) {
    value += (byte % 128) * factor;
    checkPaintProject(Number.isSafeInteger(value));
    if (byte >= 128) {
      factor *= 128;
      checkPaintProject(Number.isSafeInteger(factor));
      continue;
    }
    const delta = value % 2 ? -(value + 1) / 2 : value / 2;
    if (coordinates.length % 2) {
      y += delta;
      coordinates.push(y / paintPointPrecision);
    } else {
      x += delta;
      coordinates.push(x / paintPointPrecision);
    }
    checkPaintProject(Number.isSafeInteger(x) && Number.isSafeInteger(y));
    value = 0;
    factor = 1;
  }
  checkPaintProject(factor === 1);
  return coordinates;
}

function checkPaintProject(valid) {
  if (!valid) throw new Error("Invalid x-paint project");
}

function isPaintProjectColor(value) {
  return typeof value === "string" && /^#[a-f\d]{6}$/i.test(value);
}

function readShapeAdjustments(type, saved) {
  if (saved == null) return undefined;
  checkPaintProject(typeof saved === "object" && !Array.isArray(saved));
  if (type === "callout") {
    const { tailX, tailY } = saved;
    checkPaintProject(Number.isFinite(tailX) && Number.isFinite(tailY));
    return { tailX, tailY };
  }
  const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
  if (type === "parallelogram") {
    checkPaintProject(inRange(saved.slant, -maxParallelogramSlant, maxParallelogramSlant));
    return { slant: saved.slant };
  }
  if (type === "trapezoid") {
    checkPaintProject(inRange(saved.topInset, 0, 0.48));
    return { topInset: saved.topInset };
  }
  const { headBase, headInset, shaftInset } = saved;
  checkPaintProject(type === "blockArrow" && inRange(headBase, 0.08, 0.92) &&
    inRange(headInset, 0, 0.46 - arrowInsetGap) && inRange(shaftInset, arrowInsetGap, 0.46) &&
    headInset + arrowInsetGap <= shaftInset + 1e-9);
  return { headBase, headInset, shaftInset };
}

async function unpackPaintProject(project) {
  checkPaintProject(project.size >= 4);
  const headerSize = new DataView(await project.slice(0, 4).arrayBuffer()).getUint32(0);
  const payloadStart = 4 + headerSize;
  checkPaintProject(headerSize > 0 && payloadStart <= project.size);
  const header = JSON.parse(await project.slice(4, payloadStart).text());
  checkPaintProject(Array.isArray(header));
  const [version, forLink, settings, records] = header;
  checkPaintProject(version === paintProjectVersion && typeof forLink === "boolean" &&
    Array.isArray(settings) && Array.isArray(records));
  function readPart(offset, size, type) {
    checkPaintProject(Number.isSafeInteger(offset) && offset >= 0 && Number.isSafeInteger(size) &&
      size > 0 && offset + size <= project.size - payloadStart);
    return project.slice(payloadStart + offset, payloadStart + offset + size, type);
  }
  const [viewX, viewY, zoom, color, backgroundColor, fillEnabled, fillTransparency, stroke, marker, style, lineEnds = 0] = settings;
  checkPaintProject([viewX, viewY, zoom, fillTransparency, stroke, marker].every(Number.isFinite) &&
    zoom >= 0.1 && zoom <= 8 && isPaintProjectColor(color) && isPaintProjectColor(backgroundColor) &&
    typeof fillEnabled === "boolean" && fillTransparency >= 0 && fillTransparency <= 100 &&
    stroke >= 1 && stroke <= 32 && marker >= 1 && marker <= 64 &&
    Number.isInteger(style) && paintProjectLineStyles[style] &&
    Number.isInteger(lineEnds) && lineEnds >= 0 && lineEnds <= 3);
  const images = new Map();
  const objects = await Promise.all(records.map(async record => {
    checkPaintProject(Array.isArray(record));
    const [kind, x, y, color, data, options = []] = record;
    checkPaintProject(Array.isArray(options) && Number.isInteger(kind) && paintProjectTypes[kind]);
    const [scaleX, scaleY, angle, shear, fill, transparency, groupId, weight, line, savedShapeAdjustments,
      savedLineEnds, connections, directions, , anchors] = options;
    const type = paintProjectTypes[kind];
    checkPaintProject([x, y, scaleX ?? 1, scaleY ?? 1, angle ?? 0, shear ?? 0].every(Number.isFinite) &&
      (scaleX ?? 1) !== 0 && (scaleY ?? 1) !== 0 && (type === "image" || isPaintProjectColor(color)) &&
      (fill == null || isPaintProjectColor(fill)) &&
      (transparency == null || (Number.isFinite(transparency) && transparency >= 0 && transparency <= 100)) &&
      (groupId == null || typeof groupId === "string") &&
      (line == null || (Number.isInteger(line) && paintProjectLineStyles[line])) &&
      (weight == null || (Number.isFinite(weight) && weight >= 1 && weight <= 64)));
    const object = { type, x, y, color, scaleX: scaleX ?? 1, scaleY: scaleY ?? 1, angle, shear,
      fill, fillTransparency: transparency, groupId, weight: weight ?? undefined, lineStyle: paintProjectLineStyles[line] };
    object.shapeAdjustments = readShapeAdjustments(type, savedShapeAdjustments);
    if (savedLineEnds != null) {
      checkPaintProject(hasLineEnds(object) && Number.isInteger(savedLineEnds) && savedLineEnds >= 0 && savedLineEnds <= 3);
      object.lineEnds = savedLineEnds;
    }
    if (connections != null) {
      checkPaintProject(hasLineEnds(object) && Array.isArray(connections) && connections.length === 2 &&
        connections.every(index => index == null || (Number.isInteger(index) && index >= 0 && index < records.length)));
    }
    if (directions != null) {
      checkPaintProject(connections && Array.isArray(directions) && directions.length === 3);
      const [start, end, offset] = directions;
      const validDirection = (direction, index) => direction == null ||
        (index != null && Number.isInteger(direction) && direction >= 0 && direction < connectionAxes.length);
      checkPaintProject(validDirection(start, connections[0]) && validDirection(end, connections[1]) &&
        (offset == null || (Number.isFinite(offset) && connections.every(index => index != null))));
      object.startConnectionDirection = start ?? undefined;
      object.endConnectionDirection = end ?? undefined;
      object.connectionOffset = offset ?? undefined;
    }
    if (anchors != null) {
      checkPaintProject(connections && Array.isArray(anchors) && anchors.length === 2 &&
        anchors.every((anchor, index) => anchor == null || (connections[index] != null && isConnectionAnchor(anchor))));
      object.startConnectionAnchor = anchors[0] ?? undefined;
      object.endConnectionAnchor = anchors[1] ?? undefined;
    }
    if (type === "text") {
      checkPaintProject(typeof data === "string");
      object.text = data;
    } else {
      checkPaintProject(Array.isArray(data));
      if (type === "image") {
        const [offset, size, mime, x, y, width, height] = data;
        checkPaintProject(typeof mime === "string" && /^image\/[a-z\d.+-]+(?:;[ -~]*)?$/i.test(mime) &&
          [x, y, width, height].every(Number.isFinite) && x >= 0 && y >= 0 && width > 0 && height > 0);
        const key = JSON.stringify([offset, size, mime]);
        if (!images.has(key)) images.set(key, readPart(offset, size, mime));
        object.blob = images.get(key);
        object.source = { x, y, width, height };
      } else if (type === "brush" || type === "marker" || type === "polyline") {
        let coordinates = data;
        if (forLink) {
          checkPaintProject(data.length === 2);
          const [offset, size] = data;
          coordinates = unpackPaintPoints(new Uint8Array(await readPart(offset, size).arrayBuffer()));
        }
        const validStart = type === "polyline" ? coordinates.length >= 4 : coordinates[0] === 0 && coordinates[1] === 0;
        checkPaintProject(validStart && coordinates.length % 2 === 0 && coordinates.every(Number.isFinite));
        object.points = [];
        for (let index = 0; index < coordinates.length; index += 2) {
          object.points.push({ x: coordinates[index], y: coordinates[index + 1] });
        }
      } else {
        checkPaintProject(data.length === 2 && data.every(Number.isFinite));
        object.end = { x: data[0], y: data[1] };
      }
    }
    return object;
  }));
  records.forEach((record, index) => {
    const labelTarget = record[5]?.[13];
    if (labelTarget != null) {
      const label = objects[index];
      const shape = objects[labelTarget];
      checkPaintProject(label.type === "text" && Number.isInteger(labelTarget) &&
        (labelTarget === -1 || (shape && isFillableShape(shape.type) && label.groupId && label.groupId === shape.groupId)));
      if (shape) shape.shapeId ??= crypto.randomUUID();
      label.labelShapeId = shape?.shapeId ?? null;
    }
    const connections = record[5]?.[11];
    if (!connections) return;
    for (const [end, targetIndex] of connections.entries()) {
      if (targetIndex == null) continue;
      const target = objects[targetIndex];
      checkPaintProject(isFillableShape(target.type));
      target.shapeId ??= crypto.randomUUID();
      objects[index][end === 0 ? "startShapeId" : "endShapeId"] = target.shapeId;
    }
  });
  return { objects, view: { x: viewX, y: viewY, zoom }, color, backgroundColor, fillEnabled, fillTransparency,
    strokeWeights: { stroke, marker }, lineStyle: paintProjectLineStyles[style], lineEnds };
}

async function makePaintShareUrl(scene) {
  const project = packPaintProject(scene, true);
  if (project.size > paintShareBytes) return null;
  const stream = project.stream().pipeThrough(new CompressionStream("deflate-raw"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  const origin = location.protocol === "file:" ? "https://xinit.ru" : location.origin;
  const url = new URL(paintPagePath, origin);
  if (url.href.length + paintSharePrefix.length + Math.ceil(compressed.length * 4 / 3) > paintShareLimit) return null;
  const encoded = btoa(String.fromCharCode(...compressed)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  url.hash = paintSharePrefix + encoded;
  return url.href;
}

async function readPaintShare(hash) {
  checkPaintProject(hash.length <= paintShareLimit);
  const encoded = hash.slice(paintSharePrefix.length);
  checkPaintProject(/^[a-z\d_-]+$/i.test(encoded));
  const bytes = Uint8Array.from(atob(encoded.replaceAll("-", "+").replaceAll("_", "/")), character => character.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > paintShareBytes) {
      await reader.cancel();
      throw new Error("Share payload is too large");
    }
    chunks.push(value);
  }
  return unpackPaintProject(new Blob(chunks));
}
