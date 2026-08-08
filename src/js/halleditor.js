import Konva from "konva";

// --- دیتا استراکچر داینامیک فضاها ---
let floors = [
  {
    id: "floor_1",
    name: "سالن اصلی",
    sections: [
      {
        id: "sec_main_1",
        name: "سکشن اصلی",
        x: 100,
        y: 150,
        seats: [],
      },
    ],
  },
];

let currentFloorId = "floor_1";
let currentTool = "move";

let selectedSeatIds = [];
let selectedSectionId = null;

let zoneHistory = {
  floor_1: { history: [], index: -1 },
};

function getCurrentFloor() {
  return floors.find((f) => f.id === currentFloorId) || floors[0];
}

function getActiveSections() {
  return getCurrentFloor().sections;
}

function setActiveSections(newData) {
  getCurrentFloor().sections = newData;
}

// --- مدیریت تاریخچه Undo / Redo ---
function saveState() {
  if (!zoneHistory[currentFloorId]) {
    zoneHistory[currentFloorId] = { history: [], index: -1 };
  }
  let hData = zoneHistory[currentFloorId];
  if (hData.index < hData.history.length - 1) {
    hData.history = hData.history.slice(0, hData.index + 1);
  }
  const currentFloorObj = getCurrentFloor();
  hData.history.push(JSON.stringify(currentFloorObj.sections));
  hData.index++;
}

function undo() {
  let hData = zoneHistory[currentFloorId];
  if (hData && hData.index > 0) {
    hData.index--;
    getCurrentFloor().sections = JSON.parse(hData.history[hData.index]);
    clearSelection();
    closeSidebar();
    renderSeats();
  }
}

function redo() {
  let hData = zoneHistory[currentFloorId];
  if (hData && hData.index < hData.history.length - 1) {
    hData.index++;
    getCurrentFloor().sections = JSON.parse(hData.history[hData.index]);
    clearSelection();
    closeSidebar();
    renderSeats();
  }
}

function clearSelection() {
  selectedSeatIds = [];
  selectedSectionId = null;
  updateToolbarContext();
}

// --- مدیریت سایدبار کشویی ---
function openSidebar() {
  const sidebar = document.getElementById("seat-sidebar");
  const infoBadge = document.getElementById("sidebar-seat-info");
  const labelInput = document.getElementById("seat-label-input");
  const priceInput = document.getElementById("seat-price-input");
  const typeSelect = document.getElementById("seat-type-select");

  if (!sidebar) return;

  const count = selectedSeatIds.length;
  if (count === 0) {
    closeSidebar();
    return;
  }

  let firstSeat = null;
  let sectionName = "";

  getActiveSections().forEach((sec) => {
    const found = sec.seats.find((s) => s.id === selectedSeatIds[0]);
    if (found) {
      firstSeat = found;
      sectionName = sec.name;
    }
  });

  if (infoBadge) {
    if (count === 1 && firstSeat) {
      infoBadge.textContent = `${sectionName} | ردیف ${firstSeat.row} - شماره ${firstSeat.number}`;
    } else {
      infoBadge.textContent = `${count} صندلی انتخاب شده است`;
    }
  }

  if (labelInput && firstSeat) {
    labelInput.value = count === 1 ? firstSeat.customText || "" : "";
  }

  if (priceInput && firstSeat) {
    priceInput.value = firstSeat.price || 0;
  }

  if (typeSelect && firstSeat) {
    typeSelect.value = firstSeat.type || "regular";
  }

  sidebar.classList.add("open");
}

function closeSidebar() {
  const sidebar = document.getElementById("seat-sidebar");
  if (sidebar) {
    sidebar.classList.remove("open");
  }
}

document.getElementById("close-sidebar-btn")?.addEventListener("click", closeSidebar);

// همگام‌سازی متن/شماره سفارشی
document.getElementById("seat-label-input")?.addEventListener("input", (e) => {
  const newLabel = e.target.value;

  if (selectedSeatIds.length > 0) {
    getActiveSections().forEach((sec) => {
      sec.seats.forEach((seat) => {
        if (selectedSeatIds.includes(seat.id)) {
          seat.customText = newLabel;
        }
      });
    });
    saveState();
    renderSeats();
  }
});

// همگام‌سازی قیمت
document.getElementById("seat-price-input")?.addEventListener("input", (e) => {
  const newPrice = parseFloat(e.target.value) || 0;

  if (selectedSeatIds.length > 0) {
    getActiveSections().forEach((sec) => {
      sec.seats.forEach((seat) => {
        if (selectedSeatIds.includes(seat.id)) {
          seat.price = newPrice;
        }
      });
    });
    saveState();
  }
});

