const storeGridEl = document.getElementById("store-grid");
const gridColsEl = document.getElementById("grid-cols");
const gridRowsEl = document.getElementById("grid-rows");
const paintModeEl = document.getElementById("paint-mode");
const modeTileBtn = document.getElementById("mode-tile");
const modeStatusBtn = document.getElementById("mode-status");
const toolBrushBtn = document.getElementById("tool-brush");
const toolBucketBtn = document.getElementById("tool-bucket");
const toolRectBtn = document.getElementById("tool-rect");
const toolLassoBtn = document.getElementById("tool-lasso");
const toolPanBtn = document.getElementById("tool-pan");
const tileChipBtns = Array.from(document.querySelectorAll(".chip-btn[data-tile]"));
const statusChipBtns = Array.from(document.querySelectorAll(".chip-btn[data-status]"));
const paintToolEl = document.getElementById("paint-tool");
const tileTypeEl = document.getElementById("tile-type");
const cleanStatusEl = document.getElementById("clean-status");
const brushSizeEl = document.getElementById("brush-size");
const resetLayoutBtn = document.getElementById("reset-layout");
const saveLayoutBtn = document.getElementById("save-layout");
const clearStatusBtn = document.getElementById("clear-status");
const gridCoverageEl = document.getElementById("grid-coverage");
const layoutStatusEl = document.getElementById("layout-status");
const storeNameEl = document.getElementById("store-name");
const alertBoxEl = document.getElementById("alert-box");
const presetLayoutEl = document.getElementById("preset-layout");
const exportLayoutBtn = document.getElementById("export-layout");
const importLayoutInput = document.getElementById("import-layout");
const layoutJsonEl = document.getElementById("layout-json");
const toggleLabelsBtn = document.getElementById("toggle-labels");
const miniMapEl = document.getElementById("mini-map");
const panToggleBtn = document.getElementById("pan-toggle");

const STORAGE_KEY = "mopscan-layout-v1";

let gridState = { cols: 24, rows: 16, cells: [] };
let painting = false;
let panMode = false;
let lastPoint = null;
let pinchState = null;
let showLabels = true;
let lastPaintCell = null;
let needsRedraw = false;
let needsCoverage = false;
let rectStart = null;
let rectEnd = null;
let lassoPoints = [];
let panOverride = false;
let miniDragging = false;

const view = {
  scale: 1,
  minScale: 0.5,
  maxScale: 4,
  offsetX: 0,
  offsetY: 0,
  baseCell: 28,
};

const tileColors = {
  floor: "#1b1f2b",
  shelf: "#3a3345",
  entry: "#204257",
  checkout: "#3b2b1d",
  blocked: "#2b2b2b",
};

const statusOverlays = {
  cleaned: "rgba(63, 198, 255, 0.75)",
  wet: "rgba(247, 181, 0, 0.8)",
  unknown: "rgba(140, 146, 160, 0.35)",
};

const PRESETS = {
  grocery: { cols: 24, rows: 16, shelves: 6 },
  club: { cols: 30, rows: 18, shelves: 7 },
  neighborhood: { cols: 18, rows: 12, shelves: 4 },
};

function createCell() {
  return { tile: "floor", status: "unknown" };
}

function setLayoutStatus(text) {
  layoutStatusEl.textContent = `Layout: ${text}`;
}

function setActiveButton(group, value) {
  group.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === value || btn.dataset.tool === value || btn.dataset.mode === value || btn.dataset.tile === value || btn.dataset.status === value);
  });
}

function syncToolbar() {
  if (modeTileBtn && modeStatusBtn) {
    modeTileBtn.classList.toggle("active", paintModeEl.value === "tile");
    modeStatusBtn.classList.toggle("active", paintModeEl.value === "status");
  }
  if (toolBrushBtn) {
    toolBrushBtn.classList.toggle("active", paintToolEl.value === "brush");
    toolBucketBtn.classList.toggle("active", paintToolEl.value === "bucket");
    toolRectBtn.classList.toggle("active", paintToolEl.value === "rect");
    toolLassoBtn.classList.toggle("active", paintToolEl.value === "lasso");
    toolPanBtn.classList.toggle("active", paintToolEl.value === "pan");
  }
  if (tileChipBtns.length) {
    tileChipBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.tile === tileTypeEl.value));
  }
  if (statusChipBtns.length) {
    statusChipBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.status === cleanStatusEl.value));
  }
}

