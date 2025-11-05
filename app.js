// ===== Helpers =====
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const pad2 = (n) => n.toString().padStart(2, "0");
const fmtDate = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseDate = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeekMonday = (d) =>
  addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const isSameDay = (a, b) => fmtDate(a) === fmtDate(b);

// 24 saat / 30 dk aralık
const TIME_SLOTS = Array.from({ length: 24 * 2 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = (i % 2) * 30;
  return `${pad2(h)}:${pad2(m)}`;
});
const DAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const ROUTINES_PER_PAGE = 8;

const GOALS_PER_PAGE = 6;
let goalPage = 1;

let currentChainGoalId = null;
let chainMonthCursor = startOfDay(new Date());

// ===== Storage =====
const STORAGE_KEY = "personal-routine-app-v3";
const seed = () => ({
  categories: ["Günlük", "Haftalık", "Aylık", "Diğer"],
  routines: [
    {
      id: 1,
      date: fmtDate(new Date()),
      time: "09:00",
      text: "Okuma (20dk)",
      repeat: "none",
    },
    {
      id: 2,
      date: fmtDate(new Date()),
      time: "14:00",
      text: "Kodlama",
      repeat: "none",
    },
  ],
  goals: [
    { id: 1, title: "Her gün 20dk kitap", tags: ["Günlük"], done: false, chain: [] },
    { id: 2, title: "Haftada 1 blog yazısı", tags: ["Haftalık"], done: false, chain: [] },
    {
      id: 3,
      title: "Aylık 1 open-source proje",
      tags: ["Aylık"],
      done: false,
      chain: []
    },
  ],
});
let state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || seed();
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

// ===== UI State =====
let selectedDate = new Date();
let monthCursor = startOfDay(new Date());
let routineScope = "day"; // 'day' | 'all'
let routinePage = 1;

// ===== Calendar =====
function renderCalendar() {
  $("#cal-title").textContent = monthCursor
    .toLocaleDateString("tr-TR", { month: "long", year: "numeric" })
    .toUpperCase();

  const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const last = new Date(
    monthCursor.getFullYear(),
    monthCursor.getMonth() + 1,
    0
  );
  const start = startOfWeekMonday(first);
  const end = addDays(startOfWeekMonday(addDays(last, 6)), 6);

  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(new Date(d));

  const grid = $("#cal-grid");
  grid.innerHTML = "";
  for (let i = 0; i < days.length; i += 7) {
    const row = days.slice(i, i + 7);
    const rowEl = document.createElement("div");
    rowEl.className = "grid grid-cols-7 gap-1";
    row.forEach((d) => {
      const inMonth = d.getMonth() === monthCursor.getMonth();
      const isToday = isSameDay(d, new Date());
      const isSelected = isSameDay(d, selectedDate);
      const hasItems = getRoutinesForDate(d).length > 0;

      const btn = document.createElement("button");
      btn.className =
        "cal-cell " +
        (isSelected
          ? "bg-blue-600 text-white border-blue-600"
          : isToday
            ? "bg-blue-50 border-blue-200 text-blue-800"
            : inMonth
              ? "bg-white hover:bg-slate-50 border-slate-200"
              : "bg-slate-50 text-slate-400 border-slate-200");
      btn.title = hasItems ? "Bu günde rutin var" : "";
      btn.innerHTML = `<span class="text-base font-semibold">${d.getDate()}</span>${hasItems ? '<span class="dot"></span>' : ""
        }`;
      btn.addEventListener("click", () => {
        selectedDate = d;
        routinePage = 1;
        renderCalendar();
        renderWeek();
        renderRoutines();
      });
      rowEl.appendChild(btn);
    });
    grid.appendChild(rowEl);
  }
}