// همگام‌سازی نوع صندلی
document.getElementById("seat-type-select")?.addEventListener("change", (e) => {
  const newType = e.target.value;

  if (selectedSeatIds.length > 0) {
    getActiveSections().forEach((sec) => {
      sec.seats.forEach((seat) => {
        if (selectedSeatIds.includes(seat.id)) {
          seat.type = newType;
        }
      });
    });
    saveState();
    renderSeats();
  }
});

// --- راه‌اندازی بوم Konva ---
const stage = new Konva.Stage({
  container: "container",
  width: window.innerWidth,
  height: window.innerHeight,
  draggable: false,
});

const layer = new Konva.Layer();
stage.add(layer);

const GRID_SIZE = 50;
const SEAT_SIZE = 40;
const SECTION_PADDING = 60;

let lastValidPosition = { x: 0, y: 0 };
let lastValidSectionPosition = { x: 0, y: 0 };

function haveIntersection(r1, r2) {
  return !(
    r2.x >= r1.x + r1.width ||
    r2.x + r2.width <= r1.x ||
    r2.y >= r1.y + r1.height ||
    r2.y + r2.height <= r1.y
  );
}

// --- کادر انتخاب ویندوزی ---
let selectionRect = new Konva.Rect({
  fill: "rgba(52, 152, 219, 0.25)",
  stroke: "#3498db",
  strokeWidth: 1.5,
  dash: [4, 4],
  visible: false,
  listening: false,
});
layer.add(selectionRect);

// --- مدیریت تولبارها ---
function updateToolbarContext() {
  const sectionTb = document.getElementById("section-toolbar");
  const seatTb = document.getElementById("seat-toolbar");

  if (selectedSectionId) {
    if (sectionTb) sectionTb.style.display = "flex";
    if (seatTb) seatTb.style.display = "none";

    const sec = getActiveSections().find((s) => s.id === selectedSectionId);
    if (sec) {
      const nameInput = document.getElementById("sec-name-input");
      if (nameInput) nameInput.value = sec.name;

      const regularSeats = sec.seats.filter((s) => s.row !== "آزاد");
      const rows = new Set(regularSeats.map((s) => s.row)).size;
      const maxCols = regularSeats.length > 0 ? Math.max(...regularSeats.map((s) => s.number)) : 0;

      const rowsInput = document.getElementById("sec-rows-input");
      const colsInput = document.getElementById("sec-cols-input");
      if (rowsInput) rowsInput.value = rows;
      if (colsInput) colsInput.value = maxCols;
    }
  } else if (selectedSeatIds.length > 0) {
    if (sectionTb) sectionTb.style.display = "none";
    if (seatTb) seatTb.style.display = "flex";
  } else {
    if (sectionTb) sectionTb.style.display = "none";
    if (seatTb) seatTb.style.display = "none";
  }
}

// --- شماره‌گذاری مجدد صندلی‌ها ---
function reorderSectionSeats(sec) {
  if (!sec || !sec.seats.length) return;

  const rowsMap = new Map();

  sec.seats.forEach((seat) => {
    seat.x = Math.round(seat.x / GRID_SIZE) * GRID_SIZE;
    seat.y = Math.round(seat.y / GRID_SIZE) * GRID_SIZE;

    if (!rowsMap.has(seat.y)) {
      rowsMap.set(seat.y, []);
    }
    rowsMap.get(seat.y).push(seat);
  });

  const sortedY = Array.from(rowsMap.keys()).sort((a, b) => a - b);

  sortedY.forEach((yVal, rowIndex) => {
    const rowSeats = rowsMap.get(yVal);
    rowSeats.sort((a, b) => a.x - b.x);

    rowSeats.forEach((seat, colIndex) => {
      seat.row = rowIndex + 1;
      seat.number = colIndex + 1;
    });
  });
}

