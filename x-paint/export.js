"use strict";

function renderPng(width, height, render) {
  const scale = Math.min(1, 4096 / Math.max(width, height));
  const output = document.createElement("canvas");
  output.width = Math.ceil(width * scale);
  output.height = Math.ceil(height * scale);
  const context = output.getContext("2d");
  context.scale(scale, scale);
  render(context);
  return new Promise((resolve, reject) => {
    output.toBlob(blob => blob ? resolve(blob) : reject(new Error("Canvas export failed")), "image/png");
  });
}

function wholeArea(objects, padding) {
  const bounds = sceneBounds(objects);
  const left = Math.floor(bounds.left) - padding;
  const top = Math.floor(bounds.top) - padding;
  return {
    x: -left,
    y: -top,
    width: Math.ceil(bounds.right) + padding - left,
    height: Math.ceil(bounds.bottom) + padding - top,
    zoom: 1,
  };
}

function drawPreviewBackground(context, width, height, style) {
  context.save();
  // The canvas grid sits behind the artwork, including its translucent marker strokes.
  context.globalCompositeOperation = "destination-over";
  const grids = [
    ["--preview-grid-step", "--preview-grid-fine"],
    ["--preview-grid-major-step", "--preview-grid-coarse"],
  ];
  for (const [stepProperty, colorProperty] of grids) {
    const step = parseFloat(style.getPropertyValue(stepProperty));
    const tile = document.createElement("canvas");
    tile.width = tile.height = step;
    const tileContext = tile.getContext("2d");
    tileContext.fillStyle = style.getPropertyValue(colorProperty).trim();
    tileContext.fillRect(0, 0, step, 1);
    tileContext.fillRect(0, 0, 1, step);
    const x = Math.floor((width - step) / 2);
    const y = Math.floor((height - step) / 2);
    context.save();
    context.translate(x, y);
    context.fillStyle = context.createPattern(tile, "repeat");
    context.fillRect(-x, -y, width, height);
    context.restore();
  }

  context.translate(width * 0.52, height * 0.46);
  context.scale(width * 0.52 * Math.SQRT2, height * 0.54 * Math.SQRT2);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 0.76);
  gradient.addColorStop(0, style.getPropertyValue("--preview-center").trim());
  gradient.addColorStop(1, style.getPropertyValue("--preview-edge").trim());
  context.fillStyle = gradient;
  context.fillRect(-1, -1, 2, 2);
  context.restore();
}

function drawPreviewCorners(context, width, height, style, cornerSize) {
  const inset = parseFloat(style.getPropertyValue("--preview-corner-inset"));
  const length = Math.min(cornerSize + 1, Math.max(1, Math.min(width, height) / 2 - inset));
  context.fillStyle = style.getPropertyValue("--preview-corner").trim();
  context.fillRect(inset, inset, length, 1);
  context.fillRect(inset, inset, 1, length);
  context.fillRect(width - inset - length, height - inset - 1, length, 1);
  context.fillRect(width - inset - 1, height - inset - length, 1, length);
}

function framedImage(objects, area, stage) {
  const style = getComputedStyle(stage);
  const border = parseFloat(style.borderTopWidth);
  const cornerSize = parseFloat(getComputedStyle(stage, "::before").width);
  const { x, y, width, height, zoom } = area;
  const frameWidth = width + border * 2;
  const frameHeight = height + border * 2;

  return renderPng(frameWidth, frameHeight, context => {
    context.save();
    context.translate(border, border);
    context.beginPath();
    context.rect(0, 0, width, height);
    context.clip();
    context.save();
    context.translate(x, y);
    context.scale(zoom, zoom);
    objects.forEach(object => drawObject(context, object));
    context.restore();
    drawPreviewBackground(context, width, height, style);
    drawPreviewCorners(context, width, height, style, cornerSize);
    context.restore();
    context.save();
    context.resetTransform();
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = style.getPropertyValue("--preview-border").trim();
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    context.restore();
  });
}
