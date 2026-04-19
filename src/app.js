const DATASETS = {
  practice: {
    label: "Vegetable",
    url: "public/data/plu.csv",
    downloadName: "plu.csv",
  },
  fruit: {
    label: "Fruit",
    url: "public/data/fruit.csv",
    downloadName: "fruit.csv",
  },
};

const state = {
  datasets: {},
  items: [],
  current: null,
  correct: 0,
  attempts: 0,
  view: "practice",
};

const elements = {
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  sourceStatus: document.querySelector("#source-status"),
  scoreStatus: document.querySelector("#score-status"),
  descriptionText: document.querySelector("#description-text"),
  chineseText: document.querySelector("#chinese-text"),
  answerForm: document.querySelector("#answer-form"),
  answerInput: document.querySelector("#answer-input"),
  feedback: document.querySelector("#feedback"),
  nextButton: document.querySelector("#next-button"),
  gotItButton: document.querySelector("#got-it-button"),
  dataBody: document.querySelector("#data-table tbody"),
  exportCsvButton: document.querySelector("#export-csv-button"),
  dataSourcePath: document.querySelector("#data-source-path"),
};

init();

async function init() {
  bindEvents();
  await activateDataset("practice");
  renderStatus();
  renderTable();
  nextQuestion();
}

function bindEvents() {
  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });

  elements.answerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    checkAnswer();
  });

  elements.nextButton.addEventListener("click", nextQuestion);
  elements.gotItButton.addEventListener("click", nextQuestion);
  elements.exportCsvButton.addEventListener("click", exportCsv);
}

async function setView(view) {
  if (view === "fruit") {
    await activateDataset("fruit");
    view = "practice";
    nextQuestion();
  } else if (view === "practice") {
    await activateDataset("practice");
    nextQuestion();
  }

  state.view = view;
  elements.tabs.forEach((tab) => {
    let isActive = tab.dataset.view === view;
    if (view === "practice") {
      isActive =
        (state.activeDataset === "practice" && tab.dataset.view === "practice") ||
        (state.activeDataset === "fruit" && tab.dataset.view === "fruit");
    }
    tab.classList.toggle("active", isActive);
  });
  elements.views.forEach((section) => section.classList.toggle("active", section.id === `${view}-view`));
  if (view === "data") renderTable();
}

async function activateDataset(name) {
  if (!state.datasets[name]) {
    state.datasets[name] = await loadDataset(name);
  }
  state.activeDataset = name;
  state.items = state.datasets[name];
  state.correct = 0;
  state.attempts = 0;
  renderStatus();
  renderTable();
}

async function loadDataset(name) {
  const config = DATASETS[name];
  const response = await fetch(`${config.url}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load ${config.url}`);
  }
  const text = await response.text();
  return rowsFromCsv(text);
}

function nextQuestion() {
  if (!state.items.length) {
    state.current = null;
    elements.descriptionText.textContent = "No rows available";
    elements.chineseText.textContent = "Update the CSV file.";
    return;
  }

  state.current = state.items[Math.floor(Math.random() * state.items.length)];
  elements.descriptionText.textContent = state.current.description || "(No description)";
  elements.chineseText.textContent = state.current.chineseDescription || "(No Chinese description)";
  elements.answerInput.value = "";
  elements.feedback.hidden = true;
  elements.feedback.className = "feedback";
  elements.gotItButton.hidden = true;
  elements.nextButton.textContent = "Skip";
  elements.answerInput.disabled = false;
  elements.answerInput.focus();
}

function checkAnswer() {
  if (!state.current) return;
  const answer = elements.answerInput.value;
  if (!answer.trim()) return;

  state.attempts += 1;
  const accepted = acceptedAnswers(state.current.plu);
  const isCorrect = accepted.includes(normalizePlu(answer));

  elements.feedback.hidden = false;
  if (isCorrect) {
    state.correct += 1;
    elements.feedback.className = "feedback correct";
    elements.feedback.textContent = "Correct.";
    renderStatus();
    window.setTimeout(nextQuestion, 450);
    return;
  }

  elements.feedback.className = "feedback";
  elements.feedback.textContent = `Correct PLU: ${state.current.plu}`;
  elements.gotItButton.hidden = false;
  elements.nextButton.textContent = "Skip";
  elements.answerInput.disabled = true;
  renderStatus();
}

function acceptedAnswers(plu) {
  const full = normalizePlu(plu);
  const withoutStar = full.replace(/\*/g, "");
  const primary = withoutStar.split("/")[0];
  return Array.from(new Set([full, withoutStar, primary].filter(Boolean)));
}

function normalizePlu(value) {
  return String(value).trim().toUpperCase().replace(/\s+/g, "");
}

function renderStatus() {
  const config = DATASETS[state.activeDataset] || DATASETS.practice;
  elements.sourceStatus.textContent = `${config.label}: ${state.items.length} rows loaded`;
  elements.scoreStatus.textContent = `${state.correct} correct / ${state.attempts} attempts`;
  if (elements.dataSourcePath) {
    elements.dataSourcePath.textContent = config.url;
  }
}

function renderTable() {
  elements.dataBody.innerHTML = "";
  const fragment = document.createDocumentFragment();
  state.items.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(item.plu)}</td>
      <td>${escapeHtml(item.uom)}</td>
      <td>${escapeHtml(item.description)}</td>
      <td>${escapeHtml(item.chineseDescription)}</td>
      <td>${escapeHtml(item.toledoNumber)}</td>
      <td></td>
    `;
    fragment.append(row);
  });
  elements.dataBody.append(fragment);
}

function exportCsv() {
  const csv = toCsv(state.items);
  const config = DATASETS[state.activeDataset] || DATASETS.practice;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = config.downloadName;
  link.click();
  URL.revokeObjectURL(url);
}

function rowsFromCsv(csvText) {
  const rows = parseCsv(csvText.trim());
  if (rows.length < 2) return [];
  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => ({
      plu: getCell(row, header, ["plu"]),
      uom: getCell(row, header, ["uom"]),
      description: getCell(row, header, ["description"]),
      chineseDescription: getCell(row, header, ["chinese descp", "chinese description", "chinesedescription"]),
      toledoNumber: getCell(row, header, ["toledo number", "toledonumber"]),
    }));
}

function getCell(row, header, names) {
  const index = names.map((name) => header.indexOf(name)).find((found) => found >= 0);
  return index === undefined ? "" : (row[index] || "").trim();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function toCsv(items) {
  const header = ["PLU", "UoM", "Description", "Chinese Descp", "Toledo Number"];
  const rows = items.map((item) => [
    item.plu,
    item.uom,
    item.description,
    item.chineseDescription,
    item.toledoNumber,
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

function csvEscape(value) {
  const text = String(value || "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
