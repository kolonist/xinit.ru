"use strict";

const editor = document.querySelector("#editor");
const themeSelect = document.querySelector("#terminal-theme");
const themeSwatch = document.querySelector("#theme-swatch");
const languageSelect = document.querySelector("#interface-language");
const terminalWindow = document.querySelector("#terminal-window");
const windowTitle = document.querySelector("#window-title");
const exchanges = [{
  command: document.querySelector("#command"),
  output: document.querySelector("#output"),
}];
const columns = document.querySelector("#columns");
const rows = document.querySelector("#rows");
const prompt = document.querySelector("#prompt");
const cursor = editor.elements.namedItem("cursor");
const canvas = document.querySelector("#terminal");
const context = canvas.getContext("2d");
const editingOverlay = document.querySelector("#editing-overlay");
const editingContext = editingOverlay.getContext("2d");
const size = document.querySelector("#size");
const overflow = document.querySelector("#overflow");
const status = document.querySelector("#status");
const download = document.querySelector("#download");
const copy = document.querySelector("#copy");
const addExchange = document.querySelector("#add-exchange");
const removeExchange = document.querySelector("#remove-exchange");

const font = '16px "IBM Plex Mono", monospace';
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const pixelScale = 2;
const lineHeight = 23;
const padding = 17;
const titleHeight = 34;
const titleStart = 58;
const macTitleStart = 67;
const windowsTitleStart = 25;
const windowsTitleEnd = 61;
const desktopTitleInset = 61;
const themes = {
  matrix: {
    background: "#061009", header: "#10291a", title: "#d5ffde", divider: "#509c6b",
    border: "#39724c", buttons: ["#a3ffbb", "#a3ffbb", "#a3ffbb"],
    symbols: ["×", "□", "_"],
    command: "#9cffb6", output: "#73d98e", focus: "#80f6a4", caret: "#c8ffd6",
    selection: "rgba(128, 246, 164, 0.3)", glow: "#65ffa3",
    scanlines: true, prompt: "$ ",
  },
  windows: {
    background: "#000000", header: "#000080", title: "#ffffff", divider: "#c0c0c0",
    border: "#808080", command: "#ffffff", output: "#c0c0c0", focus: "#83afff",
    caret: "#ffffff", selection: "rgba(100, 151, 255, 0.4)", prompt: "C:\\> ",
    windowsChrome: true,
  },
  "mac-dark": {
    background: "#151515", header: "#303030", title: "#f0f0f0", divider: "#454545",
    border: "#595959", buttons: ["#ff5f57", "#febc2e", "#28c840"],
    command: "#f5f5f5", output: "#c9c9c9", focus: "#8dbfff", caret: "#ffffff",
    selection: "rgba(82, 148, 240, 0.4)", prompt: "$ ",
    cornerRadius: 10,
  },
  "mac-light": {
    background: "#ffffff", header: "#e9e9eb", title: "#2c2c2e", divider: "#c7c7ca",
    border: "#a6a6aa", buttons: ["#ff5f57", "#febc2e", "#28c840"],
    command: "#1a1a1c", output: "#45454b", focus: "#1368c5", caret: "#19191b",
    selection: "rgba(38, 128, 222, 0.27)", prompt: "$ ",
    cornerRadius: 10,
  },
  "kde-dark": {
    background: "#232629", header: "#31363b", title: "#eff0f1", divider: "#3daee9",
    border: "#4d545a", command: "#eff0f1", output: "#c8cdd1", focus: "#3daee9",
    caret: "#eff0f1", selection: "rgba(61, 174, 233, 0.35)", prompt: "$ ",
    desktopChrome: "kde", cornerRadius: 5,
  },
  "gnome-dark": {
    background: "#1d1d20", header: "#2e2e32", title: "#ffffff", divider: "#1a1a1d",
    border: "#4a4a50", command: "#ffffff", output: "#d0cfd4", focus: "#78aeed",
    caret: "#ffffff", selection: "rgba(120, 174, 237, 0.35)", prompt: "$ ",
    desktopChrome: "gnome", cornerRadius: 12,
  },
};
const editRows = new Map();
const settingsKey = "xinit-terminal-settings-v1";
const lastValidDimensions = { columns: columns.valueAsNumber, rows: rows.valueAsNumber };
let preferredLanguage;
let dragSelection;
let caretBlinkTimer;
let caretVisible = true;
let copyFeedbackTimer;