// Tekrar kuralına göre bir tarihte görünen rutinler
function getRoutinesForDate(dateObj) {
  const dateKey = fmtDate(dateObj);
  const weekday = (dateObj.getDay() + 6) % 7; // Mon=0
  return state.routines.filter((r) => {
    if (r.repeat === "none") return r.date === dateKey;
    if (r.repeat === "daily") return r.date <= dateKey;
    if (r.repeat === "weekly") {
      const startWd = (parseDate(r.date).getDay() + 6) % 7;
      return r.date <= dateKey && startWd === weekday;
    }
    return false;
  });
}
const repeatLabel = (rep) =>
  rep === "none" ? "" : rep === "daily" ? "Günlük" : "Haftalık";

// ===== Weekly grid =====
function renderWeek() {
  const weekStart = startOfWeekMonday(selectedDate);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  $("#week-range").textContent =
    `${weekStart.toLocaleDateString("tr-TR")} – ` +
    `${addDays(weekStart, 6).toLocaleDateString("tr-TR")}`;

  // head
  const head = $("#week-head");
  head.innerHTML =
    '<th class="sticky left-0 z-10 bg-white border-b p-2 text-left text-xs uppercase tracking-wide text-slate-500">Saat</th>';
  weekDates.forEach((d, idx) => {
    const th = document.createElement("th");
    th.className =
      "border-b p-2 text-xs uppercase tracking-wide text-slate-500 text-center";
    th.innerHTML = `${DAY_NAMES[idx]}<div class="text-[11px] text-slate-400">${d.getDate()}.${d.getMonth() + 1
      }</div>`;
    head.appendChild(th);
  });

  const body = $("#week-body");
  body.innerHTML = "";

  TIME_SLOTS.forEach((slot) => {
    const hasAny = weekDates.some((d) =>
      getRoutinesForDate(d).some((r) => r.time === slot)
    );
    if (!hasAny) return;

    const tr = document.createElement("tr");

    const th = document.createElement("td");
    th.className =
      "sticky left-0 z-10 bg-white border-t p-2 text-sm font-medium";
    th.textContent = slot;
    tr.appendChild(th);

    weekDates.forEach((d) => {
      const items = getRoutinesForDate(d).filter((r) => r.time === slot);
      const isSel = isSameDay(d, selectedDate);
      const td = document.createElement("td");
      td.className = `align-top border-t p-2 min-w-[120px] ${isSel ? "bg-blue-50" : "bg-white"
        }`;

      if (items.length) {
        const wrap = document.createElement("div");
        wrap.className = "space-y-1";
        items.forEach((r) => {
          const div = document.createElement("div");
          div.className = "rounded-lg border px-2 py-1 text-xs sm:text-sm shadow-sm";
          div.textContent = r.text;
          wrap.appendChild(div);
        });
        td.appendChild(wrap);
      } else {
        td.innerHTML = "";
      }

      tr.appendChild(td);
    });

    body.appendChild(tr);
  });
}