// --- رندر صندلی‌ها ---
function renderSeats() {
  layer.destroyChildren();

  const currentSections = getActiveSections();

  currentSections.forEach((sec) => {
    let minX = 0, maxX = 300, minY = 0, maxY = 250;

    if (sec.seats.length > 0) {
      minX = Math.min(...sec.seats.map((s) => s.x));
      maxX = Math.max(...sec.seats.map((s) => s.x)) + SEAT_SIZE;
      minY = Math.min(...sec.seats.map((s) => s.y));
      maxY = Math.max(...sec.seats.map((s) => s.y)) + SEAT_SIZE;
    }

    const secWidth = maxX - minX + SECTION_PADDING * 2;
    const secHeight = maxY - minY + SECTION_PADDING * 2;
    const secStartX = minX - SECTION_PADDING;
    const secStartY = minY - SECTION_PADDING;

    const isSecSelected = selectedSectionId === sec.id;

    const sectionGroup = new Konva.Group({
      x: sec.x,
      y: sec.y,
      draggable: currentTool === "move",
      id: sec.id,
    });

    sectionGroup.setAttrs({
      secStartX: secStartX,
      secStartY: secStartY,
      secWidth: secWidth,
      secHeight: secHeight,
    });

    sectionGroup.on("click", (e) => {
      if (e.target === sectionBox || e.target === sectionTitle) {
        e.cancelBubble = true;
        selectedSectionId = sec.id;
        selectedSeatIds = [];
        closeSidebar();
        updateToolbarContext();
        renderSeats();
      }
    });

    sectionGroup.on("dragstart", (e) => {
      if (e.target === sectionGroup) {
        selectedSectionId = sec.id;
        selectedSeatIds = [];
        closeSidebar();
        updateToolbarContext();
        lastValidSectionPosition = { x: e.target.x(), y: e.target.y() };
      }
    });

    sectionGroup.on("dragmove", (e) => {
      if (e.target !== sectionGroup) return;

      const movingX = e.target.x();
      const movingY = e.target.y();

      const movingBox = {
        x: movingX + secStartX,
        y: movingY + secStartY,
        width: secWidth,
        height: secHeight,
      };

      let isSectionCollision = false;

      layer.getChildren().forEach((otherGroup) => {
        if (
          otherGroup === selectionRect ||
          otherGroup === sectionGroup ||
          !otherGroup.id()?.startsWith("sec_")
        )
          return;

        const otherStartX = otherGroup.getAttr("secStartX") || 0;
        const otherStartY = otherGroup.getAttr("secStartY") || 0;
        const otherWidth = otherGroup.getAttr("secWidth") || 0;
        const otherHeight = otherGroup.getAttr("secHeight") || 0;

        const otherBox = {
          x: otherGroup.x() + otherStartX,
          y: otherGroup.y() + otherStartY,
          width: otherWidth,
          height: otherHeight,
        };

        if (haveIntersection(movingBox, otherBox)) {
          isSectionCollision = true;
        }
      });

      if (isSectionCollision) {
        e.target.x(lastValidSectionPosition.x);
        e.target.y(lastValidSectionPosition.y);
      } else {
        lastValidSectionPosition = { x: movingX, y: movingY };
      }
    });

    sectionGroup.on("dragend", (e) => {
      if (e.target === sectionGroup) {
        sec.x = e.target.x();
        sec.y = e.target.y();
        saveState();
      }
    });

    const sectionBox = new Konva.Rect({
      x: secStartX,
      y: secStartY,
      width: secWidth,
      height: secHeight,
      stroke: isSecSelected ? "#3498db" : "#FF6900",
      strokeWidth: isSecSelected ? 3 : 2,
      dash: isSecSelected ? [] : [6, 6],
      cornerRadius: 12,
      id: `__box_${sec.id}`,
    });

    sectionGroup.add(sectionBox);

    const sectionTitle = new Konva.Text({
      x: secStartX,
      y: secStartY - 35,
      text: sec.name,
      fontSize: 18,
      fontFamily: "Vazirmatn",
      fill: isSecSelected ? "#3498db" : "#FF6900",
      fontStyle: "bold",
      width: secWidth,
      align: "center",
      cursor: "pointer",
      id: `__title_${sec.id}`,
    });

    sectionGroup.add(sectionTitle);

    const rowsMap = {};
    sec.seats.forEach((seat) => {
      if (seat.row !== "آزاد") {
        if (!rowsMap[seat.row]) rowsMap[seat.row] = [];
        rowsMap[seat.row].push(seat);
      }
    });

    Object.keys(rowsMap).forEach((rowNum) => {
      const rowSeats = rowsMap[rowNum];
      if (rowSeats.length === 0) return;

      let minXSeat = rowSeats[0];
      let maxXSeat = rowSeats[0];

      rowSeats.forEach((s) => {
        if (s.x < minXSeat.x) minXSeat = s;
        if (s.x > maxXSeat.x) maxXSeat = s;
      });

      const labelY = minXSeat.y;

      sectionGroup.add(
        new Konva.Text({
          x: minXSeat.x - 40,
          y: labelY,
          text: `${rowNum}`,
          fontSize: 14,
          fontFamily: "Vazirmatn",
          fill: "#888888",
          width: 25,
          height: SEAT_SIZE,
          align: "right",
          verticalAlign: "middle",
        })
      );

      sectionGroup.add(
        new Konva.Text({
          x: maxXSeat.x + SEAT_SIZE + 15,
          y: labelY,
          text: `${rowNum}`,
          fontSize: 14,
          fontFamily: "Vazirmatn",
          fill: "#888888",
          width: 25,
          height: SEAT_SIZE,
          align: "left",
          verticalAlign: "middle",
        })
      );
    });

    sec.seats.forEach((seat) => {
      const isSelected = selectedSeatIds.includes(seat.id);

      const seatGroup = new Konva.Group({
        x: seat.x,
        y: seat.y,
        id: seat.id,
        draggable: currentTool === "move",
      });

      let strokeColor = "#BBBBBB";
      let fillColor = "#171717";

      if (seat.type === "vip") {
        strokeColor = "#F1C40F";
      } else if (seat.type === "wheelchair") {
        strokeColor = "#3498DB";
      }

      if (isSelected) {
        strokeColor = "#FF6900";
      }

      const rect = new Konva.Rect({
        width: SEAT_SIZE,
        height: SEAT_SIZE,
        fill: fillColor,
        cornerRadius: 6,
        stroke: strokeColor,
        strokeWidth: isSelected ? 3 : 2,
      });

      const text = new Konva.Text({
        text: seat.customText ? seat.customText : `${seat.number}`,
        fontSize: 14,
        fontFamily: "Vazirmatn",
        fill: seat.type === "vip" ? "#F1C40F" : "#BBBBBB",
        width: SEAT_SIZE,
        height: SEAT_SIZE,
        align: "center",
        verticalAlign: "middle",
      });

      seatGroup.add(rect);
      seatGroup.add(text);

      let startPositions = [];

      seatGroup.on("dragstart", (e) => {
        e.cancelBubble = true;
        selectedSectionId = null;
        if (!selectedSeatIds.includes(seat.id)) {
          selectedSeatIds = [seat.id];
        }
        updateToolbarContext();

        startPositions = selectedSeatIds.map((id) => {
          let sFound = null;
          getActiveSections().forEach((s) => {
            const found = s.seats.find((item) => item.id === id);
            if (found) sFound = found;
          });
          return { id: sFound.id, x: sFound.x, y: sFound.y };
        });

        lastValidPosition = { x: e.target.x(), y: e.target.y() };
        stage.draggable(false);
      });

      seatGroup.on("dragmove", (e) => {
        e.cancelBubble = true;
        const originalSeat = startPositions.find((p) => p.id === seat.id);
        if (!originalSeat) return;

        const dx = e.target.x() - originalSeat.x;
        const dy = e.target.y() - originalSeat.y;

        let nextX_Raw = originalSeat.x + dx;
        let nextY_Raw = originalSeat.y + dy;

        let nextX_Snapped = !e.evt.altKey ? Math.round(nextX_Raw / GRID_SIZE) * GRID_SIZE : nextX_Raw;
        let nextY_Snapped = !e.evt.altKey ? Math.round(nextY_Raw / GRID_SIZE) * GRID_SIZE : nextY_Raw;

        let isCollisionDetected = false;

        sectionGroup.getChildren().forEach((otherGroup) => {
          if (
            otherGroup === selectionRect ||
            otherGroup.id()?.startsWith("__") ||
            otherGroup.id() === sec.id
          )
            return;

          if (!selectedSeatIds.includes(otherGroup.id())) {
            const otherRect = { x: otherGroup.x(), y: otherGroup.y(), width: SEAT_SIZE, height: SEAT_SIZE };

            selectedSeatIds.forEach((movingId) => {
              const movingStartPos = startPositions.find((p) => p.id === movingId);
              if (movingStartPos) {
                let mX = movingStartPos.x + dx;
                let mY = movingStartPos.y + dy;
                if (!e.evt.altKey) {
                  mX = Math.round(mX / GRID_SIZE) * GRID_SIZE;
                  mY = Math.round(mY / GRID_SIZE) * GRID_SIZE;
                }

                if (haveIntersection({ x: mX, y: mY, width: SEAT_SIZE, height: SEAT_SIZE }, otherRect)) {
                  isCollisionDetected = true;
                }
              }
            });
          }
        });

        if (isCollisionDetected) {
          e.target.x(lastValidPosition.x);
          e.target.y(lastValidPosition.y);
          return;
        }

        lastValidPosition = { x: nextX_Snapped, y: nextY_Snapped };

        sectionGroup.getChildren().forEach((group) => {
          if (selectedSeatIds.includes(group.id())) {
            const startPos = startPositions.find((p) => p.id === group.id());
            if (startPos) {
              if (group.id() === seat.id) {
                group.x(nextX_Snapped);
                group.y(nextY_Snapped);
              } else {
                let followerX = startPos.x + dx;
                let followerY = startPos.y + dy;
                if (!e.evt.altKey) {
                  followerX = Math.round(followerX / GRID_SIZE) * GRID_SIZE;
                  followerY = Math.round(followerY / GRID_SIZE) * GRID_SIZE;
                }
                group.x(followerX);
                group.y(followerY);
              }
            }
          }
        });
      });

      seatGroup.on("dragend", (e) => {
        e.cancelBubble = true;
        sectionGroup.getChildren().forEach((group) => {
          if (selectedSeatIds.includes(group.id())) {
            const targetSeat = sec.seats.find((s) => s.id === group.id());
            if (targetSeat) {
              targetSeat.x = group.x();
              targetSeat.y = group.y();
            }
          }
        });

        reorderSectionSeats(sec);
        saveState();
        renderSeats();
        openSidebar();
      });

      seatGroup.on("click", (e) => {
        e.cancelBubble = true;
        selectedSectionId = null;

        if (!e.evt.ctrlKey && !e.evt.metaKey) {
          selectedSeatIds = [seat.id];
        } else {
          if (selectedSeatIds.includes(seat.id)) {
            selectedSeatIds = selectedSeatIds.filter((id) => id !== seat.id);
          } else {
            selectedSeatIds.push(seat.id);
          }
        }

        updateToolbarContext();
        renderSeats();

        if (selectedSeatIds.length > 0) {
          openSidebar();
        } else {
          closeSidebar();
        }
      });

      sectionGroup.add(seatGroup);
    });

    layer.add(sectionGroup);
  });

  layer.add(selectionRect);
  selectionRect.moveToTop();

  layer.draw();
}