function translate(key) {
  return terminalTranslations[key][languageSelect.value === "ru" ? 0 : 1];
}

function showStatus(key, announcementOnly = false) {
  status.classList.toggle("copy-announcement", announcementOnly);
  status.textContent = key ? translate(key) : "";
}

function labelExchange({ command, output }, number) {
  for (const [field, key] of [[command, "input"], [output, "output"]]) {
    const label = translate(key) + " " + number;
    field.setAttribute("aria-label", label);
    field.title = label;
    field.placeholder = translate(key);
  }
}

function applyLanguage() {
  document.documentElement.lang = languageSelect.value;
  document.title = translate("heading") + " · xinit.ru";
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = translate(element.dataset.i18n);
  }
  for (const [key, attribute] of [["label", "aria-label"], ["title", "title"], ["placeholder", "placeholder"]]) {
    for (const element of document.querySelectorAll("[data-i18n-" + key + "]")) {
      element.setAttribute(attribute, translate(element.getAttribute("data-i18n-" + key)));
    }
  }
  exchanges.forEach((exchange, index) => labelExchange(exchange, index + 1));
}

function restoreSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem(settingsKey)) ?? {};
    if (typeof settings.theme === "string" && Object.hasOwn(themes, settings.theme)) {
      themeSelect.value = settings.theme;
    }
    if (typeof settings.prompt === "boolean") prompt.checked = settings.prompt;
    if (typeof settings.title === "string") windowTitle.value = settings.title;
    if (["ru", "en"].includes(settings.language)) preferredLanguage = settings.language;
    if (["line", "end", "hidden"].includes(settings.cursor)) cursor.value = settings.cursor;

    for (const input of [columns, rows]) {
      const value = settings[input.id];
      if (Number.isInteger(value) && value >= Number(input.min) && value <= Number(input.max)) {
        input.value = value;
        lastValidDimensions[input.id] = value;
      }
    }
  } catch {
    // Invalid or unavailable storage should not prevent editing.
  }
}

function saveSettings() {
  for (const input of [columns, rows]) {
    if (input.validity.valid) lastValidDimensions[input.id] = input.valueAsNumber;
  }

  try {
    localStorage.setItem(settingsKey, JSON.stringify({
      theme: themeSelect.value,
      ...lastValidDimensions,
      prompt: prompt.checked,
      cursor: cursor.value,
      title: windowTitle.value,
      language: preferredLanguage,
    }));
  } catch {
    // The editor still works when storage is blocked or full.
  }
}

function* terminalLines() {
  const theme = themes[themeSelect.value];
  const prefix = prompt.checked ? theme.prompt : "";
  const sections = [];

  for (const { command, output } of exchanges) {
    const commandText = command.value || exchanges.length > 1 || (!output.value && cursor.value === "hidden")
      ? prefix + command.value : "";
    sections.push({ field: command, text: commandText, offset: commandText ? -prefix.length : 0,
      color: theme.command, editableOnly: !commandText && exchanges.length === 1 });
    sections.push({ field: output, text: output.value, offset: 0, color: theme.output,
      editableOnly: !output.value });
  }

  const lastTextSection = sections.findLast(section => section.text);
  for (const section of sections) {
    const lines = section.text.split("\n");
    let offset = section.offset;
    for (const [index, text] of lines.entries()) {
      const isLastLine = section === lastTextSection && index === lines.length - 1;
      yield { ...section, text, offset, cursor: isLastLine && cursor.value === "end" };
      offset += text.length + 1;
    }
  }

  if (cursor.value === "line" || (cursor.value === "end" && !lastTextSection)) {
    yield { text: prefix, color: theme.command, cursor: true };
  }
}

function* wrapLines(lines, width) {
  for (const line of lines) {
    let cells = [];
    let offsets = [line.offset];

    for (const { segment, index } of segmenter.segment(line.text)) {
      const characters = segment === "\t" ? Array(4 - cells.length % 4).fill(" ") : [segment];

      for (const [part, character] of characters.entries()) {
        if (cells.length === width) {
          yield { ...line, cells, offsets, cursor: false };
          cells = [];
          offsets = [offsets.at(-1)];
        }
        cells.push(character);
        offsets.push(line.offset + index + (part === characters.length - 1 ? segment.length : 0));
      }
    }

    if (line.cursor && cells.length === width) {
      yield { ...line, cells, offsets, cursor: false };
      cells = [];
      offsets = [offsets.at(-1)];
    }

    yield { ...line, cells, offsets };
  }
}