// ===== Rutin listesi (sağ panel) =====
function renderRoutines() {
  const info = $("#routine-info");
  info.textContent =
    "Seçili gün: " +
    selectedDate.toLocaleDateString("tr-TR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  routineScope = $("#routine-scope").value || "day";
  const listEl = $("#routine-list");
  const emptyEl = $("#routine-empty");
  const pageLabel = $("#routine-page-label");

let list;
  if (routineScope === "day") {
    // Tekrar (daily/weekly) mantığını da kullanarak sadece seçili güne düşenleri getir
    list = getRoutinesForDate(selectedDate);
  } else {
    list = [...state.routines]; // Tümü modunda ham liste
  }

  list.sort((a, b) => {
    if (a.date === b.date) return a.time.localeCompare(b.time);
    return a.date.localeCompare(b.date);
  });

  const totalPages = Math.max(1, Math.ceil(list.length / ROUTINES_PER_PAGE));
  if (routinePage > totalPages) routinePage = totalPages;
  const startIdx = (routinePage - 1) * ROUTINES_PER_PAGE;
  const pageItems = list.slice(startIdx, startIdx + ROUTINES_PER_PAGE);

  listEl.innerHTML = "";
  if (!pageItems.length) {
    emptyEl.classList.remove("hidden");
  } else {
    emptyEl.classList.add("hidden");
    pageItems.forEach((r) => {
      const li = document.createElement("li");
      li.className = "flex items-start gap-3 rounded-xl border p-3 text-sm";
      li.innerHTML = `
        <div class="flex flex-col text-xs text-slate-500 min-w-[80px]">
          <span>${r.date}</span>
          <span class="font-semibold text-slate-700">${r.time}</span>
        </div>
        <div class="flex-1">
          <div class="font-medium">${r.text}</div>
          <div class="mt-1 text-[11px] text-slate-400">${repeatLabel(
        r.repeat
      )}</div>
        </div>
        <button class="btn text-xs">Düzenle</button>
      `;
      $("button", li).addEventListener("click", () => openRoutineModal(r));
      listEl.appendChild(li);
    });
  }

  pageLabel.textContent = `Sayfa ${list.length ? routinePage : 0} / ${list.length ? totalPages : 0
    }`;

  // prev/next aktifliği
  const prev = $("#routine-prev");
  const next = $("#routine-next");
  prev.disabled = routinePage <= 1;
  next.disabled = routinePage >= totalPages;
  prev.classList.toggle("opacity-50", prev.disabled);
  prev.classList.toggle("pointer-events-none", prev.disabled);
  next.classList.toggle("opacity-50", next.disabled);
  next.classList.toggle("pointer-events-none", next.disabled);
}

// ===== Hedefler & kategoriler =====
function renderCategoryFilter() {
  const sel = $("#goal-filter");
  sel.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.textContent = "Hepsi";
  sel.appendChild(allOpt);
  state.categories.forEach((c) => {
    const o = document.createElement("option");
    o.textContent = c;
    sel.appendChild(o);
  });
}

function renderGoalModalCategories() {
  const sel = $("#g-tags");
  sel.innerHTML = "";
  state.categories.forEach((c) => {
    const o = document.createElement("option");
    o.textContent = c;
    sel.appendChild(o);
  });
}

function closeAllGoalMenus() {
  $$(".goal-menu").forEach((m) => m.classList.add("hidden"));
}

function closeAllGoalMenus() {
  $$(".goal-menu").forEach((m) => m.classList.add("hidden"));
}

function renderGoals() {
  const filter = $("#goal-filter").value || "Hepsi";
  const ul = $("#goal-list");
  ul.innerHTML = "";

  // filtre + sıralama
  let filtered = state.goals
    .filter((g) => filter === "Hepsi" || (g.tags || []).includes(filter))
    .sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));

  const totalPages = Math.max(1, Math.ceil(filtered.length / GOALS_PER_PAGE));
  if (goalPage > totalPages) goalPage = totalPages;

  const startIdx = (goalPage - 1) * GOALS_PER_PAGE;
  const pageItems = filtered.slice(startIdx, startIdx + GOALS_PER_PAGE);

  pageItems.forEach((g) => {
    if (!Array.isArray(g.chain)) g.chain = [];

    const li = document.createElement("li");
    li.className =
      "flex items-start gap-3 rounded-xl border p-3 text-sm goal-menu-wrapper";

    li.innerHTML = `
      <div class="flex-1">
        <div class="font-medium ${g.done ? "line-through text-slate-400" : ""}">
          ${g.title}
        </div>
        <div class="mt-1 flex flex-wrap gap-1"></div>
      </div>
      <div class="relative goal-menu-wrapper">
        <button type="button" class="btn btn-icon goal-menu-btn">⋯</button>
        <div class="goal-menu hidden absolute right-0 mt-2 w-40 rounded-xl border bg-white shadow-lg text-sm">
          <button data-action="toggle" class="w-full text-left px-3 py-2 hover:bg-slate-50">
            ${g.done ? "Tamamlanmadı" : "Tamamlandı"}
          </button>
          <button data-action="chain" class="w-full text-left px-3 py-2 hover:bg-slate-50">
            Zincire Bak
          </button>
          <button data-action="delete" class="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50">
            Sil
          </button>
        </div>
      </div>
    `;

    // etiket chip'leri
    const chips = $("div.mt-1", li);
    (g.tags || []).forEach((t) => {
      const s = document.createElement("span");
      s.className =
        "text-xs px-2 py-0.5 rounded-full border bg-slate-50 text-slate-600";
      s.textContent = t;
      chips.appendChild(s);
    });
    if (g.deadline) {
      const s = document.createElement("span");
      s.className =
        "text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700";
      s.textContent =
        "Son: " + new Date(g.deadline).toLocaleDateString("tr-TR");
      chips.appendChild(s);
    }

    // menü açma / tıklama
    const menuBtn = $(".goal-menu-btn", li);
    const menu = $(".goal-menu", li);

    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = menu.classList.contains("hidden");
      closeAllGoalMenus();
      if (isHidden) menu.classList.remove("hidden");
    });

    $$("button", menu).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === "toggle") {
          g.done = !g.done;
          // Tamamlandı ise bugün zincire ekle
          if (g.done) {
            const todayStr = fmtDate(new Date());
            if (!g.chain.includes(todayStr)) g.chain.push(todayStr);
          }
        } else if (action === "delete") {
          if (!confirm("Bu hedef silinsin mi?")) return;
          state.goals = state.goals.filter((x) => x.id !== g.id);
        } else if (action === "chain") {
          openChainModal(g);
          return; // zincir modalı açıldı, renderGoals sonra
        }
        save();
        closeAllGoalMenus();
        renderGoals();
      });
    });

    ul.appendChild(li);
  });

  // Pagination label + buton durumu
  const label = $("#goal-page-label");
  const prev = $("#goal-prev");
  const next = $("#goal-next");

  if (!filtered.length) {
    label.textContent = "Sayfa 0 / 0";
    prev.disabled = next.disabled = true;
    prev.classList.add("opacity-50", "pointer-events-none");
    next.classList.add("opacity-50", "pointer-events-none");
  } else {
    label.textContent = `Sayfa ${goalPage} / ${totalPages}`;

    prev.disabled = goalPage <= 1;
    next.disabled = goalPage >= totalPages;

    prev.classList.toggle("opacity-50", prev.disabled);
    prev.classList.toggle("pointer-events-none", prev.disabled);
    next.classList.toggle("opacity-50", next.disabled);
    next.classList.toggle("pointer-events-none", next.disabled);
  }
}

