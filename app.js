const STORAGE_KEY = "drinking-log:v0.1";
const UNDO_TIMEOUT_MS = 5000;

const drinks = [
  { id: "beer", label: "ビール", emoji: "🍺" },
  { id: "highball", label: "ハイボール", emoji: "🥃" },
  { id: "sour", label: "サワー", emoji: "🍋" },
  { id: "wine", label: "ワイン", emoji: "🍷" },
  { id: "sake", label: "日本酒", emoji: "🍶" },
  { id: "other", label: "その他", emoji: "🍸" },
  { id: "water", label: "水", emoji: "💧", isAlcohol: false },
];

const elements = {
  totalCount: document.querySelector("#totalCount"),
  startedAt: document.querySelector("#startedAt"),
  elapsedTime: document.querySelector("#elapsedTime"),
  breakdown: document.querySelector("#breakdown"),
  commentText: document.querySelector("#commentText"),
  drinkGrid: document.querySelector("#drinkGrid"),
  historyList: document.querySelector("#historyList"),
  historyCount: document.querySelector("#historyCount"),
  emptyState: document.querySelector("#emptyState"),
  toast: document.querySelector("#toast"),
  toastMessage: document.querySelector("#toastMessage"),
  undoButton: document.querySelector("#undoButton"),
  resetButton: document.querySelector("#resetButton"),
};

let session = loadSession();
let undoTimer = null;
let pendingUndoEntryId = null;

function createEmptySession() {
  return {
    id: crypto.randomUUID(),
    startedAt: null,
    entries: [],
    lastComment: "1杯目を記録したら、ここで軽くツッコミます。",
  };
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptySession();
    const parsed = JSON.parse(raw);
    return {
      ...createEmptySession(),
      ...parsed,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return createEmptySession();
  }
}

function saveSession() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function formatTime(value) {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatElapsed(startedAt) {
  if (!startedAt) return "0分";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  if (hours === 0) return `${minutes}分`;
  return `${hours}時間${minutes}分`;
}

function getDrink(id) {
  return drinks.find((drink) => drink.id === id) ?? drinks[drinks.length - 1];
}

function isAlcoholEntry(entry) {
  return getDrink(entry.drinkType).isAlcohol !== false;
}

function getAlcoholEntries(entries = session.entries) {
  return entries.filter(isAlcoholEntry);
}

function getBreakdown(entries = session.entries) {
  return getAlcoholEntries(entries).reduce((result, entry) => {
    result[entry.drinkType] = (result[entry.drinkType] ?? 0) + 1;
    return result;
  }, {});
}

function renderDrinkButtons() {
  elements.drinkGrid.innerHTML = drinks
    .map(
      (drink) => `
        <button class="drink-button" type="button" data-drink-id="${drink.id}" aria-label="${drink.label}を記録">
          <span class="drink-button__emoji" aria-hidden="true">${drink.emoji}</span>
          <span class="drink-button__label">${drink.label}</span>
        </button>
      `,
    )
    .join("");
}

function render() {
  const alcoholEntries = getAlcoholEntries();
  elements.totalCount.textContent = String(alcoholEntries.length);
  elements.startedAt.textContent = formatTime(session.startedAt);
  elements.elapsedTime.textContent = formatElapsed(session.startedAt);
  elements.commentText.textContent = session.lastComment;
  elements.historyCount.textContent = `${session.entries.length}件`;

  const counts = getBreakdown();
  elements.breakdown.innerHTML = drinks
    .filter((drink) => counts[drink.id])
    .map((drink) => `<span class="breakdown__item">${drink.label} ×${counts[drink.id]}</span>`)
    .join("");

  const recentEntries = [...session.entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  elements.historyList.innerHTML = recentEntries
    .map((entry) => {
      const drink = getDrink(entry.drinkType);
      return `
        <li class="history-item">
          <time datetime="${entry.timestamp}">${formatTime(entry.timestamp)}</time>
          <span>${drink.emoji} ${drink.label}</span>
        </li>
      `;
    })
    .join("");

  elements.emptyState.hidden = session.entries.length > 0;
}

function addDrink(drinkId) {
  const drink = getDrink(drinkId);
  const now = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    drinkType: drinkId,
    timestamp: now,
  };

  if (drink.isAlcohol !== false && !session.startedAt) {
    session.startedAt = now;
  }

  session.entries.push(entry);
  saveSession();
  render();
  showUndo(entry);
  updateComment(entry);
}

function showUndo(entry) {
  const drink = getDrink(entry.drinkType);
  pendingUndoEntryId = entry.id;
  elements.toastMessage.textContent = `${drink.label}を追加しました`;
  elements.toast.hidden = false;

  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => {
    pendingUndoEntryId = null;
    elements.toast.hidden = true;
  }, UNDO_TIMEOUT_MS);
}