// --- کلیک روی بوم (Deselect) ---
stage.on("click", (e) => {
  if (e.target === stage) {
    clearSelection();
    closeSidebar();
    renderSeats();
  }
});

// --- ساخت سکشن جدید ---
document.getElementById("generate-grid-btn")?.addEventListener("click", () => {
  const currentSections = getActiveSections();
  const newSecId = `sec_${currentFloorId}_${Date.now()}`;
  const defaultRows = 5;
  const defaultCols = 10;
  const newSeats = [];

  for (let r = 1; r <= defaultRows; r++) {
    for (let c = 1; c <= defaultCols; c++) {
      newSeats.push({
        id: `seat_${newSecId}_${r}_${c}_${Date.now()}`,
        row: r,
        number: c,
        x: c * GRID_SIZE,
        y: r * GRID_SIZE,
        price: 0,
        type: "regular",
      });
    }
  }

  currentSections.push({
    id: newSecId,
    name: `سکشن ${currentSections.length + 1}`,
    x: 100 + currentSections.length * 50,
    y: 100,
    seats: newSeats,
  });

  selectedSectionId = newSecId;
  closeSidebar();
  updateToolbarContext();
  saveState();
  renderSeats();
});

// --- افزودن تک صندلی ---
document.getElementById("add-seat-btn")?.addEventListener("click", () => {
  if (!selectedSectionId) return;

  const currentSections = getActiveSections();
  const sec = currentSections.find((s) => s.id === selectedSectionId);
  if (!sec) return;

  let maxX = 0;
  let maxY = GRID_SIZE;

  if (sec.seats.length > 0) {
    maxX = Math.max(...sec.seats.map((s) => s.x));
    const seatsInMaxX = sec.seats.filter((s) => s.x === maxX);
    maxY = Math.max(...seatsInMaxX.map((s) => s.y));
  }

  let newX = maxX + GRID_SIZE;
  let newY = maxY;

  if (newX > 10 * GRID_SIZE) {
    newX = GRID_SIZE;
    newY += GRID_SIZE;
  }

  const newSeatId = `seat_${sec.id}_single_${Date.now()}`;
  const newSeat = {
    id: newSeatId,
    row: 1,
    number: sec.seats.length + 1,
    x: newX,
    y: newY,
    price: 0,
    type: "regular",
  };

  sec.seats.push(newSeat);

  reorderSectionSeats(sec);

  selectedSectionId = null;
  selectedSeatIds = [newSeatId];

  saveState();
  updateToolbarContext();
  renderSeats();
  openSidebar();
});