function scheduleDraw() {
  if (needsRedraw) return;
  needsRedraw = true;
  requestAnimationFrame(() => {
    needsRedraw = false;
    if (needsCoverage) {
      updateCoverage();
      needsCoverage = false;
    }
    drawGrid();
  });
}

function setAlert(level) {
  if (level === "High") {
    alertBoxEl.textContent = "Wet zones detected near entries or checkouts.";
    alertBoxEl.style.borderColor = "#ff6b6b";
    alertBoxEl.style.background = "rgba(255, 107, 107, 0.12)";
  } else if (level === "Medium") {
    alertBoxEl.textContent = "Some wet areas remain. Finish cleanup.";
    alertBoxEl.style.borderColor = "#f7b500";
    alertBoxEl.style.background = "rgba(247, 181, 0, 0.12)";
  } else {
    alertBoxEl.textContent = "No alerts. Keep scanning.";
    alertBoxEl.style.borderColor = "#2fd47d";
    alertBoxEl.style.background = "rgba(47, 212, 125, 0.12)";
  }
}

function buildGrid(cols, rows, preserve = false) {
  gridState.cols = cols;
  gridState.rows = rows;

  if (!preserve) {
    gridState.cells = Array.from({ length: cols * rows }, createCell);
  } else if (gridState.cells.length !== cols * rows) {
    gridState.cells = Array.from({ length: cols * rows }, (_, index) => gridState.cells[index] || createCell());
  }

  updateCoverage();
  centerGrid();
  scheduleDraw();
}

function updateCoverage() {
  const floorCells = gridState.cells.filter((cell) => cell.tile === "floor");
  const total = floorCells.length || 1;
  const cleaned = floorCells.filter((cell) => cell.status === "cleaned").length;
  gridCoverageEl.textContent = `Cleaned: ${Math.round((cleaned / total) * 100)}%`;

  const risky = gridState.cells.filter(
    (cell) => (cell.tile === "entry" || cell.tile === "checkout") && cell.status === "wet"
  ).length;
  if (risky > 3) {
    setAlert("High");
  } else if (risky > 0) {
    setAlert("Medium");
  } else {
    setAlert("Low");
  }
}

function applyPaint(cell) {
  if (paintModeEl.value === "tile") {
    cell.tile = tileTypeEl.value;
    if (cell.tile !== "floor") {
      cell.status = "unknown";
    }
  } else {
    if (cell.tile === "floor" || cell.tile === "entry" || cell.tile === "checkout") {
      cell.status = cleanStatusEl.value;
    }
  }
  needsCoverage = true;
}

function paintCellAt(col, row) {
  if (col < 0 || row < 0 || col >= gridState.cols || row >= gridState.rows) return;
  const index = row * gridState.cols + col;
  const cell = gridState.cells[index];
  if (!cell) return;
  applyPaint(cell);
  setLayoutStatus("Unsaved");
}

function paintBrush(col, row) {
  const radius = Number(brushSizeEl?.value || 1) - 1;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > radius * radius) continue;
      paintCellAt(col + dx, row + dy);
    }
  }
}

