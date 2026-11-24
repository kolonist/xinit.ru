"use strict";

const stage = document.querySelector("#stage");
const canvas = document.querySelector("#drawing");
const context = canvas.getContext("2d");
const sceneCanvas = document.querySelector("#paint-scene");
const sceneContext = sceneCanvas.getContext("2d");
const emptyHint = document.querySelector("#empty-hint");
const toolHint = document.querySelector("#tool-hint");
const mousePanHint = document.querySelector("#mouse-pan-hint");
const feedback = document.querySelector(".paint-feedback");
const hintRow = document.querySelector(".paint-hints");
const status = document.querySelector("#status");
const app = document.querySelector(".paint-app");
const selectionActions = document.querySelector("#selection-actions");
const cropActions = document.querySelector("#crop-actions");
const fileInput = document.querySelector("#image-file");
const textContent = document.querySelector("#text-content");
const textActions = document.querySelector("#text-actions");
const exportOptions = document.querySelector("#export-options");
const exportVisible = document.querySelector("#export-visible");
const exportAll = document.querySelector("#export-all");
const palettePopup = document.querySelector("#palette-popup");
const strokePopup = document.querySelector("#stroke-popup");
const lineStylePopup = document.querySelector("#line-style-popup");
const lineStyleInputs = [...lineStylePopup.querySelectorAll("input")];
const mixedLineStyles = lineStylePopup.querySelector(".line-style-mixed");
const lineStyleLabels = { solid: "lineStyleSolid", dashed: "lineStyleDashCaption", dotted: "lineStyleDotted" };
const strokeSliders = [...strokePopup.querySelectorAll("input")].map(input => ({
  kind: input.id === "marker-weight" ? "marker" : "stroke",
  input,
  output: input.parentElement.querySelector("output"),
  sample: input.parentElement.querySelector(".stroke-sample"),
}));
const noFill = document.querySelector("#no-fill");
const transparencyInput = document.querySelector("#fill-transparency");
const transparencyValue = document.querySelector("#fill-transparency-value");
const transparencyControls = transparencyInput.closest(".fill-transparency");
const clearDialog = document.querySelector("#clear-dialog");
const touchLayout = window.matchMedia("(pointer: coarse)");
const appleKeyboard = /^(Mac|iP)/i.test(navigator.userAgentData?.platform || navigator.platform);
const modifierKey = appleKeyboard ? "Meta" : "Control";
const modifierLabel = appleKeyboard ? "Cmd" : "Ctrl";

textContent.style.font = paintFont;
textContent.style.lineHeight = `${paintLineHeight}px`;

const colors = [
  ["ice", "#def2ff"], ["cyan", "#9ceaff"], ["blue", "#26b9ff"], ["mint", "#91f8c2"],
  ["amber", "#ffbe79"], ["lemon", "#fff17a"], ["pink", "#ff83b7"], ["lilac", "#c8a8ff"],
  ["white", "#ffffff"], ["silver", "#bbc6d2"], ["slate", "#687b91"], ["graphite", "#252c35"],
  ["black", "#080a0d"], ["navy", "#0b2943"], ["deepBlue", "#173f8f"], ["teal", "#135865"],
  ["forest", "#235337"], ["olive", "#55501d"], ["brown", "#633b29"], ["burgundy", "#672239"],
  ["plum", "#482661"], ["red", "#e95558"], ["orange", "#ec8545"], ["green", "#57ba78"],
];
const toolButtons = new Map();
const swatches = new Map();
const objects = [];
const selection = new Set();
const undoHistory = [];
const undoLimit = 42;
const editableProperties = ["x", "y", "scaleX", "scaleY", "angle", "shear", "color", "fill",
  "fillTransparency", "groupId", "text", "source", "weight", "end", "lineStyle"];
const propertyDefaults = { angle: 0, shear: 0, fill: null, fillTransparency: 0 };
let committedObjects = [];
const view = { x: 0, y: 0, zoom: 1 };
const pointers = new Map();
const laserDuration = 850;
let laserPoints = [];
let laserStroke = 0;
let language = "ru";
let activeTool = "brush";
const defaultColors = { color: colors[0][1], backgroundColor: "#0b2943", fillEnabled: false, fillTransparency: 0 };
let { color, backgroundColor, fillEnabled, fillTransparency } = defaultColors;
const defaultStrokeWeights = { stroke: defaultStrokeWeight, marker: defaultMarkerWeight };
const strokeWeights = { ...defaultStrokeWeights };
let lineStyle = "solid";
let paletteTarget = null;
let openSettings = null;
let database;
let sceneGeneration = 0;
let crop = null;
let gesture = null;
let draft = null;
let spaceHeld = false;
let textEdit = null;
let statusKey = "";
let statusTimeout;
let frame = 0;
let renderedView = null;
let sceneDirty = true;
let markerPreview = null;
let overlayRegions = [];
let viewPreviewTimer;
let viewSaveTimer;
const objectClipboardType = "application/x-x-paint-objects";
let localClipboardObjects = null;
let localClipboardImage = null;
let canvasPointer = null;
let pngAction = null;

function label(key) {
  return paintTranslations[key][language === "ru" ? 0 : 1].replace("{modifier}", modifierLabel);
}

function primaryModifier(event) {
  return appleKeyboard ? event.metaKey : event.ctrlKey;
}