function openChainModal(goal) {
  currentChainGoalId = goal.id;
  if (!Array.isArray(goal.chain)) goal.chain = [];
  chainMonthCursor = startOfDay(new Date());

  $("#chain-title").textContent = "Zincir: " + goal.title;
  renderChainCalendar();
  $("#modal-chain").showModal();
}

function renderChainCalendar() {
  const goal = state.goals.find((g) => g.id === currentChainGoalId);
  if (!goal) return;
  if (!Array.isArray(goal.chain)) goal.chain = [];

  const monthLabel = $("#chain-month-label");
  const grid = $("#chain-grid");
  monthLabel.textContent = chainMonthCursor.toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  }).toUpperCase();

  grid.innerHTML = "";

  const first = new Date(
    chainMonthCursor.getFullYear(),
    chainMonthCursor.getMonth(),
    1
  );
  const last = new Date(
    chainMonthCursor.getFullYear(),
    chainMonthCursor.getMonth() + 1,
    0
  );
  const start = startOfWeekMonday(first);
  const end = addDays(startOfWeekMonday(addDays(last, 6)), 6);

  const chainSet = new Set(goal.chain);

  for (let d = start; d <= end; d = addDays(d, 1)) {
    const dateStr = fmtDate(d);
    const inMonth = d.getMonth() === chainMonthCursor.getMonth();
    const isToday = isSameDay(d, new Date());
    const isMarked = chainSet.has(dateStr);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = d.getDate();
    let cls =
      "w-8 h-8 sm:w-9 sm:h-9 rounded-lg border text-xs flex items-center justify-center transition ";

    if (!inMonth) cls += "opacity-30 ";
    if (isMarked) cls += "bg-blue-600 text-white border-blue-600 ";
    else cls += "bg-white ";

    if (isToday) cls += "ring-2 ring-blue-400 ";

    btn.className = cls.trim();

    btn.addEventListener("click", () => {
      const goalRef = state.goals.find((g) => g.id === currentChainGoalId);
      if (!goalRef) return;
      goalRef.chain = goalRef.chain || [];
      const idx = goalRef.chain.indexOf(dateStr);
      if (idx === -1) goalRef.chain.push(dateStr);
      else goalRef.chain.splice(idx, 1);
      save();
      renderChainCalendar();
    });

    grid.appendChild(btn);
  }
}