function paintLine(from, to) {
  if (!from || !to) return;
  let x0 = from.col;
  let y0 = from.row;
  const x1 = to.col;
  const y1 = to.row;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    paintBrush(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function fillBucket(startCol, startRow) {
  if (startCol < 0 || startRow < 0 || startCol >= gridState.cols || startRow >= gridState.rows) return;
  const startIndex = startRow * gridState.cols + startCol;
  const startCell = gridState.cells[startIndex];
  if (!startCell) return;

  const target = {
    tile: startCell.tile,
    status: startCell.status,
  };

  const queue = [startIndex];
  const visited = new Set([startIndex]);

  while (queue.length) {
    const index = queue.shift();
    const cell = gridState.cells[index];
    if (!cell) continue;

    if (paintModeEl.value === "tile") {
      if (cell.tile !== target.tile) continue;
    } else if (cell.status !== target.status) {
      continue;
    }

    applyPaint(cell);

    const row = Math.floor(index / gridState.cols);
    const col = index % gridState.cols;
    const neighbors = [
      [col + 1, row],
      [col - 1, row],
      [col, row + 1],
      [col, row - 1],
    ];
    neighbors.forEach(([ncol, nrow]) => {
      if (ncol < 0 || nrow < 0 || ncol >= gridState.cols || nrow >= gridState.rows) return;
      const nIndex = nrow * gridState.cols + ncol;
      if (visited.has(nIndex)) return;
      visited.add(nIndex);
      queue.push(nIndex);
    });
  }

  setLayoutStatus("Unsaved");
  scheduleDraw();
}

function fillRect() {
  if (!rectStart || !rectEnd) return;
  const minCol = Math.min(rectStart.col, rectEnd.col);
  const maxCol = Math.max(rectStart.col, rectEnd.col);
  const minRow = Math.min(rectStart.row, rectEnd.row);
  const maxRow = Math.max(rectStart.row, rectEnd.row);
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      paintCellAt(col, row);
    }
  }
  rectStart = null;
  rectEnd = null;
  scheduleDraw();
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function fillLasso() {
  if (lassoPoints.length < 3) return;
  const polygon = lassoPoints.map((pt) => ({ x: pt.col + 0.5, y: pt.row + 0.5 }));
  for (let row = 0; row < gridState.rows; row += 1) {
    for (let col = 0; col < gridState.cols; col += 1) {
      const point = { x: col + 0.5, y: row + 0.5 };
      if (pointInPolygon(point, polygon)) {
        paintCellAt(col, row);
      }
    }
  }
  lassoPoints = [];
  scheduleDraw();
}

function clearStatus() {
  gridState.cells.forEach((cell) => {
    if (cell.tile === "floor" || cell.tile === "entry" || cell.tile === "checkout") {
      cell.status = "unknown";
    }
  });
  setLayoutStatus("Unsaved");
  needsCoverage = true;
  updateCoverage();
  scheduleDraw();
}

function saveLayout() {
  const payload = {
    name: storeNameEl.value.trim(),
    cols: gridState.cols,
    rows: gridState.rows,
    cells: gridState.cells,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  setLayoutStatus("Saved");
}

function exportLayout() {
  const payload = {
    name: storeNameEl.value.trim(),
    cols: gridState.cols,
    rows: gridState.rows,
    cells: gridState.cells,
  };
  layoutJsonEl.value = JSON.stringify(payload, null, 2);
  layoutJsonEl.focus();
  layoutJsonEl.select();
}

function importLayout(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      storeNameEl.value = payload.name || "";
      gridColsEl.value = payload.cols || 24;
      gridRowsEl.value = payload.rows || 16;
      gridState.cells = payload.cells || [];
      buildGrid(Number(gridColsEl.value), Number(gridRowsEl.value), true);
      setLayoutStatus("Imported");
    } catch (error) {
      setLayoutStatus("Import failed");
    }
  };
  reader.readAsText(file);
}

function loadLayout() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    buildGrid(Number(gridColsEl.value), Number(gridRowsEl.value));
    return;
  }
  try {
    const payload = JSON.parse(saved);
    storeNameEl.value = payload.name || "";
    gridColsEl.value = payload.cols || 24;
    gridRowsEl.value = payload.rows || 16;
    gridState.cells = payload.cells || [];
    buildGrid(Number(gridColsEl.value), Number(gridRowsEl.value), true);
    setLayoutStatus("Saved");
  } catch (error) {
    buildGrid(Number(gridColsEl.value), Number(gridRowsEl.value));
  }
}

function resetLayout() {
  buildGrid(Number(gridColsEl.value), Number(gridRowsEl.value));
  setLayoutStatus("Unsaved");
}