function addButton(group, key, onClick, icon = key) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tool-button";
  button.dataset.i18nLabel = key;
  button.dataset.i18nTitle = key;
  if (paintIcons[icon]) {
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paintIcons[icon]}</svg>`;
  }
  button.addEventListener("click", onClick);
  group.append(button);
  return button;
}

const drawingTools = document.querySelector("#drawing-tools");
for (const name of ["select", "pan", "brush", "marker", "line", "arrow", "rect", "circle", "text"]) {
  toolButtons.set(name, addButton(drawingTools, name, () => setTool(name)));
}

const colorPair = document.querySelector("#color-pair");
const foregroundSquare = addButton(colorPair, "foreground", () => togglePalette("foreground"));
const backgroundSquare = addButton(colorPair, "background", () => togglePalette("background"));
for (const [square, name] of [[foregroundSquare, "foreground"], [backgroundSquare, "background"]]) {
  square.classList.add("color-square", name + "-square");
  square.setAttribute("aria-controls", palettePopup.id);
}
const swapColors = addButton(colorPair, "swapColors", () => {
  [color, backgroundColor] = [backgroundColor, color];
  applyPaintColors(true, true);
});
swapColors.classList.add("swap-colors");

const palette = document.querySelector("#palette");
for (const [name, value] of colors) {
  const swatch = addButton(palette, name, () => {
    if (paletteTarget === "background") {
      backgroundColor = value;
      fillEnabled = true;
      applyPaintColors(false, true);
    } else {
      color = value;
      applyPaintColors(true, false);
    }
    closePalette(true);
  });
  swatch.style.setProperty("--swatch", value);
  swatches.set(value, swatch);
}

noFill.addEventListener("click", () => {
  fillEnabled = false;
  applyPaintColors(false, true);
  closePalette(true);
});

transparencyInput.addEventListener("input", () => {
  fillTransparency = transparencyInput.valueAsNumber;
  fillEnabled = true;
  cancelGesture();
  for (const object of selection) {
    if (!isFillable(object)) continue;
    object.fill ??= backgroundColor;
    object.fillTransparency = fillTransparency;
  }
  updateControls();
  requestSceneDraw();
});
transparencyInput.addEventListener("change", () => commitSceneEdit());

const strokeTools = document.querySelector(".stroke-tools");
addSettingsButton("strokeWidth", strokePopup, () => {
  const kind = strokeKind(singleSelection()?.type ?? activeTool);
  return strokeSliders.find(slider => slider.kind === kind).input;
});
const lineStyleButton = addSettingsButton("lineStyle", lineStylePopup, () =>
  lineStyleInputs.find(input => input.checked) || lineStyleInputs[0]);
const lineStyleCaption = lineStyleButton.querySelector("span");
lineStylePopup.addEventListener("change", event => {
  lineStyle = event.target.value;
  cancelGesture();
  for (const object of selection) {
    if (hasLineStyle(object)) object.lineStyle = lineStyle;
  }
  updateControls();
  requestDraw();
  commitSceneEdit();
});
for (const { kind, input } of strokeSliders) {
  input.addEventListener("input", () => {
    const weight = input.valueAsNumber;
    strokeWeights[kind] = weight;
    cancelGesture();
    for (const object of selection) {
      if (object.weight !== undefined && strokeKind(object.type) === kind && object.weight !== weight) {
        setStrokeWeight(object, weight);
      }
    }
    updateControls();
    requestSceneDraw();
  });
  input.addEventListener("change", () => commitSceneEdit());
}

const actions = document.querySelector("#actions");
const undoButton = addButton(actions, "undo", undoEdit);
const copyButton = addButton(actions, "copy", () => showExportOptions("copy"));
addButton(actions, "paste", pasteImage);
addButton(actions, "image", () => fileInput.click());
const downloadButton = addButton(actions, "download", () => showExportOptions("download"));
const exportTriggers = { copy: copyButton, download: downloadButton };
for (const button of Object.values(exportTriggers)) {
  button.setAttribute("aria-controls", exportOptions.id);
  button.setAttribute("aria-expanded", "false");
}
toolButtons.set("laser", addButton(actions, "laser", () => setTool("laser")));
const clearButton = addButton(actions, "clear", () => {
  clearDialog.returnValue = "";
  clearDialog.showModal();
});
exportVisible.addEventListener("click", () => exportImage(false));
exportAll.addEventListener("click", () => exportImage(true));

const editButton = addButton(selectionActions, "edit", () => openTextEditor(singleSelection()));
const cropButton = addButton(selectionActions, "crop", () => {
  crop = { ...singleSelection().bounds };
  updateControls();
  canvas.focus({ preventScroll: true });
  requestDraw();
});
const rotateButton = addButton(selectionActions, "rotate", rotateQuarterTurn);
const backButton = addButton(selectionActions, "sendToBack", () => moveLayers(-1, true));
const lowerButton = addButton(selectionActions, "lower", () => moveLayers(-1));
const raiseButton = addButton(selectionActions, "raise", () => moveLayers(1));
const frontButton = addButton(selectionActions, "bringToFront", () => moveLayers(1, true));
const groupButton = addButton(selectionActions, "group", groupSelection);
const ungroupButton = addButton(selectionActions, "ungroup", ungroupSelection);
addButton(selectionActions, "remove", deleteSelection);
addButton(cropActions, "apply", () => finishCrop(true));
addButton(cropActions, "cancel", () => finishCrop(false));
addButton(textActions, "apply", () => finishTextEdit(true, true));
addButton(textActions, "cancel", () => finishTextEdit(false, true));

const zoomTools = document.querySelector("#zoom-tools");
const zoomOutButton = addButton(zoomTools, "zoomOut", () => zoomAt(viewCenter(), view.zoom / 1.25));
const zoomButton = addButton(zoomTools, "resetZoom", () => zoomAt(viewCenter(), 1));
const zoomInButton = addButton(zoomTools, "zoomIn", () => zoomAt(viewCenter(), view.zoom * 1.25));

function setTool(tool) {
  finishTextEdit(true);
  cancelGesture();
  crop = null;
  if (tool !== "select") selection.clear();
  activeTool = tool;
  updateControls();
  requestDraw();
}

function singleSelection() {
  return selection.size === 1 ? selection.values().next().value : null;
}

function selectedSegment() {
  const object = singleSelection();
  return isSegment(object) ? object : null;
}

function hasLineStyle(object) {
  return Boolean(object && (object.type === "brush" || isSegment(object) || isFillable(object)));
}

function setSelection(items) {
  selection.clear();
  const groups = new Set();
  for (const object of items) {
    selection.add(object);
    if (object.groupId) groups.add(object.groupId);
  }
  if (groups.size) {
    for (const object of objects) {
      if (groups.has(object.groupId)) selection.add(object);
    }
  }
  const object = singleSelection();
  if (object?.color) color = object.color;
  if (object?.weight !== undefined) strokeWeights[strokeKind(object.type)] = object.weight;
  if (hasLineStyle(object)) lineStyle = object.lineStyle;
  if (object && isFillable(object)) {
    fillEnabled = Boolean(object.fill);
    if (object.fill) {
      backgroundColor = object.fill;
      fillTransparency = object.fillTransparency ?? 0;
    }
  }
  updateControls();
  requestDraw();
}

function toggleSelection(object) {
  if (!object) return;
  const items = new Set(selection);
  if (items.has(object)) {
    items.delete(object);
    if (object.groupId) {
      for (const member of items) {
        if (member.groupId === object.groupId) items.delete(member);
      }
    }
  } else items.add(object);
  activeTool = "select";
  setSelection(items);
}

function newGroupId() {
  return crypto.getRandomValues(new Uint32Array(4)).join("-");
}

function groupSelection() {
  if (groupButton.hidden) return;
  cancelGesture();
  const groupId = newGroupId();
  for (const object of selection) object.groupId = groupId;
  finishGrouping("grouped");
}

function ungroupSelection() {
  if (ungroupButton.hidden) return;
  cancelGesture();
  for (const object of selection) delete object.groupId;
  finishGrouping("ungrouped");
}

function finishGrouping(message) {
  updateControls();
  requestDraw();
  commitSceneEdit();
  canvas.focus({ preventScroll: true });
  announce(message);
}

function setShapeFill(object) {
  object.fill = fillEnabled ? backgroundColor : null;
  object.fillTransparency = fillTransparency;
}

function applyPaintColors(changeForeground, changeBackground) {
  cancelGesture();
  for (const object of selection) {
    if (changeForeground && object.type !== "image") object.color = color;
    if (changeBackground && isFillable(object)) setShapeFill(object);
  }
  updateControls();
  requestDraw();
  commitSceneEdit();
}

function paletteAnchor() {
  return paletteTarget === "background" ? backgroundSquare : foregroundSquare;
}

function positionPopup(popup, button) {
  const anchor = button.getBoundingClientRect();
  const left = Math.min(anchor.right + 8, window.innerWidth - popup.offsetWidth - 8);
  const top = Math.min(anchor.top, window.innerHeight - popup.offsetHeight - 8);
  popup.style.left = `${Math.max(8, left)}px`;
  popup.style.top = `${Math.max(8, top)}px`;
}

function positionPopups() {
  if (paletteTarget) positionPopup(palettePopup, paletteAnchor());
  if (openSettings) positionPopup(openSettings.popup, openSettings.button);
}

function togglePalette(target) {
  if (paletteTarget === target) {
    closePalette(true);
    return;
  }
  closeSettingsPopup();
  paletteTarget = target;
  palettePopup.hidden = false;
  updateColors();
  positionPopups();
  const choice = target === "foreground" ? swatches.get(color) : fillEnabled ? swatches.get(backgroundColor) : noFill;
  (choice || swatches.values().next().value).focus({ preventScroll: true });
}

function strokeKind(tool) {
  return tool === "marker" ? "marker" : "stroke";
}

function addSettingsButton(key, popup, focusControl) {
  const button = addButton(strokeTools, key, () => toggleSettingsPopup({ popup, button, focusControl }));
  const caption = document.createElement("span");
  caption.dataset.i18n = key;
  button.append(caption);
  button.setAttribute("aria-controls", popup.id);
  button.setAttribute("aria-expanded", "false");
  return button;
}

function toggleSettingsPopup(settings) {
  if (openSettings?.popup === settings.popup) {
    closeSettingsPopup(true);
    return;
  }
  closeSettingsPopup();
  closePalette();
  openSettings = settings;
  const { popup, button, focusControl } = settings;
  popup.hidden = false;
  button.setAttribute("aria-expanded", "true");
  positionPopups();
  focusControl().focus({ preventScroll: true });
}

function closeSettingsPopup(restoreFocus = false) {
  if (!openSettings) return;
  const { popup, button } = openSettings;
  openSettings = null;
  popup.hidden = true;
  button.setAttribute("aria-expanded", "false");
  if (restoreFocus) button.focus({ preventScroll: true });
}

function closePalette(restoreFocus = false) {
  if (!paletteTarget) return;
  const anchor = paletteAnchor();
  paletteTarget = null;
  palettePopup.hidden = true;
  updateColors();
  if (restoreFocus) anchor.focus({ preventScroll: true });
}

function updateColors() {
  foregroundSquare.style.setProperty("--swatch", color);
  const alpha = Math.round(255 * (1 - fillTransparency / 100)).toString(16).padStart(2, "0");
  backgroundSquare.style.setProperty("--swatch", fillEnabled ? backgroundColor + alpha : backgroundColor);
  backgroundSquare.toggleAttribute("data-empty", !fillEnabled);
  foregroundSquare.setAttribute("aria-expanded", String(paletteTarget === "foreground"));
  backgroundSquare.setAttribute("aria-expanded", String(paletteTarget === "background"));
  noFill.hidden = paletteTarget !== "background";
  noFill.setAttribute("aria-pressed", String(!fillEnabled));
  transparencyControls.hidden = paletteTarget !== "background";
  transparencyInput.value = fillTransparency;
  transparencyInput.setAttribute("aria-valuetext", `${fillTransparency}%`);
  transparencyValue.value = `${fillTransparency}%`;
  const choice = paletteTarget === "background" ? (fillEnabled ? backgroundColor : null) : color;
  swatches.forEach((button, value) => button.setAttribute("aria-pressed", String(choice === value)));
}

function updateControls() {
  canvas.dataset.tool = spaceHeld ? "pan" : activeTool;
  canvas.toggleAttribute("data-panning", gesture?.kind === "pan" || gesture?.kind === "pinch");
  mousePanHint.hidden = touchLayout.matches;
  canvas.setAttribute("aria-describedby", touchLayout.matches ? "tool-hint" : "tool-hint mouse-pan-hint");
  toolButtons.forEach((button, tool) => button.setAttribute("aria-pressed", String(activeTool === tool)));
  updateColors();
  for (const { kind, input, output, sample } of strokeSliders) {
    const weight = strokeWeights[kind];
    input.value = weight;
    input.setAttribute("aria-valuetext", `${weight} px`);
    output.value = `${weight} px`;
    sample.style.setProperty("--stroke-diameter", `${weight}px`);
  }
  const selectedStyles = new Set([...selection].filter(hasLineStyle).map(object => object.lineStyle));
  const displayedStyle = selectedStyles.size > 1 ? null : [...selectedStyles][0] ?? lineStyle;
  for (const input of lineStyleInputs) input.checked = input.value === displayedStyle;
  mixedLineStyles.hidden = displayedStyle !== null;
  const buttonStyle = displayedStyle ?? lineStyle;
  const styleName = label(lineStyleLabels[buttonStyle]);
  const styleButtonName = `${label("lineStyle")} (${styleName})`;
  lineStyleButton.dataset.lineStyle = buttonStyle;
  lineStyleCaption.textContent = styleName;
  lineStyleButton.setAttribute("aria-label", styleButtonName);
  lineStyleButton.title = styleButtonName;
  exportAll.disabled = clearButton.disabled = objects.length === 0 && !textEdit;
  undoButton.disabled = undoHistory.length === 0;
  const object = singleSelection();
  selectionActions.hidden = !selection.size || Boolean(crop || textEdit);
  cropActions.hidden = !crop;
  textActions.hidden = !textEdit;
  editButton.hidden = object?.type !== "text";
  cropButton.hidden = object?.type !== "image";
  rotateButton.hidden = Boolean(selectedSegment());
  const groupId = selection.values().next().value?.groupId;
  groupButton.hidden = selection.size < 2 || Boolean(groupId && [...selection].every(item => item.groupId === groupId));
  ungroupButton.hidden = ![...selection].some(item => item.groupId);
  backButton.disabled = lowerButton.disabled = !canMoveLayers(-1);
  frontButton.disabled = raiseButton.disabled = !canMoveLayers(1);
  emptyHint.hidden = objects.length > 0 || Boolean(draft || textEdit) || laserPoints.length > 0;
  updateZoomControls();
  const hints = {
    select: touchLayout.matches ? "marqueeHint" : "clickSelectionHint",
    text: "textHint",
    pan: touchLayout.matches ? "touchPanHint" : "panHint",
    line: touchLayout.matches ? "touchDrawHint" : "segmentHint",
    arrow: touchLayout.matches ? "touchDrawHint" : "segmentHint",
    rect: touchLayout.matches ? "touchDrawHint" : "shapeHint",
    circle: touchLayout.matches ? "touchDrawHint" : "shapeHint",
  };
  let hint = hints[activeTool] || (touchLayout.matches ? "touchDrawHint" : "drawHint");
  if (selectedSegment()) hint = touchLayout.matches ? "endpointsHint" : "endpointsSnapHint";
  else if (selection.size) hint = touchLayout.matches ? "selectHint" : "resizeHint";
  if (crop) hint = "cropHint";
  if (textEdit) hint = "textEditHint";
  toolHint.textContent = label(hint);
}

function updateZoomControls() {
  zoomButton.textContent = `${Math.round(view.zoom * 100)}%`;
  zoomOutButton.disabled = view.zoom <= 0.1;
  zoomInButton.disabled = view.zoom >= 8;
}

function announce(key) {
  clearTimeout(statusTimeout);
  statusKey = key;
  status.textContent = label(key);
  statusTimeout = setTimeout(() => {
    statusKey = "";
    status.textContent = "";
  }, 4500);
}

function requestDraw() {
  if (!frame) frame = requestAnimationFrame(draw);
}

function requestSceneDraw() {
  sceneDirty = true;
  requestDraw();
}

function setViewTransform(target, pixelRatio, marginX = 0, marginY = 0) {
  const scale = pixelRatio * view.zoom;
  target.setTransform(scale, 0, 0, scale, pixelRatio * (view.x + marginX), pixelRatio * (view.y + marginY));
}

function drawScene(width, height, pixelRatio, editObject) {
  const marginX = Math.min(96, Math.round(width / 10));
  const marginY = Math.min(96, Math.round(height / 10));
  const sceneWidth = width + marginX * 2;
  const sceneHeight = height + marginY * 2;
  const pixelWidth = Math.round(sceneWidth * pixelRatio);
  const pixelHeight = Math.round(sceneHeight * pixelRatio);
  if (sceneCanvas.width !== pixelWidth || sceneCanvas.height !== pixelHeight) {
    sceneCanvas.width = pixelWidth;
    sceneCanvas.height = pixelHeight;
  }
  sceneCanvas.style.width = `${sceneWidth}px`;
  sceneCanvas.style.height = `${sceneHeight}px`;
  sceneCanvas.style.transform = `translate(${-marginX}px, ${-marginY}px)`;
  sceneContext.resetTransform();
  sceneContext.clearRect(0, 0, sceneCanvas.width, sceneCanvas.height);
  sceneContext.save();
  setViewTransform(sceneContext, pixelRatio, marginX, marginY);
  const viewport = {
    left: (-view.x - marginX - 1) / view.zoom,
    top: (-view.y - marginY - 1) / view.zoom,
    right: (width + marginX - view.x + 1) / view.zoom,
    bottom: (height + marginY - view.y + 1) / view.zoom,
  };
  for (const object of objects) {
    if (object === editObject) continue;
    // Text ink can extend beyond the advance widths used for selection.
    if (object.type !== "text") {
      const { left, top, right, bottom } = worldBounds(object);
      if (right < viewport.left || left > viewport.right ||
          bottom < viewport.top || top > viewport.bottom) continue;
    }
    drawObject(sceneContext, object);
  }
  sceneContext.restore();
  renderedView = { ...view, width, height, pixelRatio, editObject, marginX, marginY };
}

function previewCachedView(width, height) {
  if (viewPreviewTimer === undefined || draft || markerPreview) return false;
  const { x, y, zoom, marginX, marginY } = renderedView;
  const scale = view.zoom / zoom;
  const left = view.x - (x + marginX) * scale;
  const top = view.y - (y + marginY) * scale;
  // Reuse the padded bitmap while it covers the viewport at a usable scale.
  if (scale > 1.5 || left > 0 || top > 0 ||
      left + (width + marginX * 2) * scale < width ||
      top + (height + marginY * 2) * scale < height) return false;
  sceneCanvas.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
  return true;
}

function requestViewPreview() {
  clearTimeout(viewPreviewTimer);
  viewPreviewTimer = setTimeout(() => {
    viewPreviewTimer = undefined;
    requestDraw();
  }, 120);
  requestDraw();
}

function draw(now) {
  frame = 0;
  const { clientWidth: width, clientHeight: height } = canvas;
  if (!width || !height) return;
  const pixelRatio = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    overlayRegions = [];
    sceneDirty = true;
  }

  const editObject = textEdit?.isNew ? null : textEdit?.object ?? null;
  const needsRedraw = sceneDirty || !renderedView || renderedView.width !== width ||
    renderedView.height !== height || renderedView.pixelRatio !== pixelRatio || renderedView.editObject !== editObject;
  const viewChanged = renderedView &&
    (renderedView.x !== view.x || renderedView.y !== view.y || renderedView.zoom !== view.zoom);
  if (needsRedraw || (viewChanged && !previewCachedView(width, height))) {
    drawScene(width, height, pixelRatio, editObject);
    sceneDirty = false;
    markerPreview = null;
  } else if (!viewChanged) {
    sceneCanvas.style.transform = `translate(${-renderedView.marginX}px, ${-renderedView.marginY}px)`;
  }
  if (markerPreview) {
    sceneContext.putImageData(markerPreview.pixels, markerPreview.x, markerPreview.y);
    markerPreview = null;
  }
  if (draft?.type === "marker") {
    // The marker blends with the artwork. Keep its unmodified pixels for the next preview.
    sceneContext.save();
    setViewTransform(sceneContext, pixelRatio, renderedView.marginX, renderedView.marginY);
    markerPreview = drawHighlighter(sceneContext, draft, true);
    sceneContext.restore();
  }

  const showDraft = draft && draft.type !== "marker";
  const showSelection = selection.size > 0 && !textEdit && !draft;
  const showMarquee = gesture?.kind === "marquee";
  if (laserPoints.length) {
    laserPoints = laserPoints.filter(point => now - point.time < laserDuration);
    if (laserPoints.length) requestDraw();
    else updateControls();
  }
  // The overlay is transparent outside the regions painted in the previous frame.
  for (const { left, top, right, bottom } of overlayRegions) {
    context.clearRect(left, top, right - left, bottom - top);
  }
  overlayRegions = [];
  if (showDraft || showSelection || showMarquee || laserPoints.length) {
    const bounds = [];
    context.save();
    setViewTransform(context, pixelRatio);
    if (showDraft) {
      drawObject(context, draft);
      bounds.push(worldBounds(draft));
    }
    if (showSelection) bounds.push(...drawSelection());
    if (showMarquee) {
      drawMarquee(gesture.bounds);
      bounds.push(padBounds(gesture.bounds, 1 / view.zoom));
    }
    if (laserPoints.length) bounds.push(drawLaser(now));
    context.restore();
    overlayRegions = overlayPixelRegions(bounds, pixelRatio);
  }
  if (textEdit) positionTextEditor();
}

function overlayPixelRegions(regions, pixelRatio) {
  const scale = view.zoom * pixelRatio;
  const x = view.x * pixelRatio;
  const y = view.y * pixelRatio;
  const antialiasPadding = 2;
  return regions.map(({ left, top, right, bottom }) => ({
    left: Math.max(0, Math.floor(left * scale + x) - antialiasPadding),
    top: Math.max(0, Math.floor(top * scale + y) - antialiasPadding),
    right: Math.min(canvas.width, Math.ceil(right * scale + x) + antialiasPadding),
    bottom: Math.min(canvas.height, Math.ceil(bottom * scale + y) + antialiasPadding),
  })).filter(({ left, top, right, bottom }) => left < right && top < bottom);
}

function corners(bounds) {
  return [
    { x: bounds.left, y: bounds.top, horizontal: "left", vertical: "top" },
    { x: bounds.right, y: bounds.top, horizontal: "right", vertical: "top" },
    { x: bounds.right, y: bounds.bottom, horizontal: "right", vertical: "bottom" },
    { x: bounds.left, y: bounds.bottom, horizontal: "left", vertical: "bottom" },
  ];
}

function drawSelection() {
  const segment = selectedSegment();
  if (segment) return drawEndpoints(segment);
  const image = crop ? singleSelection() : null;
  const frame = image || selectionFrame();
  const bounds = crop || frame.bounds;
  const project = point => objectToWorld(frame, point);
  const handles = corners(bounds).map(project);
  const unit = 1 / view.zoom;
  context.save();
  if (image) {
    context.fillStyle = "#030913ad";
    context.beginPath();
    traceCorners(corners(image.bounds).map(project));
    traceCorners(handles);
    context.fill("evenodd");
  }
  context.strokeStyle = crop ? "#ffbe79" : "#9ceaff";
  context.fillStyle = "#061324";
  context.lineWidth = unit;
  context.setLineDash([4 * unit, 3 * unit]);
  context.beginPath();
  traceCorners(handles);
  context.stroke();
  context.setLineDash([]);
  for (const { x, y } of handles) {
    context.fillRect(x - 3.5 * unit, y - 3.5 * unit, 7 * unit, 7 * unit);
    context.strokeRect(x - 3.5 * unit, y - 3.5 * unit, 7 * unit, 7 * unit);
  }
  if (!image) {
    const stem = project({ x: (bounds.left + bounds.right) / 2, y: bounds.top });
    const knob = project(rotationHandle(bounds));
    context.beginPath();
    context.moveTo(stem.x, stem.y);
    context.lineTo(knob.x, knob.y);
    context.stroke();
    context.beginPath();
    context.arc(knob.x, knob.y, 4.5 * unit, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.restore();
  const paintedBounds = image ? image.bounds : { ...bounds, top: rotationHandle(bounds).y };
  const paintedFrame = { ...frame, bounds: paintedBounds };
  return [padBounds(worldBounds(paintedFrame), 6 * unit)];
}

function segmentEndpoints(object) {
  return [objectToWorld(object, { x: 0, y: 0 }), objectToWorld(object, object.end)];
}

function drawEndpoints(object) {
  const unit = 1 / view.zoom;
  const points = segmentEndpoints(object);
  context.save();
  context.strokeStyle = "#9ceaff";
  context.fillStyle = "#061324";
  context.lineWidth = unit;
  for (const { x, y } of points) {
    context.beginPath();
    context.arc(x, y, 5 * unit, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.restore();
  return points.map(point => padBounds(rectangleBetween(point, point), 6 * unit));
}

function traceCorners([first, ...rest]) {
  context.moveTo(first.x, first.y);
  for (const point of rest) context.lineTo(point.x, point.y);
  context.closePath();
}

function drawMarquee({ left, top, right, bottom }) {
  const unit = 1 / view.zoom;
  context.save();
  context.fillStyle = "#26b9ff26";
  context.strokeStyle = "#9ceaff";
  context.lineWidth = unit;
  context.setLineDash([4 * unit, 3 * unit]);
  context.fillRect(left, top, right - left, bottom - top);
  context.strokeRect(left, top, right - left, bottom - top);
  context.restore();
}

function drawLaser(now) {
  const bounds = rectangleBetween(laserPoints[0], laserPoints[0]);
  context.save();
  context.lineCap = "round";
  context.lineWidth = 4 / view.zoom;
  context.strokeStyle = context.shadowColor = "#ff4376";
  context.shadowBlur = 8;
  laserPoints.forEach((point, index) => {
    const previous = laserPoints[index - 1];
    context.globalAlpha = Math.max(0, 1 - (now - point.time) / laserDuration);
    context.beginPath();
    if (previous?.stroke === point.stroke) {
      context.moveTo(previous.x, previous.y);
    } else {
      context.moveTo(point.x - 0.1 / view.zoom, point.y);
    }
    context.lineTo(point.x, point.y);
    context.stroke();
    bounds.left = Math.min(bounds.left, point.x);
    bounds.top = Math.min(bounds.top, point.y);
    bounds.right = Math.max(bounds.right, point.x);
    bounds.bottom = Math.max(bounds.bottom, point.y);
  });
  context.restore();
  return padBounds(bounds, 32 / view.zoom);
}

function screenPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

function worldPoint({ x, y }) {
  return { x: (x - view.x) / view.zoom, y: (y - view.y) / view.zoom };
}

function viewCenter() {
  return { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
}

function zoomAt(anchor, nextZoom, point = worldPoint(anchor)) {
  view.zoom = Math.max(0.1, Math.min(8, nextZoom));
  view.x = anchor.x - point.x * view.zoom;
  view.y = anchor.y - point.y * view.zoom;
  updateZoomControls();
  requestViewPreview();
  if (!gesture) {
    clearTimeout(viewSaveTimer);
    viewSaveTimer = setTimeout(persistScene, 180);
  }
}

function objectAt(point) {
  return objects.findLast(object => objectContainsPoint(context, object, point, 6 / view.zoom));
}

function handleAt(bounds, point, tolerance = 12, object = null) {
  const handles = corners(bounds);
  let nearest = tolerance / view.zoom;
  let hit = null;
  handles.forEach((handle, index) => {
    const distance = distanceBetween(point, object ? objectToWorld(object, handle) : handle);
    if (distance >= nearest) return;
    nearest = distance;
    hit = { handle, fixed: handles[(index + 2) % 4] };
  });
  return hit;
}

function selectionFrame() {
  // Canvas order gives the same reference object regardless of which group member was clicked.
  const reference = objects.find(object => selection.has(object));
  const frame = { x: reference.x, y: reference.y, angle: reference.angle ?? 0, scaleX: 1, scaleY: 1 };
  const projected = [...selection].map(object => ({
    ...object,
    ...worldToObject(frame, object),
    angle: (object.angle ?? 0) - frame.angle,
  }));
  return { ...frame, bounds: sceneBounds(projected) };
}

function startResize(point, drawing) {
  if (!selection.size || selectedSegment()) return null;
  const frame = selectionFrame();
  const { bounds } = frame;
  // Leave space for closely spaced brush strokes while a drawing tool is active.
  if (drawing && Math.min(bounds.right - bounds.left, bounds.bottom - bounds.top) * view.zoom < 16) return null;
  const hit = handleAt(bounds, point, drawing ? 6 : 12, frame);
  return hit ? {
    kind: "resize", ...hit, frame, transforms: selectionTransforms(), start: worldToObject(frame, point),
  } : null;
}

function startEndpointDrag(point, additive) {
  const object = selectedSegment();
  if (!object) return null;
  const [startHandle, endHandle] = segmentEndpoints(object);
  const startDistance = distanceBetween(point, startHandle);
  const endDistance = distanceBetween(point, endHandle);
  const tolerance = (touchLayout.matches ? 16 : 10) / view.zoom;
  if (Math.min(startDistance, endDistance) > tolerance) return null;
  const movingStart = startDistance <= endDistance;
  return {
    kind: "endpoint", object, original: { ...object }, start: point,
    movingStart, handle: movingStart ? startHandle : endHandle, anchor: movingStart ? endHandle : startHandle,
    toggleObject: additive ? objectAt(point) : null,
  };
}

function restoreEndpoint({ object, original: { x, y, end, path, arrowhead, bounds } }) {
  Object.assign(object, { x, y, end, path, arrowhead, bounds });
}

function moveEndpoint(point, constrained) {
  const { object, original, start, handle, anchor, movingStart } = gesture;
  if (point.x === start.x && point.y === start.y) {
    restoreEndpoint(gesture);
    return;
  }
  const target = { x: handle.x + (point.x - start.x), y: handle.y + (point.y - start.y) };
  // Snap in canvas coordinates so existing rotation and scaling do not affect the angle.
  const endpoint = constrained ? snapSegmentEnd(anchor, target) : target;
  const local = worldToObject(original, endpoint);
  const end = movingStart
    ? { x: original.end.x - local.x, y: original.end.y - local.y }
    : local;
  // Keep the endpoints distinct so the segment and both handles stay reachable.
  if (Math.hypot(end.x, end.y) < 1e-6) return;
  if (movingStart) Object.assign(object, endpoint);
  setShapeEnd(object, end);
}

function startSelection(point, additive) {
  if (crop) {
    const object = singleSelection();
    const hit = handleAt(crop, point, 12, object);
    return hit ? {
      kind: "crop", ...hit, object, original: { ...crop }, limits: object.bounds, start: worldToObject(object, point),
    } : null;
  }
  const resize = startResize(point, false);
  if (resize) {
    if (additive) resize.toggleObject = objectAt(point);
    return resize;
  }
  const object = objectAt(point);
  if (additive) return { kind: "toggle", toggleObject: object };
  if (object) {
    if (!selection.has(object)) setSelection([object]);
    return { kind: "move", transforms: selectionTransforms() };
  }
  setSelection([]);
  return { kind: "marquee", bounds: rectangleBetween(point, point) };
}

function selectionTransforms() {
  return [...selection].map(object => {
    const { x, y, scaleX, scaleY, angle = 0, shear = 0 } = object;
    return { object, x, y, scaleX, scaleY, angle, shear };
  });
}

function rotatePoint(point, center, angle) {
  const x = point.x - center.x;
  const y = point.y - center.y;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return { x: center.x + x * cosine - y * sine, y: center.y + x * sine + y * cosine };
}

function rotationHandle(bounds) {
  return { x: (bounds.left + bounds.right) / 2, y: bounds.top - 24 / view.zoom };
}

function rotationState(frame) {
  const { left, top, right, bottom } = frame.bounds;
  const center = objectToWorld(frame, { x: (left + right) / 2, y: (top + bottom) / 2 });
  return { kind: "rotate", center, orientation: frame.angle, transforms: selectionTransforms() };
}

function startRotation(point) {
  if (!selection.size || selectedSegment() || crop || textEdit) return null;
  const frame = selectionFrame();
  if (distanceBetween(point, objectToWorld(frame, rotationHandle(frame.bounds))) > 11 / view.zoom) return null;
  const rotation = rotationState(frame);
  rotation.bearing = Math.atan2(point.y - rotation.center.y, point.x - rotation.center.x);
  return rotation;
}

function rotateSelection(rotation, angle) {
  for (const original of rotation.transforms) {
    const origin = rotatePoint(original, rotation.center, angle);
    Object.assign(original.object, origin, { angle: original.angle + angle });
  }
}

function updateRotation(point, snap) {
  const { center, bearing, orientation } = gesture;
  if (distanceBetween(point, center) < 1 / view.zoom) return;
  const angle = Math.atan2(point.y - center.y, point.x - center.x) - bearing;
  const step = Math.PI / 4;
  rotateSelection(gesture, snap ? Math.round((orientation + angle) / step) * step - orientation : angle);
}

function rotateQuarterTurn() {
  if (!selection.size || selectedSegment()) return;
  cancelGesture();
  rotateSelection(rotationState(selectionFrame()), Math.PI / 2);
  updateControls();
  requestDraw();
  commitSceneEdit();
  canvas.focus({ preventScroll: true });
}

function resizeSelection(point, constrained) {
  const { transforms, fixed, handle, start, frame } = gesture;
  const local = worldToObject(frame, point);
  const dx = handle.x - fixed.x;
  const dy = handle.y - fixed.y;
  const proposedX = dx + local.x - start.x;
  const proposedY = dy + local.y - start.y;
  const minSize = Math.min(6 / view.zoom, Math.abs(dx), Math.abs(dy));
  let ratioX = Math.max(minSize / Math.abs(dx), proposedX / dx);
  let ratioY = Math.max(minSize / Math.abs(dy), proposedY / dy);
  if (constrained) {
    const ratio = (proposedX * dx + proposedY * dy) / (dx * dx + dy * dy);
    ratioX = ratioY = Math.max(minSize / Math.min(Math.abs(dx), Math.abs(dy)), ratio);
  }
  for (const original of transforms) {
    const { object, scaleX, scaleY, angle, shear } = original;
    const relativeAngle = angle - frame.angle;
    if (ratioX === ratioY || !relativeAngle) {
      object.angle = angle;
      object.scaleX = scaleX * ratioX;
      object.scaleY = scaleY * ratioY;
      object.shear = shear * ratioX;
    } else {
      // Decompose the resized basis so rotation and free resizing compose without losing geometry.
      const { a, b, c, d } = objectMatrix({ ...original, angle: relativeAngle });
      const horizontal = { x: a * ratioX, y: b * ratioY };
      const vertical = { x: c * ratioX, y: d * ratioY };
      const length = Math.hypot(horizontal.x, horizontal.y);
      object.angle = frame.angle + Math.atan2(horizontal.y, horizontal.x);
      object.scaleX = length;
      object.scaleY = scaleX * scaleY * ratioX * ratioY / length;
      object.shear = (horizontal.x * vertical.x + horizontal.y * vertical.y) / length;
    }
    const origin = worldToObject(frame, original);
    Object.assign(object, objectToWorld(frame, {
      x: fixed.x + (origin.x - fixed.x) * ratioX,
      y: fixed.y + (origin.y - fixed.y) * ratioY,
    }));
  }
}

function resizeCrop(point) {
  const { fixed, handle, limits, original, start, object } = gesture;
  const local = worldToObject(object, point);
  const x = handle.x + local.x - start.x;
  const y = handle.y + local.y - start.y;
  const { a, b, c, d } = objectMatrix(object);
  const minWidth = Math.min(6 / (view.zoom * Math.hypot(a, b)), original.right - original.left);
  const minHeight = Math.min(6 / (view.zoom * Math.hypot(c, d)), original.bottom - original.top);
  crop[handle.horizontal] = handle.horizontal === "left"
    ? Math.max(limits.left, Math.min(fixed.x - minWidth, x))
    : Math.min(limits.right, Math.max(fixed.x + minWidth, x));
  crop[handle.vertical] = handle.vertical === "top"
    ? Math.max(limits.top, Math.min(fixed.y - minHeight, y))
    : Math.min(limits.bottom, Math.max(fixed.y + minHeight, y));
}

function deleteSelection() {
  if (!selection.size) return;
  cancelGesture();
  for (let index = objects.length - 1; index >= 0; index--) {
    if (selection.has(objects[index])) objects.splice(index, 1);
  }
  crop = null;
  setSelection([]);
  canvas.focus({ preventScroll: true });
  commitSceneEdit();
}

function canMoveLayers(direction) {
  return selection.size && objects.some((object, index) => {
    const neighbor = objects[index + direction];
    return neighbor && selection.has(object) && !selection.has(neighbor);
  });
}

function moveLayers(direction, toEdge = false) {
  cancelGesture();
  const front = direction > 0;
  if (toEdge) {
    const chosen = objects.filter(object => selection.has(object));
    const remaining = objects.filter(object => !selection.has(object));
    const reordered = front ? remaining.concat(chosen) : chosen.concat(remaining);
    reordered.forEach((object, index) => { objects[index] = object; });
  } else {
    for (let index = front ? objects.length - 2 : 1;
      front ? index >= 0 : index < objects.length;
      index -= direction) {
      const neighbor = index + direction;
      if (selection.has(objects[index]) && !selection.has(objects[neighbor])) {
        [objects[index], objects[neighbor]] = [objects[neighbor], objects[index]];
      }
    }
  }
  updateControls();
  requestDraw();
  commitSceneEdit();
}

function finishCrop(apply) {
  if (!crop) return;
  cancelGesture();
  const object = singleSelection();
  const changed = apply && Object.keys(crop).some(edge => crop[edge] !== object.bounds[edge]);
  if (changed) applyImageCrop(object, crop);
  crop = null;
  updateControls();
  canvas.focus({ preventScroll: true });
  requestDraw();
  if (changed) commitSceneEdit();
}

function pushLaser(point) {
  laserPoints.push({ ...point, time: performance.now(), stroke: laserStroke });
}

function pinchGeometry() {
  const [first, second] = pointers.values();
  return {
    center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    distance: Math.max(1, distanceBetween(first, second)),
  };
}

function startPointer(event) {
  if (event.button < 0 || event.button > 2) return;
  event.preventDefault();
  finishTextEdit(true);
  const screen = screenPoint(event);
  const point = worldPoint(screen);
  canvas.setAttribute("data-pointer-focus", "");
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, screen);

  if (pointers.size > 1) {
    if (pointers.size === 2) {
      cancelGesture();
      const { center, distance } = pinchGeometry();
      gesture = { kind: "pinch", distance, zoom: view.zoom, anchor: worldPoint(center) };
      updateControls();
      requestDraw();
    }
    return;
  }

  const pan = spaceHeld || event.button !== 0 || activeTool === "pan";
  const endpoint = !pan && activeTool !== "laser" ? startEndpointDrag(point, primaryModifier(event)) : null;
  const rotation = !pan && activeTool !== "laser" ? startRotation(point) : null;
  const resize = !pan && !["select", "laser", "text"].includes(activeTool)
    ? startResize(point, true) : null;
  if (pan) {
    gesture = { kind: "pan", id: event.pointerId, start: screen, x: view.x, y: view.y };
  } else if (endpoint) {
    gesture = { ...endpoint, id: event.pointerId };
  } else if (rotation) {
    gesture = { ...rotation, id: event.pointerId };
  } else if (activeTool === "select") {
    gesture = startSelection(point, primaryModifier(event));
    if (gesture) Object.assign(gesture, { id: event.pointerId, start: gesture.start ?? point });
  } else if (resize) {
    if (primaryModifier(event)) resize.toggleObject = objectAt(point);
    gesture = { ...resize, id: event.pointerId };
  } else if (activeTool === "text") {
    gesture = { kind: "text", id: event.pointerId, start: point };
  } else if (activeTool === "laser") {
    gesture = { kind: "laser", id: event.pointerId };
    laserStroke += 1;
    pushLaser(point);
  } else {
    const freehand = activeTool === "brush" || activeTool === "marker";
    const weight = strokeWeights[strokeKind(activeTool)];
    draft = freehand ? createStroke(activeTool, point, color, weight) : createObject(activeTool, point, color);
    if (hasLineStyle(draft)) draft.lineStyle = lineStyle;
    if (isFillable(draft)) setShapeFill(draft);
    if (!freehand) {
      draft.weight = weight;
      updateShape(draft, point);
    }
    gesture = { kind: freehand ? "stroke" : "shape", start: point, id: event.pointerId };
  }

  updateControls();
  requestDraw();
}

function movePointer(event) {
  if (!pointers.has(event.pointerId)) return;
  const screen = screenPoint(event);
  const point = worldPoint(screen);
  pointers.set(event.pointerId, screen);
  if (!gesture) return;
  if (gesture.kind === "pinch") {
    if (pointers.size >= 2) {
      const { center, distance } = pinchGeometry();
      zoomAt(center, gesture.zoom * distance / gesture.distance, gesture.anchor);
    }
    return;
  }
  if (gesture.id !== event.pointerId) return;

  switch (gesture.kind) {
    case "pan":
      view.x = gesture.x + screen.x - gesture.start.x;
      view.y = gesture.y + screen.y - gesture.start.y;
      requestViewPreview();
      return;
    case "move":
      for (const { object, x, y } of gesture.transforms) {
        object.x = x + point.x - gesture.start.x;
        object.y = y + point.y - gesture.start.y;
      }
      sceneDirty = true;
      break;
    case "resize":
      resizeSelection(point, primaryModifier(event));
      sceneDirty = true;
      break;
    case "endpoint":
      moveEndpoint(point, primaryModifier(event));
      sceneDirty = true;
      break;
    case "rotate":
      updateRotation(point, primaryModifier(event));
      sceneDirty = true;
      break;
    case "crop":
      resizeCrop(point);
      break;
    case "marquee":
      gesture.bounds = rectangleBetween(gesture.start, point);
      break;
    case "stroke":
      extendStroke(draft, point);
      break;
    case "shape":
      updateShape(draft, point, primaryModifier(event));
      break;
    case "laser":
      pushLaser(point);
      break;
  }
  requestDraw();
}

function cancelGesture() {
  if (gesture?.transforms) {
    for (const { object, ...transform } of gesture.transforms) Object.assign(object, transform);
  }
  if (gesture?.kind === "crop") crop = gesture.original;
  if (gesture?.kind === "endpoint") restoreEndpoint(gesture);
  if (gesture?.transforms || gesture?.kind === "endpoint") sceneDirty = true;
  gesture = null;
  draft = null;
}

function finishPointer(event, cancelled) {
  if (!pointers.has(event.pointerId)) return;
  if (!cancelled && gesture?.kind !== "pinch") movePointer(event);
  pointers.delete(event.pointerId);
  if (gesture?.kind === "pinch") {
    if (pointers.size < 2) {
      gesture = null;
      persistScene();
    }
    else {
      const { center, distance } = pinchGeometry();
      gesture = { kind: "pinch", distance, zoom: view.zoom, anchor: worldPoint(center) };
    }
  } else if (gesture?.id === event.pointerId) {
    if (cancelled) cancelGesture();
    else {
      const { kind, start, bounds, toggleObject } = gesture;
      const dragged = threshold => distanceBetween(start, worldPoint(screenPoint(event))) * view.zoom >= threshold;
      const clickedObject = primaryModifier(event) && (
        (kind === "stroke" && draft.points.length === 1) || kind === "shape" || kind === "text"
      ) && !dragged(2) ? objectAt(start) : null;
      if (clickedObject) {
        toggleSelection(clickedObject);
      } else if (kind === "stroke" || (kind === "shape" && dragged(2))) {
        objects.push(draft);
        setSelection([draft]);
        commitSceneEdit();
      }
      if (toggleObject && !dragged(2)) {
        cancelGesture();
        toggleSelection(toggleObject);
      }
      gesture = null;
      draft = null;
      if (kind === "text" && !clickedObject && !dragged(6)) {
        const object = objectAt(start);
        openTextEditor(object?.type === "text" ? object : null, start);
      }
      if (kind === "marquee" && dragged(3)) {
        setSelection(objects.filter(object => {
          const area = worldBounds(object);
          return containsPoint(bounds, { x: area.left, y: area.top }) &&
            containsPoint(bounds, { x: area.right, y: area.bottom });
        }));
      }
      if (kind === "move" || kind === "resize" || kind === "rotate" || kind === "endpoint") commitSceneEdit();
      if (kind === "pan") persistScene();
    }
  }
  updateControls();
  requestDraw();
}

function openTextEditor(object, point) {
  if (textEdit) return;
  textEdit = { object: object || createObject("text", point, color), isNew: !object };
  textContent.value = object?.text || "";
  textContent.style.color = textEdit.object.color;
  const ink = textEdit.object.color;
  const channels = [1, 3, 5].map(offset => parseInt(ink.slice(offset, offset + 2), 16));
  const brightness = channels[0] * 0.213 + channels[1] * 0.715 + channels[2] * 0.072;
  textContent.toggleAttribute("data-dark-ink", brightness < 120);
  textContent.hidden = false;
  positionTextEditor();
  textContent.focus({ preventScroll: true });
  textContent.setSelectionRange(textContent.value.length, textContent.value.length);
  updateControls();
  requestDraw();
}

function positionTextEditor() {
  const { object } = textEdit;
  const { clientWidth: width, clientHeight: height } = canvas;
  const scaleX = Math.max(0.5, object.scaleX * view.zoom);
  const scaleY = Math.min(height / paintLineHeight, Math.max(0.5, object.scaleY * view.zoom));
  if (!width || !height) return;
  const x = Math.max(0, Math.min(width - 44, view.x + object.x * view.zoom));
  const y = Math.max(0, Math.min(height - paintLineHeight * scaleY, view.y + object.y * view.zoom));
  const lines = textContent.value.split("\n");
  const contentWidth = Math.max(80, Math.ceil(textWidth(context, lines)) + 24);
  textContent.style.left = `${x}px`;
  textContent.style.top = `${y}px`;
  textContent.style.width = `${Math.min(contentWidth, (width - x) / scaleX)}px`;
  textContent.style.height = `${Math.min(lines.length * paintLineHeight, (height - y) / scaleY)}px`;
  const { a, b, c, d } = objectMatrix({ ...object, scaleX, scaleY, shear: (object.shear ?? 0) * view.zoom });
  textContent.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, 0, 0)`;
}