function drawBevel(x, y, width, height, topLeft, bottomRight) {
  context.fillStyle = bottomRight;
  context.fillRect(x, y + height - 1, width, 1);
  context.fillRect(x + width - 1, y, 1, height);
  context.fillStyle = topLeft;
  context.fillRect(x, y, width - 1, 1);
  context.fillRect(x, y, 1, height - 1);
}

function drawWindowsFrame(width, height, theme) {
  context.fillStyle = "#c0c0c0";
  context.fillRect(0, 0, width, height);
  drawBevel(0, 0, width, height, "#dfdfdf", "#000000");
  drawBevel(1, 1, width - 2, height - 2, "#ffffff", "#808080");

  context.fillStyle = theme.header;
  context.fillRect(4, 4, width - 8, titleHeight - 8);
  context.fillStyle = theme.background;
  context.fillRect(5, titleHeight, width - 10, height - titleHeight - 5);
  drawBevel(4, titleHeight - 1, width - 8, height - titleHeight - 3, "#808080", "#ffffff");

  context.fillStyle = "#c0c0c0";
  context.fillRect(8, 11, 13, 11);
  context.fillStyle = "#000000";
  context.fillRect(9, 13, 11, 8);
  context.fillStyle = "#ffffff";
  context.fillRect(11, 18, 4, 1);

  for (const [index, symbol] of ["_", "□", "×"].entries()) {
    const x = width - 56 + index * 16 + (index === 2 ? 2 : 0);
    context.fillStyle = "#c0c0c0";
    context.fillRect(x, 8, 15, 18);
    drawBevel(x, 8, 15, 18, "#ffffff", "#000000");
    drawBevel(x + 1, 9, 13, 16, "#dfdfdf", "#808080");
    context.font = "bold 12px Tahoma, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#000000";
    context.fillText(symbol, x + 7.5, 17);
  }
}

