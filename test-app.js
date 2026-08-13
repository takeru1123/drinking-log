const fs = require("fs");
const { webcrypto } = require("crypto");

const store = new Map();
const elements = new Map();

function createElement() {
  return {
    textContent: "",
    innerHTML: "",
    hidden: false,
    dataset: {},
    addEventListener(type, callback) {
      this[type] = callback;
    },
  };
}

global.crypto = webcrypto;
global.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, value),
};
global.window = {
  confirm: () => true,
  location: { search: "" },
};
global.setInterval = () => 0;
global.clearTimeout = () => {};
global.setTimeout = () => 0;
global.document = {
  querySelector(selector) {
    if (!elements.has(selector)) {
      elements.set(selector, createElement());
    }
    return elements.get(selector);
  },
};

const appSource = fs.readFileSync("app.js", "utf8");

eval(`${appSource}
addDrink("beer");
if (session.entries.length !== 1) throw new Error("drink was not added");
if (!localStorage.getItem(STORAGE_KEY)) throw new Error("session was not saved");
if (elements.totalCount.textContent !== "1") throw new Error("total count did not render");
if (elements.paceTime.textContent !== "0分") throw new Error("pace did not render");

undoLastEntry();
if (session.entries.length !== 0) throw new Error("undo did not remove the entry");
if (elements.totalCount.textContent !== "0") throw new Error("undo did not rerender total");

addDrink("water");
if (session.entries.length !== 1) throw new Error("water was not added");
if (elements.totalCount.textContent !== "0") throw new Error("water counted as alcohol");
if (session.startedAt !== null) throw new Error("water started the session");
if (elements.waterCount.textContent !== "1回") throw new Error("water count did not render");
if (!elements.historyList.innerHTML.includes("水")) throw new Error("water did not render in history");

addDrink("highball");
addDrink("highball");
if (!elements.breakdown.innerHTML.includes("ハイボール ×2")) {
  throw new Error("breakdown did not render highball count");
}
if (!elements.historyList.innerHTML.includes("ハイボール")) {
  throw new Error("history did not render entries");
}
`);

console.log("app flow ok");