function finishTextEdit(apply, focusCanvas = false) {
  if (!textEdit) return;
  const { object, isNew } = textEdit;
  textEdit = null;
  textContent.hidden = true;
  const text = textContent.value;
  if (apply && text.trim()) {
    object.text = text;
    measureTextObject(context, object);
    if (isNew) objects.push(object);
    activeTool = "select";
    setSelection([object]);
    commitSceneEdit();
  } else {
    updateControls();
    requestDraw();
    persistScene();
  }
  if (focusCanvas) canvas.focus({ preventScroll: true });
}

textContent.addEventListener("input", () => {
  positionTextEditor();
  persistScene();
});
textContent.addEventListener("keydown", event => {
  if (event.isComposing) return;
  const apply = event.key === "Enter" && primaryModifier(event);
  if (!apply && event.key !== "Escape") return;
  event.preventDefault();
  finishTextEdit(apply, true);
});

textActions.addEventListener("pointerdown", event => {
  if (event.target.closest("button")) event.preventDefault();
});

for (const element of [textContent, textActions]) {
  element.addEventListener("focusout", event => {
    if (event.relatedTarget !== textContent && !textActions.contains(event.relatedTarget)) finishTextEdit(true);
  });
}

textActions.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.preventDefault();
    finishTextEdit(false, true);
  }
});