function drawDesktopControls(width, theme) {
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "16px sans-serif";
  const y = titleHeight / 2;

  if (theme.desktopChrome === "kde") {
    context.fillStyle = theme.border;
    context.fillRect(10, y - 6, 15, 12);
    context.fillStyle = theme.title;
    context.font = "10px monospace";
    context.fillText(">_", 17.5, y);
    context.font = "16px sans-serif";
    context.fillText("⌄", width - 49, y - 2);
    context.fillText("⌃", width - 32, y + 2);
    context.fillText("×", width - 14, y);
    return;
  }

  context.fillStyle = "#414146";
  context.beginPath();
  context.roundRect(7, y - 10, 25, 20, 5);
  context.fill();
  context.beginPath();
  context.arc(width - 16, y, 10, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = theme.title;
  context.fillText("+", 19.5, y);
  context.fillText("≡", width - 43, y);
  context.fillText("×", width - 16, y);
}

function drawMatrixLighting(width, height, theme) {
  const bodyGlow = context.createRadialGradient(width * 0.45, titleHeight, 0,
    width * 0.45, titleHeight, Math.max(width * 0.7, height * 0.75));
  bodyGlow.addColorStop(0, "rgba(66, 195, 111, 0.14)");
  bodyGlow.addColorStop(1, "rgba(66, 195, 111, 0)");
  context.fillStyle = bodyGlow;
  context.fillRect(1, titleHeight, width - 2, height - titleHeight - 1);

  const titleGradient = context.createLinearGradient(0, 1, 0, titleHeight);
  titleGradient.addColorStop(0, "#224f33");
  titleGradient.addColorStop(1, theme.header);
  context.fillStyle = titleGradient;
  context.fillRect(1, 1, width - 2, titleHeight - 1);
  context.fillStyle = "#68b281";
  context.fillRect(1, 1, width - 2, 1);
}

function drawWindow(width, height, theme) {
  const radius = theme.cornerRadius ?? 0;
  context.save();
  if (radius) {
    context.beginPath();
    context.roundRect(0, 0, width, height, radius);
    context.clip();
  }
  if (theme.windowsChrome) {
    drawWindowsFrame(width, height, theme);
  } else {
    context.fillStyle = theme.background;
    context.fillRect(0, 0, width, height);
    context.fillStyle = theme.header;
    if (radius) context.fillRect(0, 0, width, titleHeight);
    else context.fillRect(1, 1, width - 2, titleHeight - 1);

    if (theme.glow) {
      drawMatrixLighting(width, height, theme);
      context.shadowColor = theme.glow;
      context.shadowBlur = 5;
    }

    if (theme.desktopChrome) {
      drawDesktopControls(width, theme);
    } else if (theme.symbols) {
      const controlFont = '600 12px "IBM Plex Mono", monospace';
      context.font = controlFont;
      context.textAlign = "center";
      context.textBaseline = "middle";
      const maximizeBottom = context.measureText("□").actualBoundingBoxDescent;
      for (const [index, symbol] of theme.symbols.entries()) {
        context.font = symbol === "×" ? '600 14px "IBM Plex Mono", monospace' : controlFont;
        context.fillStyle = theme.buttons[index];
        const y = symbol === "_"
          ? titleHeight / 2 + maximizeBottom - context.measureText(symbol).actualBoundingBoxDescent
          : titleHeight / 2;
        context.fillText(symbol, 16 + index * 13, y);
      }
    } else {
      for (const [index, color] of theme.buttons.entries()) {
        context.beginPath();
        const x = radius ? 18 + index * 17 : 16 + index * 13;
        context.arc(x, titleHeight / 2, radius ? 6 : 3.5, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
      }
    }
  }

  context.font = theme.windowsChrome ? "bold 13px Tahoma, sans-serif" : '12px "IBM Plex Mono", monospace';
  if (theme.desktopChrome) context.font = "600 13px system-ui, sans-serif";
  if (theme.glow) context.font = '600 14px "IBM Plex Mono", monospace';
  context.textBaseline = "middle";
  context.fillStyle = theme.title;
  const { left, right, align } = titleLayout(theme);
  const titleWidth = width - left - right;
  const titleX = align === "left" ? left : width - right - (align === "center" ? titleWidth / 2 : 0);
  context.textAlign = align;
  let visibleTitle = windowTitle.value;
  let ellipsis = "";
  if (context.measureText(visibleTitle).width > titleWidth) {
    let prefix = "";
    for (const { segment } of segmenter.segment(visibleTitle)) {
      if (context.measureText(prefix + segment + "…").width > titleWidth) break;
      prefix += segment;
    }
    visibleTitle = prefix;
    ellipsis = "…";
  }
  const title = visibleTitle + ellipsis;
  const { actualBoundingBoxAscent, actualBoundingBoxDescent } = context.measureText(title);
  const titleY = (titleHeight + actualBoundingBoxAscent - actualBoundingBoxDescent) / 2;
  context.fillText(title, titleX, titleY);
  const titleLeft = titleX - context.measureText(title).width * { left: 0, center: 0.5, right: 1 }[align];
  const stops = [{ offset: 0, x: titleLeft }];
  for (const { segment, index } of segmenter.segment(visibleTitle)) {
    const offset = index + segment.length;
    stops.push({ offset, x: titleLeft + context.measureText(visibleTitle.slice(0, offset)).width });
  }
  editRows.get(windowTitle).push({ y: titleHeight / 2, stops });
  context.textAlign = "left";
  if (!theme.windowsChrome) {
    context.fillStyle = theme.divider;
    context.fillRect(0, titleHeight, width, 1);
    context.shadowBlur = 0;
    context.strokeStyle = theme.border;
    context.beginPath();
    context.roundRect(0.5, 0.5, width - 1, height - 1, Math.max(0, radius - 0.5));
    context.stroke();
  }
  context.restore();
  context.textBaseline = "middle";
}

function positionField(field, width, height, left, right, top, bottom) {
  field.style.setProperty("--field-left", left / width * 100 + "%");
  field.style.setProperty("--field-right", right / width * 100 + "%");
  field.style.setProperty("--field-top", top / height * 100 + "%");
  field.style.setProperty("--field-height", (bottom - top) / height * 100 + "%");
}

function titleLayout(theme) {
  if (theme.windowsChrome) return { left: windowsTitleStart, right: windowsTitleEnd, align: "left" };
  if (theme.desktopChrome) return { left: desktopTitleInset, right: desktopTitleInset, align: "center" };
  return { left: theme.cornerRadius ? macTitleStart : titleStart, right: padding, align: "right" };
}

function positionFields(width, height, fields, theme) {
  const { left, right } = titleLayout(theme);
  positionField(windowTitle, width, height, left, right, 1, titleHeight);
  const visibleFields = fields.filter(field => editRows.get(field).length > 0);
  for (const field of fields) field.hidden = editRows.get(field).length === 0;

  let top = titleHeight + 1;
  for (const [index, field] of visibleFields.entries()) {
    const next = visibleFields[index + 1];
    let bottom = height - 1;
    if (next) {
      const nextRow = editRows.get(next)[0];
      bottom = nextRow.y - lineHeight / 2;
      // Use the interline gap above the next command for its predecessor's empty output.
      const following = visibleFields[index + 2];
      if (nextRow.collapsed && following && editRows.get(following)[0].y === nextRow.y) {
        bottom -= 5;
      }
    }
    positionField(field, width, height, 1, 1, top, bottom);
    top = bottom;
  }
}

function emptyOutputToExpand(field = document.activeElement) {
  const exchange = exchanges.find(({ command, output }) =>
    output.value === "" && (field === command || field === output));
  return exchange?.output ?? null;
}

function render({ expandedOutput = emptyOutputToExpand() } = {}) {
  const theme = themes[themeSelect.value];
  themeSwatch.style.setProperty("--swatch-header", theme.header);
  themeSwatch.style.setProperty("--swatch-body", theme.background);
  themeSwatch.style.setProperty("--swatch-ink", theme.command);

  if (!columns.validity.valid || !rows.validity.valid) {
    download.disabled = true;
    copy.disabled = true;
    showStatus("invalidSize");
    return;
  }

  download.disabled = false;
  copy.disabled = false;
  showStatus();

  const columnCount = columns.valueAsNumber;
  const rowCount = rows.valueAsNumber;
  context.font = font;
  const cellWidth = Math.ceil(context.measureText("M").width);
  const width = padding * 2 + columnCount * cellWidth;
  const height = titleHeight + padding * 2 + rowCount * lineHeight;

  canvas.width = width * pixelScale;
  canvas.height = height * pixelScale;
  editingOverlay.width = canvas.width;
  editingOverlay.height = canvas.height;
  const fields = exchanges.flatMap(({ command, output }) => [command, output]);
  editRows.clear();
  for (const field of [windowTitle, ...fields]) editRows.set(field, []);
  terminalWindow.style.width = width + "px";
  terminalWindow.style.setProperty("--terminal-focus", theme.focus);
  const radius = theme.cornerRadius ?? 0;
  terminalWindow.style.borderRadius = radius / width * 100 + "% / " + radius / height * 100 + "%";
  context.scale(pixelScale, pixelScale);
  drawWindow(width, height, theme);

  context.font = font;
  let row = 0;
  let reservedRows = 0;
  let clipped = false;
  for (const { cells, field, color, offsets, editableOnly, cursor: showCursor }
    of wrapLines(terminalLines(), columnCount)) {
    if (row >= rowCount && !editableOnly) {
      if (row - reservedRows >= rowCount) {
        clipped = true;
        break;
      }
      row += 1;
      continue;
    }
    const rowY = titleHeight + padding + row * lineHeight + lineHeight / 2;
    const y = editableOnly ? Math.min(rowY, height - padding / 2) : rowY;
    if (field) {
      const stops = offsets.flatMap((offset, column) =>
        offset < 0 ? [] : [{ offset, x: padding + column * cellWidth }]);
      editRows.get(field).push({ y, stops, collapsed: editableOnly && field !== expandedOutput });
    }
    if (editableOnly) {
      if (field === expandedOutput && row < rowCount) {
        row += 1;
        reservedRows += 1;
      }
      continue;
    }
    row += 1;
    context.fillStyle = color;
    cells.forEach((cell, column) => {
      context.fillText(cell, padding + column * cellWidth, y, cellWidth);
    });
    if (showCursor) {
      context.fillStyle = theme.command;
      if (theme.glow) {
        context.shadowColor = theme.glow;
        context.shadowBlur = 7;
      }
      context.fillRect(padding + cells.length * cellWidth, y - 8, cellWidth - 1, 16);
      context.shadowBlur = 0;
    }
  }
  positionFields(width, height, fields, theme);

  if (theme.scanlines) {
    context.fillStyle = "rgba(0, 0, 0, 0.12)";
    for (let y = titleHeight + 3; y < height - 1; y += 3) {
      context.fillRect(1, y, width - 2, 1);
    }
  }

  size.textContent = canvas.width + " × " + canvas.height + " px";
  overflow.hidden = !clipped;
  overflow.textContent = overflow.hidden ? "" : translate("overflow");
  drawEditingOverlay();
}

function restartCaretBlink() {
  clearInterval(caretBlinkTimer);
  caretVisible = true;
  drawEditingOverlay();

  const field = document.activeElement;
  if (editRows.has(field) && field.selectionStart === field.selectionEnd) {
    caretBlinkTimer = setInterval(() => {
      caretVisible = !caretVisible;
      drawEditingOverlay();
    }, 530);
  }
}

function drawEditingOverlay() {
  editingContext.clearRect(0, 0, editingOverlay.width, editingOverlay.height);
  const field = document.activeElement;
  const visibleRows = editRows.get(field);
  if (!visibleRows?.length) return;
  const theme = themes[themeSelect.value];

  const emptyOutput = emptyOutputToExpand(field);
  const outputRow = editRows.get(emptyOutput)?.[0];
  if (emptyOutput !== field && outputRow) {
    editingContext.font = '12px "IBM Plex Mono", monospace';
    editingContext.textBaseline = "middle";
    editingContext.fillStyle = theme.output;
    editingContext.save();
    editingContext.scale(pixelScale, pixelScale);
    editingContext.fillText(translate("output"), padding, outputRow.y);
    editingContext.restore();
  }

  if (field !== windowTitle) {
    const top = visibleRows[0].y - lineHeight / 2;
    const bottom = Math.min(visibleRows.at(-1).y + lineHeight / 2, canvas.height / pixelScale - 1);
    editingContext.strokeStyle = theme.focus;
    editingContext.lineWidth = pixelScale;
    editingContext.strokeRect(pixelScale, top * pixelScale,
      editingOverlay.width - 2 * pixelScale, (bottom - top) * pixelScale);
  }

  const start = field.selectionStart;
  const end = field.selectionEnd;
  const markHeight = field === windowTitle ? 14 : 18;
  if (start === end) {
    if (!caretVisible) return;
    const row = visibleRows.findLast(({ stops }) => start >= stops[0].offset);
    if (!row) return;
    const stop = row.stops.find(({ offset }) => offset >= start);
    if (!stop && field !== windowTitle) return;
    editingContext.fillStyle = theme.caret;
    editingContext.fillRect(
      (stop ?? row.stops.at(-1)).x * pixelScale,
      (row.y - markHeight / 2) * pixelScale,
      pixelScale,
      markHeight * pixelScale
    );
    return;
  }

  editingContext.fillStyle = theme.selection;
  for (const { y, stops } of visibleRows) {
    const from = stops.find(({ offset }) => offset >= start);
    const to = stops.find(({ offset }) => offset >= end) ?? stops.at(-1);
    if (from && to.x > from.x) {
      editingContext.fillRect(
        from.x * pixelScale,
        (y - markHeight / 2) * pixelScale,
        (to.x - from.x) * pixelScale,
        markHeight * pixelScale
      );
    }
  }
}

function offsetAtPointer(field, event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * canvas.width / rect.width / pixelScale;
  const y = (event.clientY - rect.top) * canvas.height / rect.height / pixelScale;
  const visibleRows = editRows.get(field);
  if (!visibleRows?.length) return field.value.length;

  const row = visibleRows.reduce((nearest, candidate) =>
    Math.abs(candidate.y - y) < Math.abs(nearest.y - y) ? candidate : nearest);
  return row.stops.reduce((nearest, candidate) =>
    Math.abs(candidate.x - x) < Math.abs(nearest.x - x) ? candidate : nearest).offset;
}

function selectToPointer(field, anchor, event) {
  const offset = offsetAtPointer(field, event);
  field.setSelectionRange(Math.min(anchor, offset), Math.max(anchor, offset),
    offset < anchor ? "backward" : "forward");
  restartCaretBlink();
}

function makePng() {
  const restoreEditingRow = emptyOutputToExpand();
  if (restoreEditingRow) render({ expandedOutput: null });
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("PNG encoding failed"));
      }, "image/png");
    } finally {
      if (restoreEditingRow) render();
    }
  });
}