// --- تغییر ابعاد سکشن ---
function updateSelectedSectionDimensions(newRows, newCols) {
  if (!selectedSectionId) return;

  const currentSections = getActiveSections();
  const sec = currentSections.find((s) => s.id === selectedSectionId);
  if (!sec) return;

  const existingSeatsMap = new Map();
  sec.seats.forEach((seat) => {
    existingSeatsMap.set(`${seat.row}_${seat.number}`, seat);
  });

  let newSeats = [];
  for (let r = 1; r <= newRows; r++) {
    for (let c = 1; c <= newCols; c++) {
      const key = `${r}_${c}`;
      const existingSeat = existingSeatsMap.get(key);

      if (existingSeat) {
        newSeats.push({
          ...existingSeat,
          x: c * GRID_SIZE,
          y: r * GRID_SIZE,
        });
      } else {
        newSeats.push({
          id: `seat_${sec.id}_${r}_${c}_${Date.now()}`,
          row: r,
          number: c,
          x: c * GRID_SIZE,
          y: r * GRID_SIZE,
          price: 0,
          type: "regular",
        });
      }
    }
  }

  sec.seats = newSeats;
  reorderSectionSeats(sec);
  saveState();
  renderSeats();
}

// --- مدیریت فضاها ---
function renderZoneSelectOptions() {
  const optionsList = document.getElementById("options-list");
  const currentLabel = document.getElementById("current-zone-label");
  if (!optionsList) return;

  optionsList.innerHTML = "";

  floors.forEach((floor) => {
    const item = document.createElement("div");
    item.className = `dropdown-item ${floor.id === currentFloorId ? "active" : ""}`;
    item.textContent = floor.name;

    item.addEventListener("click", () => {
      const currentFloor = getCurrentFloor();
      if (currentFloor) {
        currentFloor.sections = getActiveSections();
      }

      currentFloorId = floor.id;
      if (currentLabel) currentLabel.textContent = floor.name;
      closeZoneDropdown();
      clearSelection();
      closeSidebar();
      renderSeats();
      renderZoneSelectOptions();
    });

    optionsList.appendChild(item);
  });

  const activeFloor = getCurrentFloor();
  if (currentLabel && activeFloor) {
    currentLabel.textContent = activeFloor.name;
  }
}