function insertObjects(items) {
  setTool("select");
  for (const object of items) objects.push(object);
  setSelection(items);
  canvas.focus({ preventScroll: true });
  commitSceneEdit();
}

function cloneObjects(items, offset) {
  const groupCopies = new Map();
  return items.map(object => {
    const copy = { ...object, x: object.x + offset.x, y: object.y + offset.y };
    if (object.groupId) {
      if (!groupCopies.has(object.groupId)) groupCopies.set(object.groupId, newGroupId());
      copy.groupId = groupCopies.get(object.groupId);
    }
    return copy;
  });
}

function pasteObjects(items) {
  const point = worldPoint(canvasPointer ? screenPoint(canvasPointer) : viewCenter());
  const { left, top, right, bottom } = sceneBounds(items);
  insertObjects(cloneObjects(items, {
    x: point.x - (left + right) / 2,
    y: point.y - (top + bottom) / 2,
  }));
}

async function importImage(blob, point = worldPoint(viewCenter())) {
  if (!blob || !blob.type.startsWith("image/")) {
    announce("imageError");
    return;
  }
  const generation = sceneGeneration;
  try {
    const image = await decodePaintImage(blob);
    if (generation !== sceneGeneration) return;
    const scale = Math.min(1, canvas.clientWidth * 0.72 / image.naturalWidth,
      canvas.clientHeight * 0.63 / image.naturalHeight) / view.zoom;
    insertObjects([createImageObject(image, blob, point, scale)]);
  } catch {
    if (generation === sceneGeneration) announce("imageError");
  }
}