$("#chain-prev").addEventListener("click", () => {
  chainMonthCursor = new Date(
    chainMonthCursor.getFullYear(),
    chainMonthCursor.getMonth() - 1,
    1
  );
  renderChainCalendar();
});

$("#chain-next").addEventListener("click", () => {
  chainMonthCursor = new Date(
    chainMonthCursor.getFullYear(),
    chainMonthCursor.getMonth() + 1,
    1
  );
  renderChainCalendar();
});



document.addEventListener("click", (e) => {
  if (!e.target.closest(".goal-menu-wrapper")) {
    closeAllGoalMenus();
  }
});

// ===== Category modal =====
function renderCategoryModal() {
  const ul = $("#cat-list");
  ul.innerHTML = "";
  state.categories.forEach((name, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
        <span class="text-sm">${name}</span>
        <div class="flex gap-2">
          <button data-action="rename" class="btn text-xs">Düzenle</button>
          <button data-action="delete" class="btn danger text-xs">Sil</button>
        </div>
      </div>
    `;
    $$("button", li).forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "rename") {
          const next = prompt("Yeni kategori adı:", name);
          if (!next || !next.trim()) return;
          state.categories[idx] = next.trim();
        } else if (action === "delete") {
          if (!confirm(`"${name}" kategorisini silmek istiyor musun?`)) return;
          state.categories.splice(idx, 1);
        }
        save();
        renderCategoryFilter();
        renderGoalModalCategories();
        renderCategoryModal();
        renderGoals();
      });
    });
    ul.appendChild(li);
  });
}

// ===== Modals: Rutin =====
const modalRoutine = $("#modal-routine");
const mDate = $("#m-date");
const mTime = $("#m-time");
const mText = $("#m-text");
const mRepeat = $("#m-repeat");
const mReminder = $("#m-reminder");
const mSave = $("#m-save");
const mDelete = $("#m-delete");

TIME_SLOTS.forEach((t) => {
  const opt = document.createElement("option");
  opt.textContent = t;
  mTime.appendChild(opt);
});

let editingRoutine = null;

function openRoutineModal(r) {
  editingRoutine = r?.id
    ? r
    : {
      id: null,
      date: fmtDate(selectedDate),
      time: "09:00",
      text: "",
      repeat: "none",
    };
  mDate.value = editingRoutine.date;
  mTime.value = editingRoutine.time;
  mText.value = editingRoutine.text || "";
  mRepeat.value = editingRoutine.repeat || "none";
  mReminder.value = editingRoutine.reminder || "";
  mDelete.classList.toggle("hidden", !editingRoutine.id);
  modalRoutine.showModal();
}

mSave.addEventListener("click", () => {
  const payload = {
    id: editingRoutine.id || Date.now(),
    date: mDate.value,
    time: mTime.value,
    text: mText.value.trim(),
    repeat: mRepeat.value,
    reminder: mReminder.value || undefined,
  };
  if (!payload.text) return alert("Açıklama boş olamaz.");

  const idx = state.routines.findIndex((r) => r.id === editingRoutine.id);
  if (idx >= 0) state.routines[idx] = payload;
  else state.routines.push(payload);

  save();
  modalRoutine.close();
  selectedDate = parseDate(payload.date);
  routinePage = 1;
  renderCalendar();
  renderWeek();
  renderRoutines();
});

mDelete.addEventListener("click", () => {
  if (!editingRoutine?.id) return;
  state.routines = state.routines.filter((r) => r.id !== editingRoutine.id);
  save();
  modalRoutine.close();
  renderCalendar();
  renderWeek();
  renderRoutines();
});

// ===== Goal modal =====
const modalGoal = $("#modal-goal");
$("#g-save").addEventListener("click", () => {
  const title = $("#g-title").value.trim();
  if (!title) return alert("Başlık boş olamaz.");
  const tags = Array.from($("#g-tags").selectedOptions).map((o) => o.value);
  const deadline = $("#g-deadline").value || undefined;

  state.goals.push({ id: Date.now(), title, tags, deadline, done: false });
  save();
  modalGoal.close();
  $("#g-title").value = "";
  $("#g-deadline").value = "";
  $("#g-tags").selectedIndex = -1;
  renderGoals();
});

// ===== Settings & categories modals =====
const modalSettings = $("#modal-settings");
const modalCategories = $("#modal-categories");

$("#btn-settings").addEventListener("click", () => {
  modalSettings.showModal();
});
$("#settings-close").addEventListener("click", () => modalSettings.close());

$("#btn-open-categories").addEventListener("click", () => {
  modalCategories.showModal();
  renderCategoryModal();
});
$("#cat-close").addEventListener("click", () => modalCategories.close());

$("#cat-add").addEventListener("click", () => {
  const input = $("#cat-new-input");
  const name = input.value.trim();
  if (!name) return;
  if (!state.categories.includes(name)) {
    state.categories.push(name);
    save();
    renderCategoryFilter();
    renderGoalModalCategories();
    renderCategoryModal();
    renderGoals();
  }
  input.value = "";
});

// ===== Import / Export (settings içinden) =====
const todayChip = $("#today-chip");
todayChip.textContent = new Date().toLocaleDateString("tr-TR", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

$("#btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `rutinler-${fmtDate(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$("#btn-import").addEventListener("click", () => $("#file-import").click());
$("#file-import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const obj = JSON.parse(text);
    if (!obj.routines || !obj.goals) throw new Error("Geçersiz dosya yapısı.");
    // categories yoksa seed et
    if (!obj.categories) obj.categories = seed().categories;
    state = obj;
    save();
    renderAll();
  } catch (err) {
    alert("İçe aktarma hatası: " + err.message);
  } finally {
    e.target.value = "";
  }
});

// ===== Keyboard Shortcuts =====
// ← → gün; PgUp/PgDn ay; T: bugün; N: yeni rutin; G: yeni hedef
document.addEventListener("keydown", (e) => {
  if (e.target && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))
    return;

  if (e.key === "ArrowLeft") {
    selectedDate = addDays(selectedDate, -1);
    routinePage = 1;
    renderAll();
  } else if (e.key === "ArrowRight") {
    selectedDate = addDays(selectedDate, 1);
    routinePage = 1;
    renderAll();
  } else if (e.key === "PageUp") {
    monthCursor = new Date(
      monthCursor.getFullYear(),
      monthCursor.getMonth() - 1,
      1
    );
    renderCalendar();
  } else if (e.key === "PageDown") {
    monthCursor = new Date(
      monthCursor.getFullYear(),
      monthCursor.getMonth() + 1,
      1
    );
    renderCalendar();
  } else if (e.key.toLowerCase() === "t") {
    selectedDate = new Date();
    monthCursor = startOfDay(new Date());
    routinePage = 1;
    renderAll();
  } else if (e.key.toLowerCase() === "n") {
    openRoutineModal({
      id: null,
      date: fmtDate(selectedDate),
      time: "09:00",
      text: "",
      repeat: "none",
    });
  } else if (e.key.toLowerCase() === "g") {
    modalGoal.showModal();
  }
});

// Rutin listesi kontrolleri
$("#routine-scope").addEventListener("change", () => {
  routinePage = 1;
  renderRoutines();
});
$("#routine-prev").addEventListener("click", () => {
  if (routinePage > 1) {
    routinePage--;
    renderRoutines();
  }
});
$("#routine-next").addEventListener("click", () => {
  routinePage++;
  renderRoutines();
});
$("#btn-add-routine").addEventListener("click", () =>
  openRoutineModal({
    id: null,
    date: fmtDate(selectedDate),
    time: "09:00",
    text: "",
    repeat: "none",
  })
);
$("#btn-add-goal").addEventListener("click", () => modalGoal.showModal());

// ===== Reminder: ding dong + alert =====
function playAlarm() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    function tone(freq, start, duration) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0.3, now + start);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + start + duration
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration);
    }

    // ding-dong: iki kısa ton
    tone(880, 0, 0.4);
    tone(660, 0.45, 0.4);
  } catch (e) {
    // sessiz geç
  }
}

