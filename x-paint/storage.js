"use strict";

function openPaintStorage() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("xinit-paint", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drawings");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readPaintScene(database) {
  return new Promise((resolve, reject) => {
    const request = database.transaction("drawings").objectStore("drawings").get("current");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function savePaintScene(database, scene) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("drawings", "readwrite");
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
    transaction.objectStore("drawings").put(scene, "current");
    transaction.commit?.();
  });
}

function savePaintObject(object) {
  const { type, x, y, scaleX, scaleY, color, fill, fillTransparency, end, points, text, blob, source, groupId } = object;
  const { angle, shear, weight } = object;
  return { type, x, y, scaleX, scaleY, color, fill, fillTransparency, end, points, text, blob, source, groupId, angle, shear, weight };
}

async function restorePaintObject(saved, context) {
  const { type, x, y, scaleX, scaleY, color, fill, fillTransparency, end, points, text, blob, source } = saved;
  let object = createObject(type, { x, y }, color);
  switch (type) {
    case "brush":
    case "marker":
      object = createStroke(type, { x, y }, color, saved.weight);
      for (const point of points.slice(1)) appendStrokePoint(object, point);
      break;
    case "rect":
    case "circle":
    case "line":
    case "arrow":
      object.weight = saved.weight;
      setShapeEnd(object, end);
      if (fill) {
        object.fill = fill;
        object.fillTransparency = fillTransparency ?? 0;
      }
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
      throw new Error("Unknown drawing object");
  }
  object.scaleX = scaleX;
  object.scaleY = scaleY;
  object.angle = saved.angle ?? 0;
  object.shear = saved.shear ?? 0;
  if (saved.groupId) object.groupId = saved.groupId;
  return object;
}