async function pasteLocal() {
  const generation = sceneGeneration;
  const image = await localClipboardImage;
  if (!image || generation !== sceneGeneration) return false;
  await importImage(image);
  return true;
}

async function copyImage(full) {
  announce("copying");
  const png = capturePng(full);
  const localCopy = png.catch(() => null);
  localClipboardObjects = null;
  localClipboardImage = localCopy;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    if (localClipboardImage === localCopy) announce("copied");
  } catch {
    const image = await localCopy;
    if (localClipboardImage === localCopy) announce(image ? "copiedLocal" : "exportError");
  }
}

async function pasteImage() {
  const generation = sceneGeneration;
  try {
    const items = await navigator.clipboard.read();
    if (generation !== sceneGeneration) return;
    for (const item of items) {
      const type = item.types.find(format => format.startsWith("image/"));
      if (type) {
        const image = await item.getType(type);
        if (generation === sceneGeneration) await importImage(image);
        return;
      }
    }
  } catch {
    // A native paste event can still provide the image when clipboard.read is denied.
  }
  if (generation !== sceneGeneration) return;
  if (localClipboardObjects) {
    pasteObjects(localClipboardObjects.items);
    return;
  }
  const pasted = await pasteLocal();
  if (!pasted && generation === sceneGeneration) announce("pasteUnavailable");
}