function applyPreset(type) {
  const preset = PRESETS[type];
  if (!preset) return;
  gridColsEl.value = preset.cols;
  gridRowsEl.value = preset.rows;
  buildGrid(preset.cols, preset.rows);

  const shelfRows = preset.shelves;
  const aisleGap = Math.max(2, Math.floor(preset.rows / (shelfRows + 1)));
  for (let row = 1; row < preset.rows - 1; row += aisleGap) {
    for (let col = 2; col < preset.cols - 2; col += 1) {
      const index = row * preset.cols + col;
      if (gridState.cells[index]) gridState.cells[index].tile = "shelf";
    }
  }

  for (let col = 0; col < preset.cols; col += 1) {
    const entryIndex = col;
    const checkoutIndex = (preset.rows - 1) * preset.cols + col;
    if (gridState.cells[entryIndex]) gridState.cells[entryIndex].tile = "entry";
    if (gridState.cells[checkoutIndex]) gridState.cells[checkoutIndex].tile = "checkout";
  }

  scheduleDraw();
  setLayoutStatus("Preset");
}

function resizeCanvas() {
  const rect = storeGridEl.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  storeGridEl.width = Math.max(1, Math.floor(rect.width * dpr));
  storeGridEl.height = Math.max(1, Math.floor(rect.height * dpr));
  if (miniMapEl) {
    const miniRect = miniMapEl.getBoundingClientRect();
    miniMapEl.width = Math.max(1, Math.floor(miniRect.width * dpr));
    miniMapEl.height = Math.max(1, Math.floor(miniRect.height * dpr));
  }
  scheduleDraw();
}

function centerGrid() {
  const rect = storeGridEl.getBoundingClientRect();
  const gridWidth = gridState.cols * view.baseCell * view.scale;
  const gridHeight = gridState.rows * view.baseCell * view.scale;
  view.offsetX = (rect.width - gridWidth) / 2;
  view.offsetY = (rect.height - gridHeight) / 2;
}

function worldToScreen(x, y) {
  return {
    x: view.offsetX + x * view.baseCell * view.scale,
    y: view.offsetY + y * view.baseCell * view.scale,
  };
}

function screenToCell(x, y) {
  const col = Math.floor((x - view.offsetX) / (view.baseCell * view.scale));
  const row = Math.floor((y - view.offsetY) / (view.baseCell * view.scale));
  return { col, row };
}

function clampScale(next) {
  return Math.max(view.minScale, Math.min(view.maxScale, next));
}

function zoomAt(clientX, clientY, factor) {
  const rect = storeGridEl.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const worldX = (x - view.offsetX) / (view.baseCell * view.scale);
  const worldY = (y - view.offsetY) / (view.baseCell * view.scale);

  view.scale = clampScale(view.scale * factor);
  view.offsetX = x - worldX * view.baseCell * view.scale;
  view.offsetY = y - worldY * view.baseCell * view.scale;
  scheduleDraw();
}

function jumpToMini(event) {
  if (!miniMapEl) return;
  const rect = miniMapEl.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const scale = Math.min(rect.width / gridState.cols, rect.height / gridState.rows);
  const offsetX = (rect.width - gridState.cols * scale) / 2;
  const offsetY = (rect.height - gridState.rows * scale) / 2;
  const col = (x - offsetX) / scale;
  const row = (y - offsetY) / scale;
  const viewRect = storeGridEl.getBoundingClientRect();
  view.offsetX = viewRect.width / 2 - col * view.baseCell * view.scale;
  view.offsetY = viewRect.height / 2 - row * view.baseCell * view.scale;
  scheduleDraw();
}