function createExchangeField() {
  const field = document.createElement("textarea");
  field.className = "terminal-field";
  field.spellcheck = false;
  return field;
}

addExchange.addEventListener("click", () => {
  if (!columns.reportValidity() || !rows.reportValidity()) return;

  const number = exchanges.length + 1;
  const command = createExchangeField();
  const output = createExchangeField();
  const exchange = { command, output };
  labelExchange(exchange, number);
  exchanges.push(exchange);

  let neededRows = 0;
  for (const line of wrapLines(terminalLines(), columns.valueAsNumber)) {
    if (!line.editableOnly) neededRows += 1;
    if (neededRows > Number(rows.max)) {
      exchanges.pop();
      showStatus("noRoom");
      return;
    }
  }

  if (neededRows > rows.valueAsNumber) {
    rows.value = neededRows;
    saveSettings();
  }
  terminalWindow.append(command, output);
  removeExchange.disabled = false;
  render();
  command.focus();
});

removeExchange.addEventListener("click", () => {
  if (exchanges.length === 1) return;
  const { command, output } = exchanges.pop();
  command.remove();
  output.remove();
  removeExchange.disabled = exchanges.length === 1;
  if (removeExchange.disabled) addExchange.focus();
  render();
});

editor.addEventListener("submit", event => event.preventDefault());
languageSelect.addEventListener("change", () => {
  preferredLanguage = languageSelect.value;
  applyLanguage();
  saveSettings();
  render();
});
editor.addEventListener("input", () => {
  saveSettings();
  render();
});
terminalWindow.addEventListener("input", event => {
  if (event.target === windowTitle) saveSettings();
  render();
  restartCaretBlink();
});
terminalWindow.addEventListener("focusin", event => {
  const output = emptyOutputToExpand(event.target);
  if (output && output !== emptyOutputToExpand(event.relatedTarget)) render({ expandedOutput: output });
  restartCaretBlink();
});
terminalWindow.addEventListener("focusout", event => {
  clearInterval(caretBlinkTimer);
  const output = emptyOutputToExpand(event.target);
  if (output && output !== emptyOutputToExpand(event.relatedTarget)) render({ expandedOutput: null });
  editingContext.clearRect(0, 0, editingOverlay.width, editingOverlay.height);
});
document.addEventListener("selectionchange", restartCaretBlink);