function snapshotDrawing() {
  const previous = new Map(committedObjects.map(entry => [entry.object, entry]));
  return objects.map(object => {
    const entry = previous.get(object);
    if (entry && editableProperties.every(key =>
      (object[key] ?? propertyDefaults[key]) === (entry.state[key] ?? propertyDefaults[key]))) return entry;
    // Completed geometry and image data are shared; edits replace these values when needed.
    const state = { ...object, groupId: object.groupId, fill: object.fill, fillTransparency: object.fillTransparency,
      angle: object.angle, shear: object.shear };
    return { object, state };
  });
}

function commitSceneEdit(beforeClear = null) {
  const edited = snapshotDrawing();
  if (edited.length !== committedObjects.length || edited.some((entry, index) => entry !== committedObjects[index])) {
    undoHistory.push({ entries: committedObjects, beforeClear });
    if (undoHistory.length > undoLimit) undoHistory.shift();
    committedObjects = edited;
    undoButton.disabled = false;
    requestSceneDraw();
  }
  persistScene();
}

function undoEdit() {
  finishTextEdit(true);
  if (!undoHistory.length) return;
  cancelGesture();
  crop = null;
  sceneGeneration++;
  closePalette();
  closeSettingsPopup();
  setExportOptions(null);
  const { entries, beforeClear } = undoHistory.pop();
  const previousSelection = new Set(selection);
  objects.length = 0;
  for (const { object, state } of entries) {
    Object.assign(object, state);
    if (object.type === "text") measureTextObject(context, object);
    objects.push(object);
  }
  committedObjects = entries;
  if (beforeClear) {
    Object.assign(view, beforeClear.view);
    ({ color, backgroundColor, fillEnabled, fillTransparency } = beforeClear.colors);
    Object.assign(strokeWeights, beforeClear.strokeWeights);
    lineStyle = beforeClear.lineStyle;
  }
  if (!objects.length) activeTool = "brush";
  setSelection(objects.filter(object => previousSelection.has(object)));
  requestSceneDraw();
  persistScene();
  canvas.focus({ preventScroll: true });
  announce("undone");
}