function drawMiniMap() {
  if (!miniMapEl) return;
  const ctx = miniMapEl.getContext("2d");
  const w = miniMapEl.width;
  const h = miniMapEl.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0c0f16";
  ctx.fillRect(0, 0, w, h);

  const scale = Math.min(w / gridState.cols, h / gridState.rows);
  const offsetX = (w - gridState.cols * scale) / 2;
  const offsetY = (h - gridState.rows * scale) / 2;

  for (let row = 0; row < gridState.rows; row += 1) {
    for (let col = 0; col < gridState.cols; col += 1) {
      const index = row * gridState.cols + col;
      const cell = gridState.cells[index];
      ctx.fillStyle = tileColors[cell.tile] || tileColors.floor;
      ctx.fillRect(offsetX + col * scale, offsetY + row * scale, scale, scale);
    }
  }

  // viewport box
  const rect = storeGridEl.getBoundingClientRect();
  const viewLeft = (-view.offsetX) / (view.baseCell * view.scale);
  const viewTop = (-view.offsetY) / (view.baseCell * view.scale);
  const viewCols = rect.width / (view.baseCell * view.scale);
  const viewRows = rect.height / (view.baseCell * view.scale);
  ctx.strokeStyle = "rgba(63, 198, 255, 0.8)";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    offsetX + viewLeft * scale,
    offsetY + viewTop * scale,
    viewCols * scale,
    viewRows * scale
  );
}

function drawOverlay(ctx, rect) {
  const cellSize = view.baseCell * view.scale;
  ctx.strokeStyle = "rgba(247, 181, 0, 0.8)";
  ctx.lineWidth = 2;

  if (rectStart && rectEnd && paintToolEl.value === "rect") {
    const x = Math.min(rectStart.col, rectEnd.col);
    const y = Math.min(rectStart.row, rectEnd.row);
    const w = Math.abs(rectStart.col - rectEnd.col) + 1;
    const h = Math.abs(rectStart.row - rectEnd.row) + 1;
    const pos = worldToScreen(x, y);
    ctx.strokeRect(pos.x + 1, pos.y + 1, w * cellSize - 2, h * cellSize - 2);
  }

  if (lassoPoints.length && paintToolEl.value === "lasso") {
    ctx.beginPath();
    lassoPoints.forEach((pt, index) => {
      const pos = worldToScreen(pt.col + 0.5, pt.row + 0.5);
      if (index === 0) ctx.moveTo(pos.x, pos.y);
      else ctx.lineTo(pos.x, pos.y);
    });
    ctx.stroke();
  }
}

function drawGrid() {
  const ctx = storeGridEl.getContext("2d");
  if (!ctx) return;
  const rect = storeGridEl.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#0c0f16";
  ctx.fillRect(0, 0, rect.width, rect.height);

  const cellSize = view.baseCell * view.scale;
  const startCol = Math.max(0, Math.floor((0 - view.offsetX) / cellSize) - 1);
  const endCol = Math.min(gridState.cols, Math.ceil((rect.width - view.offsetX) / cellSize) + 1);
  const startRow = Math.max(0, Math.floor((0 - view.offsetY) / cellSize) - 1);
  const endRow = Math.min(gridState.rows, Math.ceil((rect.height - view.offsetY) / cellSize) + 1);

  for (let row = startRow; row < endRow; row += 1) {
    for (let col = startCol; col < endCol; col += 1) {
      const index = row * gridState.cols + col;
      const cell = gridState.cells[index];
      if (!cell) continue;
      const pos = worldToScreen(col, row);
      ctx.fillStyle = tileColors[cell.tile] || tileColors.floor;
      ctx.fillRect(pos.x, pos.y, cellSize - 1, cellSize - 1);

      if (cell.status && cell.status !== "unknown") {
        ctx.fillStyle = statusOverlays[cell.status];
        ctx.fillRect(pos.x + 3, pos.y + 3, cellSize - 7, cellSize - 7);
      } else if (cell.status === "unknown" && (cell.tile === "floor" || cell.tile === "entry" || cell.tile === "checkout")) {
        ctx.fillStyle = statusOverlays.unknown;
        ctx.fillRect(pos.x + 3, pos.y + 3, cellSize - 7, cellSize - 7);
      }

      if (showLabels && cell.tile === "shelf" && cellSize > 26) {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = `${Math.max(10, cellSize * 0.3)}px Space Grotesk`;
        ctx.fillText("SHLF", pos.x + 4, pos.y + cellSize * 0.6);
      }
      if (showLabels && cell.tile === "entry" && cellSize > 26) {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = `${Math.max(10, cellSize * 0.3)}px Space Grotesk`;
        ctx.fillText("ENT", pos.x + 6, pos.y + cellSize * 0.6);
      }
      if (showLabels && cell.tile === "checkout" && cellSize > 26) {
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = `${Math.max(10, cellSize * 0.3)}px Space Grotesk`;
        ctx.fillText("CHK", pos.x + 6, pos.y + cellSize * 0.6);
      }
    }
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let col = startCol; col <= endCol; col += 1) {
    const x = view.offsetX + col * cellSize;
    ctx.beginPath();
    ctx.moveTo(x, view.offsetY + startRow * cellSize);
    ctx.lineTo(x, view.offsetY + endRow * cellSize);
    ctx.stroke();
  }
  for (let row = startRow; row <= endRow; row += 1) {
    const y = view.offsetY + row * cellSize;
    ctx.beginPath();
    ctx.moveTo(view.offsetX + startCol * cellSize, y);
    ctx.lineTo(view.offsetX + endCol * cellSize, y);
    ctx.stroke();
  }

  drawOverlay(ctx, rect);
  drawMiniMap();
}

