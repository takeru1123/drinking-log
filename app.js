const STORAGE_KEY = "drinking-log:v0.1";
const PAST_LOGS_KEY = "drinking-log:past-logs:v0.1";
const CONFIG_KEY = "drinking-log:config";
const UNDO_TIMEOUT_MS = 5000;
const AI_TIMEOUT_MS = 4500;

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
  paceTime: document.querySelector("#paceTime"),
  waterCount: document.querySelector("#waterCount"),
  breakdown: document.querySelector("#breakdown"),
  commentText: document.querySelector("#commentText"),
  drinkGrid: document.querySelector("#drinkGrid"),
  historyList: document.querySelector("#historyList"),
  historyCount: document.querySelector("#historyCount"),
  emptyState: document.querySelector("#emptyState"),
  pastLogList: document.querySelector("#pastLogList"),
  pastLogCount: document.querySelector("#pastLogCount"),
  pastEmptyState: document.querySelector("#pastEmptyState"),
  toast: document.querySelector("#toast"),
  toastMessage: document.querySelector("#toastMessage"),
  undoButton: document.querySelector("#undoButton"),
  finishButton: document.querySelector("#finishButton"),
};

let session = loadSession();
let pastLogs = loadPastLogs();
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

function loadPastLogs() {
  try {
    const raw = localStorage.getItem(PAST_LOGS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSession() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function savePastLogs() {
  localStorage.setItem(PAST_LOGS_KEY, JSON.stringify(pastLogs));
}

function getAiCommentEndpoint() {
  const params = new URLSearchParams(window.location.search);
  const endpointFromUrl = params.get("aiEndpoint");

  if (endpointFromUrl) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ aiCommentEndpoint: endpointFromUrl }));
    return endpointFromUrl;
  }

  try {
    const config = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
    return config.aiCommentEndpoint || "";
  } catch {
    return "";
  }
}

function formatTime(value) {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatElapsed(startedAt) {
  if (!startedAt) return "0分";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
  return formatMinutes(elapsedMinutes);
}

function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
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

function getWaterCount(entries = session.entries) {
  return entries.filter((entry) => entry.drinkType === "water").length;
}

function formatPace(alcoholEntries = getAlcoholEntries()) {
  if (alcoholEntries.length === 0) return "--";
  const latestEntry = alcoholEntries.reduce((latest, entry) =>
    new Date(entry.timestamp) > new Date(latest.timestamp) ? entry : latest,
  );
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(latestEntry.timestamp).getTime()) / 60000));
  return formatMinutes(elapsedMinutes);
}

function getBreakdown(entries = session.entries) {
  return getAlcoholEntries(entries).reduce((result, entry) => {
    result[entry.drinkType] = (result[entry.drinkType] ?? 0) + 1;
    return result;
  }, {});
}

function createBreakdownText(breakdown) {
  const parts = drinks
    .filter((drink) => breakdown[drink.id])
    .map((drink) => `${drink.label} ×${breakdown[drink.id]}`);
  return parts.length ? parts.join("  ") : "お酒なし";
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
  elements.paceTime.textContent = formatPace(alcoholEntries);
  elements.waterCount.textContent = `${getWaterCount()}回`;
  elements.commentText.textContent = session.lastComment;
  elements.historyCount.textContent = `${session.entries.length}件`;
  renderPastLogs();

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

function renderPastLogs() {
  elements.pastLogCount.textContent = `${pastLogs.length}件`;
  elements.pastEmptyState.hidden = pastLogs.length > 0;
  elements.pastLogList.innerHTML = pastLogs
    .slice(0, 10)
    .map(
      (log) => `
        <li class="past-log-item">
          <div class="past-log-item__top">
            <span class="past-log-item__date">${formatDate(log.startedAt || log.endedAt)}</span>
            <span class="past-log-item__total">${log.totalCount}杯</span>
          </div>
          <div class="past-log-item__meta">
            <span>${formatMinutes(log.durationMinutes || 0)}</span>
            <span>水 ${log.waterCount || 0}回</span>
          </div>
          <div class="past-log-item__breakdown">${createBreakdownText(log.breakdown || {})}</div>
        </li>
      `,
    )
    .join("");
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
  const waterCount = getWaterCount();

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

async function requestAiComment(context) {
  const endpoint = getAiCommentEndpoint();
  if (!endpoint) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addedDrink: context.drink.label,
        isAlcohol: context.drink.isAlcohol !== false,
        totalCount: context.totalCount,
        elapsedMinutes: context.elapsedMinutes,
        minutesSincePrevious: context.minutesSincePrevious,
        breakdown: Object.fromEntries(
          Object.entries(context.breakdown).map(([drinkId, count]) => [getDrink(drinkId).label, count]),
        ),
        waterCount: context.waterCount,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = await response.json();
    const comment = typeof data.comment === "string" ? data.comment.trim() : "";
    if (!comment || comment.length > 80) return null;
    return comment;
  } finally {
    clearTimeout(timeoutId);
  }
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

function createPastLogFromCurrentSession() {
  const alcoholEntries = getAlcoholEntries();
  const endedAt = new Date().toISOString();
  const firstEntryAt = session.startedAt || session.entries[0]?.timestamp || endedAt;
  const durationMinutes = Math.max(0, Math.floor((new Date(endedAt) - new Date(firstEntryAt)) / 60000));

  return {
    id: crypto.randomUUID(),
    startedAt: session.startedAt,
    endedAt,
    durationMinutes,
    totalCount: alcoholEntries.length,
    waterCount: getWaterCount(),
    breakdown: getBreakdown(),
    entries: [...session.entries],
  };
}

function finishSession() {
  if (session.entries.length === 0) return;
  const ok = window.confirm("今日の飲み会を終了して、過去ログに保存しますか？");
  if (!ok) return;

  pastLogs = [createPastLogFromCurrentSession(), ...pastLogs].slice(0, 30);
  session = createEmptySession();
  pendingUndoEntryId = null;
  clearTimeout(undoTimer);
  elements.toast.hidden = true;
  savePastLogs();
  saveSession();
  render();
}

elements.drinkGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-drink-id]");
  if (!button) return;
  addDrink(button.dataset.drinkId);
});

elements.undoButton.addEventListener("click", undoLastEntry);
elements.finishButton.addEventListener("click", finishSession);

renderDrinkButtons();
render();
setInterval(render, 30000);