function persistScene() {
  clearTimeout(viewSaveTimer);
  viewSaveTimer = undefined;
  if (!database) return;
  const savedObjects = objects.map(savePaintObject);
  if (textEdit && textContent.value.trim()) {
    const savedText = savePaintObject({ ...textEdit.object, text: textContent.value });
    if (textEdit.isNew) savedObjects.push(savedText);
    else savedObjects[objects.indexOf(textEdit.object)] = savedText;
  }
  savePaintScene(database, {
    objects: savedObjects,
    view: { ...view },
    color,
    backgroundColor,
    fillEnabled,
    fillTransparency,
    strokeWeights: { ...strokeWeights },
    lineStyle,
  }).catch(() => announce("saveError"));
}

async function restoreScene() {
  try {
    const storage = await openPaintStorage();
    const saved = await readPaintScene(storage);
    if (saved) {
      const restored = await Promise.all(saved.objects.map(object => restorePaintObject(object, context)));
      for (const object of restored) objects.push(object);
      Object.assign(view, saved.view);
      color = saved.color ?? color;
      backgroundColor = saved.backgroundColor ?? backgroundColor;
      fillEnabled = saved.fillEnabled ?? fillEnabled;
      fillTransparency = saved.fillTransparency ?? fillTransparency;
      Object.assign(strokeWeights, saved.strokeWeights);
      lineStyle = saved.lineStyle ?? lineStyle;
    }
    database = storage;
  } catch {
    announce("restoreError");
  } finally {
    committedObjects = snapshotDrawing();
    activeTool = objects.length ? "select" : "brush";
    app.inert = false;
    updateControls();
    requestSceneDraw();
  }
}

clearDialog.addEventListener("close", () => {
  if (clearDialog.returnValue !== "clear") return;
  sceneGeneration++;
  finishTextEdit(false);
  cancelGesture();
  const beforeClear = {
    view: { ...view },
    colors: { color, backgroundColor, fillEnabled, fillTransparency },
    strokeWeights: { ...strokeWeights },
    lineStyle,
  };
  crop = null;
  objects.length = 0;
  laserPoints.length = 0;
  Object.assign(view, { x: 0, y: 0, zoom: 1 });
  ({ color, backgroundColor, fillEnabled, fillTransparency } = defaultColors);
  Object.assign(strokeWeights, defaultStrokeWeights);
  lineStyle = "solid";
  activeTool = "brush";
  setSelection([]);
  commitSceneEdit(beforeClear);
  canvas.focus({ preventScroll: true });
});

function setExportOptions(action) {
  pngAction = action;
  exportOptions.hidden = !action;
  if (action) {
    exportOptions.dataset.i18nLabel = action;
    exportOptions.setAttribute("aria-label", label(action));
  }
  for (const [name, button] of Object.entries(exportTriggers)) {
    button.setAttribute("aria-expanded", String(name === action));
  }
}

function showExportOptions(action) {
  setExportOptions(pngAction === action ? null : action);
  if (pngAction) exportVisible.focus({ preventScroll: true });
}

function exportImage(full) {
  if (!pngAction) return;
  finishTextEdit(true);
  if (full && !objects.length) return;
  const action = pngAction;
  setExportOptions(null);
  exportTriggers[action].focus({ preventScroll: true });
  if (action === "copy") copyImage(full);
  else downloadImage(full);
}

async function capturePng(full) {
  const area = full ? wholeArea(objects, 24) : {
    ...view,
    width: canvas.clientWidth,
    height: canvas.clientHeight,
  };
  return framedImage(objects, area, stage);
}

async function downloadImage(full) {
  try {
    const url = URL.createObjectURL(await capturePng(full));
    const link = document.createElement("a");
    link.download = full ? "xinit-paint-full.png" : "xinit-paint-visible.png";
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    announce("exportError");
  }
}