function undoLastEntry() {
  if (!pendingUndoEntryId) return;

  const entry = session.entries.find((item) => item.id === pendingUndoEntryId);
  session.entries = session.entries.filter((item) => item.id !== pendingUndoEntryId);

  const alcoholEntries = getAlcoholEntries();
  if (alcoholEntries.length === 0) {
    session.startedAt = null;
    session.lastComment = "1杯目を記録したら、ここで軽くツッコミます。";
  } else if (entry) {
    session.lastComment = `${getDrink(entry.drinkType).label}を取り消しました。記録は戻しておきました。`;
  }

  pendingUndoEntryId = null;
  clearTimeout(undoTimer);
  elements.toast.hidden = true;
  saveSession();
  render();
}

function buildCommentContext(entry) {
  const sortedEntries = getAlcoholEntries().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const currentIndex = sortedEntries.findIndex((item) => item.id === entry.id);
  const previousEntry = currentIndex > 0 ? sortedEntries[currentIndex - 1] : null;
  const elapsedMinutes = session.startedAt
    ? Math.max(0, Math.floor((new Date(entry.timestamp) - new Date(session.startedAt)) / 60000))
    : 0;
  const minutesSincePrevious = previousEntry
    ? Math.max(0, Math.floor((new Date(entry.timestamp) - new Date(previousEntry.timestamp)) / 60000))
    : null;
  const waterCount = session.entries.filter((item) => item.drinkType === "water").length;

  return {
    drink: getDrink(entry.drinkType),
    totalCount: getAlcoholEntries().length,
    elapsedMinutes,
    minutesSincePrevious,
    breakdown: getBreakdown(),
    waterCount,
  };
}

async function updateComment(entry) {
  const context = buildCommentContext(entry);
  const localComment = createLocalComment(context);

  session.lastComment = localComment;
  saveSession();
  render();

  const aiComment = await requestAiComment(context).catch(() => null);
  if (!aiComment) return;

  session.lastComment = aiComment;
  saveSession();
  render();
}

async function requestAiComment() {
  return null;
}

function createLocalComment({ drink, totalCount, elapsedMinutes, minutesSincePrevious, breakdown }) {
  if (drink.isAlcohol === false) {
    if (totalCount === 0) return "水を先に入れるの、かなり堅実。今日は落ち着いていけそう。";
    return `水をはさみました。${totalCount}杯目までの自分に、ちょっといいことした。`;
  }

  if (totalCount === 1) {
    return `1杯目は${drink.label}。今日はゆっくりいこう。`;
  }

  if (totalCount >= 5) {
    return `${totalCount}杯目。ここで水を1杯はさんどくと、明日の自分にやさしいです。`;
  }

  if (minutesSincePrevious !== null && minutesSincePrevious <= 10) {
    return `前の一杯から${minutesSincePrevious}分。ちょっとペース上がってない？`;
  }

  const sameDrinkCount = breakdown[drink.id] ?? 0;
  if (sameDrinkCount >= 3) {
    return `${totalCount}杯目。今日は${drink.label}率高めですね。`;
  }

  if (elapsedMinutes >= 60) {
    return `${totalCount}杯目。開始から${Math.floor(elapsedMinutes / 60)}時間くらい、ペースを一度チェック。`;
  }

  return `${totalCount}杯目。いい感じに記録できてます。水も忘れずに。`;
}

function resetSession() {
  if (session.entries.length === 0) return;
  const ok = window.confirm("今日の記録をリセットしますか？");
  if (!ok) return;

  session = createEmptySession();
  pendingUndoEntryId = null;
  clearTimeout(undoTimer);
  elements.toast.hidden = true;
  saveSession();
  render();
}

elements.drinkGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-drink-id]");
  if (!button) return;
  addDrink(button.dataset.drinkId);
});

elements.undoButton.addEventListener("click", undoLastEntry);
elements.resetButton.addEventListener("click", resetSession);

renderDrinkButtons();
render();
setInterval(render, 30000);