terminalWindow.addEventListener("pointerdown", event => {
  const field = event.target;
  if (!editRows.has(field) || event.pointerType !== "mouse" || event.button !== 0) return;
  event.preventDefault();

  const extend = event.shiftKey && document.activeElement === field;
  const anchor = extend
    ? (field.selectionDirection === "backward" ? field.selectionEnd : field.selectionStart)
    : offsetAtPointer(field, event);
  field.focus({ preventScroll: true });
  field.setPointerCapture(event.pointerId);
  dragSelection = { field, anchor, pointerId: event.pointerId };
  selectToPointer(field, anchor, event);
});

terminalWindow.addEventListener("pointermove", event => {
  if (dragSelection?.pointerId !== event.pointerId) return;
  selectToPointer(dragSelection.field, dragSelection.anchor, event);
});

terminalWindow.addEventListener("lostpointercapture", () => { dragSelection = undefined; });
terminalWindow.addEventListener("click", event => {
  if (!editRows.has(event.target) || !["touch", "pen"].includes(event.pointerType)) return;
  const offset = offsetAtPointer(event.target, event);
  event.target.setSelectionRange(offset, offset);
  restartCaretBlink();
});

terminalWindow.addEventListener("keydown", event => {
  if (event.isComposing) return;
  if (event.key === "Escape" || (event.key === "Enter" && event.target === windowTitle)) {
    event.preventDefault();
    event.target.blur();
  }
});

download.addEventListener("click", async () => {
  try {
    const url = URL.createObjectURL(await makePng());
    const link = document.createElement("a");
    link.href = url;
    link.download = "terminal.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showStatus("downloadReady");
  } catch {
    showStatus("downloadError");
  }
});

copy.addEventListener("click", async () => {
  clearTimeout(copyFeedbackTimer);
  delete copy.dataset.copied;
  if (!navigator.clipboard?.write || !window.ClipboardItem) {
    showStatus("clipboardUnavailable");
    return;
  }

  try {
    const item = new ClipboardItem({ "image/png": makePng() });
    await navigator.clipboard.write([item]);
    copy.dataset.copied = "";
    showStatus("copied", true);
    clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = setTimeout(() => { delete copy.dataset.copied; }, 2000);
  } catch {
    showStatus("copyError");
  }
});

restoreSettings();
languageSelect.value = preferredLanguage ?? (navigator.language.toLowerCase().split("-")[0] === "ru" ? "ru" : "en");
applyLanguage();
render();
document.fonts.ready.then(render);