setInterval(() => {
  const now = new Date();
  state.routines.forEach((r) => {
    if (!r.reminder || r._notified) return;
    const rt = new Date(r.reminder);
    if (now >= rt) {
      r._notified = true;
      save();
      playAlarm();
      alert(`Hatırlatma: ${r.text} (${r.time})`);
    }
  });
}, 30 * 1000);


// ==== İpucu / Motivasyon Mesajları ====
const tipMessages = [
  // İlk mesaj (senin mevcut metnin)
  "Rutinlerini küçük parçalara böl, haftalık tabloya serpiştir. Küçük kazanımlar büyük ivme yaratır.",

  // Sonrakiler motivasyon mesajları
  "Bugün küçük bir adım at, yarın alışkanlığa dönüşsün.",
  "Başlamadığın hiçbir rutini mükemmelleştiremezsin. Önce başla, sonra iyileştir.",
  "Zor geldiği günlerde bile devam etmek, seni çoğu insandan daha ileri taşır.",
  "Plan değil, her gün attığın küçük uygulama adımları hayatını değiştirir.",
  "1 saatlik odaklı çalışma, bütün günü telefonda harcamaktan daha değerlidir.",
  "Yapamadıkların için kendini suçlama; yapabildiklerin için kendini ödüllendir.",
  "Sürekli disiplin bekleme, bazen sadece 10 dakikalık minik bir çaba bile yeter.",
  "Rutinlerin, isteğin olmadığı zamanlarda bile seni ileri taşıyan raylardır.",
  "Bugün kendin için yaptığın her iş, gelecekteki halinden sana bir teşekkür mektubudur.",
  "Mükemmel olmasına gerek yok; tutarlı olman, mükemmel olmaktan daha güçlüdür."
];

let tipIndex = 0;
let tipTimer = null;

function initTipCard() {
  const tipCard = document.getElementById("tip-card");
  const tipEl = document.getElementById("tip-message");
  if (!tipCard || !tipEl) return;

  // Başlangıç mesajı
  tipEl.textContent = tipMessages[tipIndex];

  const showNextTip = () => {
    tipIndex = (tipIndex + 1) % tipMessages.length;
    tipEl.textContent = tipMessages[tipIndex];
  };

  // 5 dakikada bir değiştir
  if (tipTimer) clearInterval(tipTimer);
  tipTimer = setInterval(showNextTip, 5 * 60 * 1000);

  // Kart tıklanınca anında değiştir + timer’ı resetle
  tipCard.addEventListener("click", () => {
    showNextTip();
    clearInterval(tipTimer);
    tipTimer = setInterval(showNextTip, 5 * 60 * 1000);
  });
}



// ===== Initial render =====
function renderAll() {
  renderCategoryFilter();
  renderGoalModalCategories();
  renderCalendar();
  renderWeek();
  renderRoutines();
  renderGoals();
}
renderAll();
initTipCard();