const pointers = new Map();

storeGridEl.addEventListener("contextmenu", (event) => event.preventDefault());

storeGridEl.addEventListener("pointerdown", (event) => {
  storeGridEl.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pointers.size === 2) {
    const pts = Array.from(pointers.values());
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    const dist = Math.hypot(dx, dy);
    const center = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    pinchState = { dist, scale: view.scale, center };
    painting = false;
    panMode = false;
    return;
  }

  if (event.button === 2 || event.shiftKey || event.altKey || panOverride || paintToolEl.value === "pan") {
    panMode = true;
    lastPoint = { x: event.clientX, y: event.clientY };
    painting = false;
  } else {
    painting = true;
    panMode = false;
    const rect = storeGridEl.getBoundingClientRect();
    const { col, row } = screenToCell(event.clientX - rect.left, event.clientY - rect.top);

    if (paintToolEl.value === "bucket") {
      fillBucket(col, row);
      painting = false;
      return;
    }

    if (paintToolEl.value === "rect") {
      rectStart = { col, row };
      rectEnd = { col, row };
      scheduleDraw();
      return;
    }

    if (paintToolEl.value === "lasso") {
      lassoPoints = [{ col, row }];
      scheduleDraw();
      return;
    }

    lastPaintCell = { col, row };
    paintBrush(col, row);
    scheduleDraw();
  }
});

storeGridEl.addEventListener("pointermove", (event) => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pointers.size === 2 && pinchState) {
    const pts = Array.from(pointers.values());
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    const dist = Math.hypot(dx, dy);
    const center = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const factor = dist / pinchState.dist;
    const nextScale = clampScale(pinchState.scale * factor);

    const rect = storeGridEl.getBoundingClientRect();
    const x = center.x - rect.left;
    const y = center.y - rect.top;
    const worldX = (x - view.offsetX) / (view.baseCell * view.scale);
    const worldY = (y - view.offsetY) / (view.baseCell * view.scale);
    view.scale = nextScale;
    view.offsetX = x - worldX * view.baseCell * view.scale;
    view.offsetY = y - worldY * view.baseCell * view.scale;
    scheduleDraw();
    return;
  }

  if (panMode && lastPoint) {
    const dx = event.clientX - lastPoint.x;
    const dy = event.clientY - lastPoint.y;
    view.offsetX += dx;
    view.offsetY += dy;
    lastPoint = { x: event.clientX, y: event.clientY };
    scheduleDraw();
    return;
  }

  if (painting) {
    const rect = storeGridEl.getBoundingClientRect();
    const { col, row } = screenToCell(event.clientX - rect.left, event.clientY - rect.top);

    if (paintToolEl.value === "rect" && rectStart) {
      rectEnd = { col, row };
      scheduleDraw();
      return;
    }

    if (paintToolEl.value === "lasso") {
      lassoPoints.push({ col, row });
      scheduleDraw();
      return;
    }

    const next = { col, row };
    paintLine(lastPaintCell, next);
    lastPaintCell = next;
    scheduleDraw();
  }
});