canvas.addEventListener("pointerdown", startPointer);
canvas.addEventListener("blur", () => canvas.removeAttribute("data-pointer-focus"));
canvas.addEventListener("pointermove", event => {
  if (event.pointerType !== "touch") {
    canvasPointer = { clientX: event.clientX, clientY: event.clientY };
  }
  movePointer(event);
});
canvas.addEventListener("pointerleave", () => { canvasPointer = null; });
canvas.addEventListener("pointerup", event => finishPointer(event, false));
canvas.addEventListener("pointercancel", event => finishPointer(event, true));
canvas.addEventListener("lostpointercapture", event => finishPointer(event, true));
// Middle-button dragging uses the canvas instead of the browser's autoscroll.
for (const type of ["mousedown", "auxclick"]) {
  canvas.addEventListener(type, event => {
    if (event.button === 1) event.preventDefault();
  });
}
canvas.addEventListener("contextmenu", event => {
  if (event.button === 2 || gesture?.kind === "pan" || primaryModifier(event)) event.preventDefault();
});

canvas.addEventListener("wheel", event => {
  event.preventDefault();
  if (gesture) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1;
  const delta = Math.max(-160, Math.min(160, event.deltaY * unit));
  zoomAt(screenPoint(event), view.zoom * Math.exp(-delta * 0.003));
}, { passive: false });

canvas.addEventListener("dblclick", event => {
  if (activeTool !== "select" || crop || primaryModifier(event)) return;
  const object = objectAt(worldPoint(screenPoint(event)));
  if (object?.type === "text") openTextEditor(object);
});

canvas.addEventListener("keydown", event => {
  const { key } = event;
  if (key === "Meta" || key === "Control") return;
  canvas.removeAttribute("data-pointer-focus");
  if (key === "Escape") {
    cancelGesture();
    if (crop) finishCrop(false);
    else setSelection([]);
  } else if (key === " ") {
    spaceHeld = true;
    updateControls();
  } else if (key === "Enter" && crop) {
    finishCrop(true);
  } else if (key === "Enter" && singleSelection()?.type === "text") {
    openTextEditor(singleSelection());
  } else if (key === "Delete" || key === "Backspace") {
    deleteSelection();
  } else if (key === "[" || key === "]") {
    if (!objects.length || crop) return;
    const offset = key === "]" ? 1 : -1;
    let index = selection.size ? objects.indexOf(selection.values().next().value) : offset > 0 ? -1 : 0;
    for (let count = 0; count < objects.length; count++) {
      index = (index + offset + objects.length) % objects.length;
      if (selection.has(objects[index])) continue;
      setTool("select");
      setSelection([objects[index]]);
      break;
    }
  } else if (key === "+" || key === "-" || key === "=") {
    zoomAt(viewCenter(), view.zoom * (key === "-" ? 0.8 : 1.25));
  } else {
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!directions[key] || crop || gesture) return;
    const [x, y] = directions[key];
    const step = event.shiftKey ? 24 : 4;
    if (selection.size) {
      for (const object of selection) {
        object.x += x * step / view.zoom;
        object.y += y * step / view.zoom;
      }
      commitSceneEdit();
    } else {
      view.x -= x * step;
      view.y -= y * step;
      persistScene();
    }
    requestDraw();
  }
  event.preventDefault();
});

function updateConstrainedGesture(event) {
  if (!gesture || event.key !== modifierKey) return;
  if (!["resize", "shape", "rotate", "endpoint"].includes(gesture.kind)) return;
  const point = worldPoint(pointers.get(gesture.id));
  const constrained = primaryModifier(event);
  if (gesture.kind === "resize") resizeSelection(point, constrained);
  else if (gesture.kind === "rotate") updateRotation(point, constrained);
  else if (gesture.kind === "endpoint") moveEndpoint(point, constrained);
  else updateShape(draft, point, constrained);
  if (gesture.kind === "shape") requestDraw();
  else requestSceneDraw();
}

document.addEventListener("keydown", event => {
  if (event.defaultPrevented) return;
  if (openSettings && event.key === "Escape") {
    event.preventDefault();
    closeSettingsPopup(true);
    return;
  }
  if (paletteTarget && event.key === "Escape") {
    event.preventDefault();
    closePalette(true);
    return;
  }
  if (pngAction && event.key === "Escape") {
    const trigger = exportTriggers[pngAction];
    setExportOptions(null);
    trigger.focus({ preventScroll: true });
    return;
  }
  if (primaryModifier(event) && event.code === "KeyZ" && !event.shiftKey && !event.altKey &&
    !textEdit && !clearDialog.open && !app.inert && app.contains(event.target)) {
    event.preventDefault();
    undoEdit();
    return;
  }
  if (!selection.size || textEdit || crop || gesture || clearDialog.open ||
    event.code !== "KeyD" || !primaryModifier(event)) return;
  event.preventDefault();
  if (event.repeat) return;
  const offset = 20 / view.zoom;
  const selectedObjects = objects.filter(object => selection.has(object));
  insertObjects(cloneObjects(selectedObjects, { x: offset, y: offset }));
});

document.addEventListener("pointerdown", event => {
  if (paletteTarget && !palettePopup.contains(event.target) && !colorPair.contains(event.target)) closePalette();
  if (openSettings && !openSettings.popup.contains(event.target) && !openSettings.button.contains(event.target)) {
    closeSettingsPopup();
  }
  if (pngAction && !exportOptions.contains(event.target) &&
    !Object.values(exportTriggers).some(button => button.contains(event.target))) {
    setExportOptions(null);
  }
});

function releaseSpace() {
  if (!spaceHeld) return;
  spaceHeld = false;
  updateControls();
}

window.addEventListener("keyup", event => {
  if (event.key === " ") releaseSpace();
});
window.addEventListener("keydown", updateConstrainedGesture);
window.addEventListener("keyup", updateConstrainedGesture);
window.addEventListener("blur", releaseSpace);
window.addEventListener("pagehide", () => {
  if (viewSaveTimer !== undefined) persistScene();
});
touchLayout.addEventListener("change", updateControls);

document.addEventListener("copy", event => {
  if (app.inert || clearDialog.open || textEdit || crop || gesture ||
    (event.target !== document.body && !app.contains(event.target)) ||
    !event.clipboardData || window.getSelection()?.isCollapsed === false) return;
  if (!selection.size) {
    event.preventDefault();
    copyImage(false);
    return;
  }
  const token = crypto.randomUUID();
  event.clipboardData.setData(objectClipboardType, token);
  event.preventDefault();
  // Completed geometry is shared by copies. Edits replace its paths and bounds.
  const items = objects.filter(object => selection.has(object)).map(object => ({ ...object }));
  localClipboardObjects = { token, items };
  localClipboardImage = null;
  announce("objectsCopied");
});

document.addEventListener("paste", event => {
  if (app.inert || clearDialog.open || textEdit || gesture) return;
  const token = event.clipboardData?.getData(objectClipboardType);
  if (token && token === localClipboardObjects?.token) {
    event.preventDefault();
    pasteObjects(localClipboardObjects.items);
    return;
  }
  const blob = Array.from(event.clipboardData?.files || []).find(file => file.type.startsWith("image/"));
  if (blob) {
    event.preventDefault();
    importImage(blob);
  } else if (canvas === document.activeElement && localClipboardImage) {
    event.preventDefault();
    pasteLocal();
  }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) importImage(fileInput.files[0]);
  fileInput.value = "";
});

stage.addEventListener("dragover", event => {
  if (!event.dataTransfer.types.includes("Files")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  stage.setAttribute("data-drop", "");
});
stage.addEventListener("dragleave", event => {
  if (!stage.contains(event.relatedTarget)) stage.removeAttribute("data-drop");
});
stage.addEventListener("drop", event => {
  if (!event.dataTransfer.types.includes("Files")) return;
  event.preventDefault();
  stage.removeAttribute("data-drop");
  const file = Array.from(event.dataTransfer.files).find(item => item.type.startsWith("image/"));
  importImage(file, worldPoint(screenPoint(event)));
});

initSiteLanguage(document.querySelector("#interface-language"), nextLanguage => {
  language = nextLanguage;
  localizePage(paintTranslations, language);
  updateControls();
  status.textContent = statusKey ? label(statusKey) : "";
});

new ResizeObserver(requestDraw).observe(canvas);
const observeHints = new ResizeObserver(() => {
  hintRow.toggleAttribute("data-overflow", hintRow.offsetWidth > feedback.clientWidth);
});
observeHints.observe(feedback);
observeHints.observe(hintRow);
window.addEventListener("resize", requestDraw);
window.addEventListener("resize", positionPopups);
document.querySelector(".paint-sidebar").addEventListener("scroll", positionPopups);
document.fonts.addEventListener("loadingdone", () => {
  objects.filter(object => object.type === "text").forEach(object => measureTextObject(context, object));
  requestSceneDraw();
});
restoreScene();