function closeZoneDropdown() {
  const menu = document.getElementById("dropdown-menu");
  const inputWrapper = document.getElementById("add-zone-input-wrapper");
  const showBtn = document.getElementById("show-add-input-btn");
  const input = document.getElementById("new-zone-input");

  if (menu) menu.classList.remove("show");
  if (inputWrapper) inputWrapper.style.display = "none";
  if (showBtn) showBtn.style.display = "flex";
  if (input) input.value = "";
}

document.getElementById("dropdown-trigger")?.addEventListener("click", (e) => {
  e.stopPropagation();
  const menu = document.getElementById("dropdown-menu");
  menu?.classList.toggle("show");
});

window.addEventListener("click", (e) => {
  const dropdown = document.getElementById("zone-dropdown");
  if (dropdown && !dropdown.contains(e.target)) {
    closeZoneDropdown();
  }
});

document.getElementById("show-add-input-btn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  const showBtn = document.getElementById("show-add-input-btn");
  const inputWrapper = document.getElementById("add-zone-input-wrapper");
  const input = document.getElementById("new-zone-input");

  if (showBtn) showBtn.style.display = "none";
  if (inputWrapper) inputWrapper.style.display = "flex";
  if (input) input.focus();
});

function handleCreateNewZone() {
  const input = document.getElementById("new-zone-input");
  const name = input?.value.trim();

  if (name) {
    const currentFloor = getCurrentFloor();
    if (currentFloor) {
      currentFloor.sections = getActiveSections();
    }

    const newFloorId = `floor_${Date.now()}`;
    floors.push({
      id: newFloorId,
      name: name,
      sections: [],
    });

    zoneHistory[newFloorId] = { history: [], index: -1 };
    currentFloorId = newFloorId;

    saveState();
    renderZoneSelectOptions();
    clearSelection();
    closeSidebar();
    renderSeats();
    closeZoneDropdown();
  }
}

document.getElementById("confirm-add-zone-btn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  handleCreateNewZone();
});

document.getElementById("new-zone-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleCreateNewZone();
  }
});

document.getElementById("cancel-add-zone-btn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  closeZoneDropdown();
});

// --- ویرایش آنلاین نام فضای فعال ---
const editZoneBtn = document.getElementById("edit-zone-name-btn");
const editZoneInput = document.getElementById("edit-zone-input");
const triggerBtn = document.getElementById("dropdown-trigger");

editZoneBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  closeZoneDropdown();
  const currentFloor = getCurrentFloor();
  if (!currentFloor || !editZoneInput || !triggerBtn) return;

  triggerBtn.style.display = "none";
  editZoneBtn.style.display = "none";
  editZoneInput.style.display = "block";
  editZoneInput.value = currentFloor.name;
  editZoneInput.focus();
});