storeGridEl.addEventListener("pointerup", (event) => {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) {
    pinchState = null;
  }

  if (paintToolEl.value === "rect" && rectStart && rectEnd) {
    fillRect();
  }

  if (paintToolEl.value === "lasso" && lassoPoints.length) {
    fillLasso();
  }

  painting = false;
  panMode = false;
  lastPaintCell = null;
});

storeGridEl.addEventListener("pointerleave", () => {
  painting = false;
  panMode = false;
  lastPaintCell = null;
});

storeGridEl.addEventListener("wheel", (event) => {
  event.preventDefault();
  const factor = event.deltaY > 0 ? 0.9 : 1.1;
  zoomAt(event.clientX, event.clientY, factor);
});

[gridColsEl, gridRowsEl].forEach((input) => {
  input.addEventListener("change", () => {
    buildGrid(Number(gridColsEl.value), Number(gridRowsEl.value));
    setLayoutStatus("Unsaved");
  });
});

presetLayoutEl.addEventListener("change", () => {
  if (!presetLayoutEl.value) return;
  applyPreset(presetLayoutEl.value);
});

exportLayoutBtn.addEventListener("click", exportLayout);
importLayoutInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  importLayout(file);
  importLayoutInput.value = "";
});

toggleLabelsBtn.addEventListener("click", () => {
  showLabels = !showLabels;
  toggleLabelsBtn.textContent = `Aisle Labels: ${showLabels ? "On" : "Off"}`;
  scheduleDraw();
});

saveLayoutBtn.addEventListener("click", saveLayout);
if (panToggleBtn) {
  panToggleBtn.addEventListener("click", () => {
    paintToolEl.value = "pan";
    syncToolbar();
  });
}
if (modeTileBtn) {
  modeTileBtn.addEventListener("click", () => {
    paintModeEl.value = "tile";
    syncToolbar();
  });
}
if (modeStatusBtn) {
  modeStatusBtn.addEventListener("click", () => {
    paintModeEl.value = "status";
    syncToolbar();
  });
}
if (toolBrushBtn) {
  toolBrushBtn.addEventListener("click", () => {
    paintToolEl.value = "brush";
    syncToolbar();
  });
  toolBucketBtn.addEventListener("click", () => {
    paintToolEl.value = "bucket";
    syncToolbar();
  });
  toolRectBtn.addEventListener("click", () => {
    paintToolEl.value = "rect";
    syncToolbar();
  });
  toolLassoBtn.addEventListener("click", () => {
    paintToolEl.value = "lasso";
    syncToolbar();
  });
  toolPanBtn.addEventListener("click", () => {
    paintToolEl.value = "pan";
    syncToolbar();
  });
}
if (tileChipBtns.length) {
  tileChipBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tileTypeEl.value = btn.dataset.tile;
      syncToolbar();
    });
  });
}
if (statusChipBtns.length) {
  statusChipBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      cleanStatusEl.value = btn.dataset.status;
      syncToolbar();
    });
  });
}

resetLayoutBtn.addEventListener("click", resetLayout);
clearStatusBtn.addEventListener("click", clearStatus);

window.addEventListener("resize", resizeCanvas);

if (miniMapEl) {
  miniMapEl.addEventListener("pointerdown", (event) => {
    miniDragging = true;
    miniMapEl.setPointerCapture(event.pointerId);
    jumpToMini(event);
  });
  miniMapEl.addEventListener("pointermove", (event) => {
    if (!miniDragging) return;
    jumpToMini(event);
  });
  miniMapEl.addEventListener("pointerup", () => {
    miniDragging = false;
  });
  miniMapEl.addEventListener("pointerleave", () => {
    miniDragging = false;
  });
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    panOverride = true;
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    panOverride = false;
  }
});

loadLayout();
resizeCanvas();
