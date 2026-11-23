"use strict";

const highlightMask = document.createElement("canvas");
const highlightContext = highlightMask.getContext("2d", { willReadFrequently: true });

function highlighterArea(context, object, transform) {
  const { left, top, right, bottom } = padBounds(transformedBounds(object.bounds, transform, transform.e, transform.f), 1);
  const x = Math.max(0, Math.floor(left));
  const y = Math.max(0, Math.floor(top));
  const rightEdge = Math.min(context.canvas.width, Math.ceil(right));
  const bottomEdge = Math.min(context.canvas.height, Math.ceil(bottom));
  return { x, y, width: rightEdge - x, height: bottomEdge - y };
}

function luminance(red, green, blue) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function blendHighlight(target, mask, color) {
  const red = parseInt(color.slice(1, 3), 16);
  const green = parseInt(color.slice(3, 5), 16);
  const blue = parseInt(color.slice(5, 7), 16);
  const inkLightness = luminance(red, green, blue);
  const redTint = (red - inkLightness) * 0.38;
  const greenTint = (green - inkLightness) * 0.38;
  const blueTint = (blue - inkLightness) * 0.38;

  for (let index = 0; index < target.length; index += 4) {
    if (mask[index + 3] === 0) continue;
    const coverage = mask[index + 3] / 255;
    const alpha = target[index + 3] / 255;
    const ink = (1 - alpha) * coverage * 0.36;
    const resultAlpha = alpha + ink;
    const lightness = luminance(target[index], target[index + 1], target[index + 2]);
    // Stretch midtones while leaving room for visible tint on pure black and white.
    const contrasted = Math.max(0, Math.min(255, (lightness - 127.5) * 1.42 + 127.5));
    const shift = 12 + contrasted * 0.9 - lightness;
    target[index] = ((target[index] + (shift + redTint) * coverage) * alpha + red * ink) / resultAlpha;
    target[index + 1] = ((target[index + 1] + (shift + greenTint) * coverage) * alpha + green * ink) / resultAlpha;
    target[index + 2] = ((target[index + 2] + (shift + blueTint) * coverage) * alpha + blue * ink) / resultAlpha;
    target[index + 3] = resultAlpha * 255;
  }
}

function drawHighlighter(context, object) {
  const { a, b, c, d } = objectMatrix(object);
  const transform = context.getTransform().multiply(new DOMMatrix([a, b, c, d, object.x, object.y]));
  const { x, y, width, height } = highlighterArea(context, object, transform);
  if (width <= 0 || height <= 0) return;

  if (highlightMask.width !== width || highlightMask.height !== height) {
    highlightMask.width = width;
    highlightMask.height = height;
  } else {
    highlightContext.resetTransform();
    highlightContext.clearRect(0, 0, width, height);
  }
  transform.e -= x;
  transform.f -= y;
  highlightContext.setTransform(transform);
  drawStrokePath(highlightContext, object);
  const mask = highlightContext.getImageData(0, 0, width, height);
  const backdrop = context.getImageData(x, y, width, height);
  blendHighlight(backdrop.data, mask.data, object.color || "#ffffff");
  highlightContext.putImageData(backdrop, 0, 0);

  context.save();
  context.resetTransform();
  const patch = new Path2D();
  patch.rect(x, y, width, height);
  context.clip(patch);
  context.globalCompositeOperation = "copy";
  context.drawImage(highlightMask, x, y);
  context.restore();
}