function saveZoneNameChange() {
  if (!editZoneInput || editZoneInput.style.display === "none") return;

  const newName = editZoneInput.value.trim();
  const currentFloor = getCurrentFloor();

  if (newName && currentFloor) {
    currentFloor.name = newName;
    renderZoneSelectOptions();
  }

  editZoneInput.style.display = "none";
  if (triggerBtn) triggerBtn.style.display = "flex";
  if (editZoneBtn) editZoneBtn.style.display = "flex";
}

editZoneInput?.addEventListener("blur", saveZoneNameChange);
editZoneInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    saveZoneNameChange();
  }
});

// --- لیسنرهای تولبار ---
document.getElementById("sec-name-input")?.addEventListener("input", (e) => {
  if (selectedSectionId) {
    const sec = getActiveSections().find((s) => s.id === selectedSectionId);
    if (sec) {
      sec.name = e.target.value;
      renderSeats();
    }
  }
});

document.getElementById("sec-rows-input")?.addEventListener("change", (e) => {
  const colsInput = document.getElementById("sec-cols-input");
  const newRows = parseInt(e.target.value) || 1;
  const newCols = parseInt(colsInput?.value) || 1;
  updateSelectedSectionDimensions(newRows, newCols);
});

document.getElementById("sec-cols-input")?.addEventListener("change", (e) => {
  const rowsInput = document.getElementById("sec-rows-input");
  const newRows = parseInt(rowsInput?.value) || 1;
  const newCols = parseInt(e.target.value) || 1;
  updateSelectedSectionDimensions(newRows, newCols);
});

document.getElementById("delete-section-toolbar-btn")?.addEventListener("click", () => {
  if (selectedSectionId) {
    setActiveSections(getActiveSections().filter((s) => s.id !== selectedSectionId));
    clearSelection();
    closeSidebar();
    saveState();
    renderSeats();
  }
});

document.getElementById("delete-seat-toolbar-btn")?.addEventListener("click", () => {
  if (selectedSeatIds.length > 0) {
    getActiveSections().forEach((sec) => {
      sec.seats = sec.seats.filter((seat) => !selectedSeatIds.includes(seat.id));
      reorderSectionSeats(sec);
    });
    clearSelection();
    closeSidebar();
    saveState();
    renderSeats();
  }
});

// --- ابزارها و زوم ---
function setTool(tool) {
  currentTool = tool;
  const toolSelect = document.getElementById("tool-select");
  if (toolSelect) toolSelect.value = tool;

  if (currentTool === "hand") {
    stage.draggable(true);
    stage.container().style.cursor = "grab";
  } else {
    stage.draggable(false);
    stage.container().style.cursor = "default";
  }
  renderSeats();
}

document.getElementById("tool-select")?.addEventListener("change", (e) => setTool(e.target.value));

const scaleBy = 1.1;
stage.on("wheel", (e) => {
  e.evt.preventDefault();
  const oldScale = stage.scaleX();
  const pointer = stage.getPointerPosition();
  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale,
  };
  let newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
  if (newScale < 0.2) newScale = 0.2;
  if (newScale > 5) newScale = 5;
  stage.scale({ x: newScale, y: newScale });
  stage.position({
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  });
  stage.batchDraw();
});

// --- کادر انتخاب گروهی صندلی‌ها ---
let isSelecting = false;
let startPos = { x: 0, y: 0 };

stage.on("mousedown", (e) => {
  if (currentTool !== "move" || e.target !== stage) return;
  e.evt.preventDefault();

  const transform = stage.getAbsoluteTransform().copy().invert();
  startPos = transform.point(stage.getPointerPosition());

  selectionRect.setAttrs({
    x: startPos.x,
    y: startPos.y,
    width: 0,
    height: 0,
    visible: true,
  });

  selectionRect.moveToTop();
  isSelecting = true;
  layer.batchDraw();
});

stage.on("mousemove", (e) => {
  if (!isSelecting) return;
  e.evt.preventDefault();

  const transform = stage.getAbsoluteTransform().copy().invert();
  const currentPos = transform.point(stage.getPointerPosition());

  const x = Math.min(startPos.x, currentPos.x);
  const y = Math.min(startPos.y, currentPos.y);
  const width = Math.abs(currentPos.x - startPos.x);
  const height = Math.abs(currentPos.y - startPos.y);

  selectionRect.setAttrs({ x, y, width, height });
  layer.batchDraw();
});

