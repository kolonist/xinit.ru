"use strict";

function openPaintStorage() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("xinit-paint", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drawings");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readPaintScene(database, key) {
  return new Promise((resolve, reject) => {
    const request = database.transaction("drawings").objectStore("drawings").get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function savePaintScene(database, scene, key, updateDetails = true) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("drawings", "readwrite");
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
    const store = transaction.objectStore("drawings");
    store.put(scene, key);
    const id = paintBoardId(key);
    if (updateDetails && id) {
      store.put({ id, title: paintBoardTitle(scene), modified: Date.now() }, `board:${id}`);
    }
    transaction.commit?.();
  });
}

function deletePaintScene(database, key) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("drawings", "readwrite");
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
    const store = transaction.objectStore("drawings");
    store.delete(key);
    const id = paintBoardId(key);
    if (id) store.delete(`board:${id}`);
    transaction.commit?.();
  });
}

function paintDrawingKey(id) {
  return `project:${id}`;
}

function paintBoardId(key) {
  return key.startsWith("project:") ? validatePaintDrawingId(key.slice("project:".length)) : null;
}

function paintBoardTitle(scene) {
  const text = scene.objects.find(object => object.type === "text" && object.text?.trim())?.text;
  return text?.trim().split("\n", 1)[0].trim().slice(0, 120) ?? "";
}

function readPaintBoardIndex(database) {
  return new Promise((resolve, reject) => {
    // Separate keys keep the list small and let older tabs keep using the same database.
    const transaction = database.transaction("drawings");
    const store = transaction.objectStore("drawings");
    const keys = store.getAllKeys(IDBKeyRange.bound("project:", "project:\uffff"));
    const details = store.getAll(IDBKeyRange.bound("board:", "board:\uffff"));
    const legacyCurrent = store.getKey("current");
    transaction.onabort = () => reject(transaction.error);
    transaction.oncomplete = () => resolve({ keys: keys.result, details: details.result, legacyCurrent: legacyCurrent.result });
  });
}

async function readPaintBoards(database) {
  let index = await readPaintBoardIndex(database);
  const legacyKeys = index.keys.filter(isLegacyPaintProjectKey);
  if (index.legacyCurrent) legacyKeys.push(index.legacyCurrent);
  if (legacyKeys.length) {
    await Promise.all(legacyKeys.map(key => migratePaintScene(database, key)));
    index = await readPaintBoardIndex(database);
  }
  const byId = new Map(index.details.map(board => [board.id, board]));
  return index.keys.map(paintBoardId).filter(Boolean)
    .map(id => byId.get(id) ?? { id, title: "", modified: null })
    .sort((first, second) => second.modified - first.modified);
}

function isLegacyPaintProjectKey(key) {
  return typeof key === "string" && /^project:\d+(?:-\d+){3}$/.test(key);
}

function readLegacyPaintWorkspace() {
  let key = history.state?.paintWorkspace;
  try {
    key ??= sessionStorage.getItem("xinit-paint-open-project");
  } catch {
    // The previous entry may still identify the project.
  }
  return isLegacyPaintProjectKey(key) ? key : null;
}

function forgetLegacyPaintWorkspace() {
  try {
    sessionStorage.removeItem("xinit-paint-open-project");
  } catch {
    // Session storage may be unavailable.
  }
}

function migratePaintScene(database, key) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("drawings", "readwrite");
    const store = transaction.objectStore("drawings");
    let result;
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(transaction.error);
    const request = store.get(key);
    request.onsuccess = () => {
      const saved = request.result;
      if (!saved || (key === "current" && !saved.objects.length)) return;
      const id = crypto.randomUUID();
      store.put(saved, paintDrawingKey(id));
      store.delete(key);
      result = { id, scene: saved };
    };
  });
}

function savePaintObject(object) {
  const { type, x, y, scaleX, scaleY, color, fill, fillTransparency, end, points, text, blob, source, groupId } = object;
  const { angle, shear, weight, lineStyle, shapeAdjustments, lineEnds } = object;
  return { type, x, y, scaleX, scaleY, color, fill, fillTransparency, end, points, text, blob, source,
    groupId, angle, shear, weight, lineStyle, shapeAdjustments, lineEnds };
}

async function restorePaintObject(saved, context) {
  const { type, x, y, scaleX, scaleY, color, fill, fillTransparency, end, points, text, blob, source } = saved;
  let object = createObject(type === "arrow" ? "line" : type, { x, y }, color);
  switch (type) {
    case "brush":
    case "marker":
      object = createStroke(type, { x, y }, color, saved.weight);
      if (type === "brush") object.lineStyle = saved.lineStyle ?? "solid";
      for (const point of points.slice(1)) appendStrokePoint(object, point);
      break;
    case "polyline":
      object.weight = saved.weight;
      object.lineStyle = saved.lineStyle ?? "solid";
      object.lineEnds = saved.lineEnds ?? 0;
      setPolylinePoints(object, points);
      break;
    case "text":
      object.text = text;
      measureTextObject(context, object);
      break;
    case "image":
      object.image = await decodePaintImage(blob);
      object.blob = blob;
      object.source = source;
      object.bounds = { left: 0, top: 0, right: source.width, bottom: source.height };
      break;
    default:
      if (!isFillableShape(type) && !isSegment(object)) throw new Error("Unknown drawing object");
      object.weight = saved.weight;
      object.lineStyle = saved.lineStyle ?? "solid";
      if (isSegment(object)) object.lineEnds = saved.lineEnds ?? (type === "arrow" ? lineEndArrow : 0);
      object.shapeAdjustments = saved.shapeAdjustments;
      setShapeEnd(object, end);
      if (fill) {
        object.fill = fill;
        object.fillTransparency = fillTransparency ?? 0;
      }
      break;
  }
  object.scaleX = scaleX;
  object.scaleY = scaleY;
  object.angle = saved.angle ?? 0;
  object.shear = saved.shear ?? 0;
  if (saved.groupId) object.groupId = saved.groupId;
  return object;
}
