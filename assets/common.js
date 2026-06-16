/* Shared helpers across pages */
window.STUDENTS = ["David", "Aaron"];
window.RECORDS_KEY = "toefl_records_v1";

function tasks() { return window.TOEFL_TASKS || []; }

function findTask(name) {
  return tasks().find(t => t.name === name);
}

// URL query helpers
function qparam(key) {
  return new URLSearchParams(location.search).get(key);
}

// Normalize a free-text fill answer for comparison
function normFill(s) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[\s]+/g, " ")
    .replace(/[.,;:!?"'`’]+$/g, "")
    .replace(/^[.,;:!?"'`’]+/g, "");
}

// Number of MC options to render for a module (>=4, extend if key uses E/F/G)
function optionCount(items) {
  let max = 4; // A-D
  items.forEach(it => {
    if (it.type === "mc" && it.ans) {
      const idx = it.ans.toLowerCase().charCodeAt(0) - 96; // a=1
      if (idx > max) max = idx;
    }
  });
  return Math.min(max, 7);
}
const LETTERS = ["a", "b", "c", "d", "e", "f", "g"];

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// localStorage record log (browser-local convenience; Excel export is the portable record)
function loadRecords() {
  try { return JSON.parse(localStorage.getItem(RECORDS_KEY) || "[]"); }
  catch (e) { return []; }
}
function saveRecord(rec) {
  const all = loadRecords();
  all.unshift(rec);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(all.slice(0, 500)));
}
function deleteRecord(id) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(loadRecords().filter(r => r.id !== id)));
}

function esc(s) {
  return (s == null ? "" : String(s)).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