stage.on("mouseup", (e) => {
  if (!isSelecting) return;
  e.evt.preventDefault();

  isSelecting = false;
  selectionRect.visible(false);

  const selBox = selectionRect.getClientRect();
  const selected = [];

  getActiveSections().forEach((sec) => {
    sec.seats.forEach((seat) => {
      const seatNode = stage.findOne(`#${seat.id}`);
      if (seatNode) {
        const seatBox = seatNode.getClientRect();
        if (Konva.Util.haveIntersection(selBox, seatBox)) {
          selected.push(seat.id);
        }
      }
    });
  });

  if (selected.length > 0) {
    selectedSectionId = null;
    selectedSeatIds = selected;
    updateToolbarContext();
    renderSeats();
    openSidebar();
  } else {
    layer.batchDraw();
  }
});

document.getElementById("undo-btn")?.addEventListener("click", undo);
document.getElementById("redo-btn")?.addEventListener("click", redo);

// --- استخراج آی‌دی سالن از URL سیستم لاراول ---
function getSalonIdFromURL() {
  const pathSegments = window.location.pathname.split("/");
  const salonIndex = pathSegments.indexOf("salon");
  if (salonIndex !== -1 && pathSegments[salonIndex + 1]) {
    return pathSegments[salonIndex + 1];
  }
  return null;
}

// --- ارسال جیسون نهایی به ای‌پای‌آی لاراول با متد PUT ---
// async function exportToBackendJSON() {
//   const salonId = getSalonIdFromURL();

//   if (!salonId) {
//     alert("آی‌دی سالن از آدرس مرورگر (URL) دریافت نشد!");
//     return;
//   }

//   const currentFloor = getCurrentFloor();
//   if (currentFloor) {
//     currentFloor.sections = getActiveSections();
//   }

//   const exportedFloors = floors.map((floor) => {
//     return {
//       id: floor.id,
//       name: floor.name,
//       sections: (floor.sections || []).map((sec) => ({
//         id: sec.id,
//         name: sec.name,
//         x: sec.x,
//         y: sec.y,
//         seats: (sec.seats || []).map((seat) => ({
//           id: seat.id,
//           row: seat.row,
//           number: seat.number,
//           x: seat.x,
//           y: seat.y,
//           price: seat.price || 0,
//           type: seat.type || "regular",
//           customText: seat.customText || null,
//         })),
//       })),
//     };
//   });

//   const payload = {
//     salon_id: salonId,
//     floors: exportedFloors,
//   };

//   try {
//     const response = await fetch(`/salon/${salonId}/layout`, {
//       method: "PUT",
//       headers: {
//         "Content-Type": "application/json",
//         "Accept": "application/json",
//         "X-CSRF-TOKEN": document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "",
//       },
//       body: JSON.stringify(payload),
//     });

//     if (response.ok) {
//       alert("چیدمان سالن با موفقیت ذخیره شد!");
//     } else {
//       alert("خطا در ذخیره چیدمان در سرور.");
//     }
//   } catch (error) {
//     console.error("خطا در ارتباط با سرور:", error);
//   }
// }




async function exportToBackendJSON() {
  const salonId = getSalonIdFromURL();

  // ۱. بررسی استخراج آی‌دی
  console.log("آی‌دی سالن استخراج‌شده از URL:", salonId);

  if (!salonId) {
    alert("آی‌دی سالن یافت نشد! لطفاً آدرس مرورگر را بررسی کنید (مثلاً: /salon/10/layout)");
    return;
  }

  const currentFloor = getCurrentFloor();
  if (currentFloor) {
    currentFloor.sections = getActiveSections();
  }

  const exportedFloors = floors.map((floor) => ({
    id: floor.id,
    name: floor.name,
    sections: (floor.sections || []).map((sec) => ({
      id: sec.id,
      name: sec.name,
      x: sec.x,
      y: sec.y,
      seats: (sec.seats || []).map((seat) => ({
        id: seat.id,
        row: seat.row,
        number: seat.number,
        x: seat.x,
        y: seat.y,
        price: seat.price || 0,
        type: seat.type || "regular",
        customText: seat.customText || null,
      })),
    })),
  }));

  const payload = {
    salon_id: salonId,
    floors: exportedFloors,
  };

  // ۲. بررسی دیتای نهایی ارسال‌شده
  console.log("جیسون نهایی ارسال به بک‌اند:", JSON.stringify(payload, null, 2));

  // ارسال واقعی به سرور
  try {
    const response = await fetch(`/salon/${salonId}/layout`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-CSRF-TOKEN": document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      alert("چیدمان سالن با موفقیت ذخیره شد!");
    } else {
      alert("خطا در ذخیره چیدمان در سرور.");
    }
  } catch (error) {
    console.error("خطا در ارتباط با سرور (طبیعی است چون لاراول هنور متصل نیست):", error);
  }
}






document.getElementById("save-btn")?.addEventListener("click", exportToBackendJSON);

// مقداردهی اولیه
renderZoneSelectOptions();
setTool("move");
saveState();
renderSeats();