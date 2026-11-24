"use strict";

const paintPagePath = "/x-paint/";
const paintDrawingParameter = "drawing";
const paintDrawingIdPattern = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

function validatePaintDrawingId(id) {
  return typeof id === "string" && id.length === 36 && paintDrawingIdPattern.test(id) ? id.toLowerCase() : null;
}

function paintDrawingIdFromPath(path) {
  if (!path.startsWith(paintPagePath)) return null;
  return validatePaintDrawingId(path.slice(paintPagePath.length).replace(/\/$/, ""));
}
