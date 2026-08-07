import "./style.css";

const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

// -----------------------------------------------------------------------------
// App state #test
// -----------------------------------------------------------------------------
const APP_VERSION = "1.1.0";
const DEFAULT_SETTINGS = {
  selectedCategories: new Set(),
  avoidDuplicates: false,
  alcoholFreeOnly: false,
  glutenFreeOnly: false,
};

const state = {
  settings: DEFAULT_SETTINGS,
  history: loadHistory(),

  beers: [],
  categories: [],
};

let messageTimeout = null;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
/**
 * Parse CSV text into an array of objects keyed by the first row headers.
 *
 * Supports LF and CRLF line endings and uses `";"` by default.
 *
 * @param {string} csvText - Raw CSV string content.
 * @param {string} [separator=";"] - Column separator.
 * @returns {Array<Record<string, string>>} Parsed rows as objects.
 */
function parseCsvContent(csvText, separator = ";") {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const parseLine = (line) => {
    const values = [];
    let currentValue = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];

      if (char === '"') {
        if (inQuotes && line[index + 1] === '"') {
          currentValue += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === separator && !inQuotes) {
        values.push(currentValue);
        currentValue = "";
      } else {
        currentValue += char;
      }
    }

    values.push(currentValue);
    return values;
  };

  const headers = parseLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseLine(line);

    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
  });
}

function isNumber(str) {
  if (typeof str !== "string" || str.trim() === "") return false;

  // Replace comma with dot
  const normalized = str.replace(",", ".");

  return !isNaN(Number(normalized));
}

// -----------------------------------------------------------------------------
// Message handling
// -----------------------------------------------------------------------------
/**
 * Display a message banner and automatically hide it after a short delay.
 *
 * @param {string} message - The message text to display.
 * @param {"info"|"warning"|"error"} [type="info"] - The message style.
 * @returns {void}
 */
function showMessage(message, type = "info") {
  hideMessage();
  $("#message-content").textContent = message;
  $(".message-wrapper").classList.add(type);
  $(".message-wrapper").classList.remove("hidden");

  clearTimeout(messageTimeout);
  messageTimeout = setTimeout(hideMessage, 5000);
}

/**
 * Hide the currently visible message banner.
 *
 * @returns {void}
 */
function hideMessage() {
  $(".message-wrapper").classList.remove("info", "warning", "error");
  $(".message-wrapper").classList.add("hidden");
}

// -----------------------------------------------------------------------------
// Data management
// -----------------------------------------------------------------------------
/**
 * Load the beer data from both CSV files and initialize the app state.
 *
 * @returns {Promise<void>}
 */
async function loadBeers() {
  try {
    const [dauerhaftResponse, saisonalResponse] = await Promise.all([
      fetch("/Bierkarte_dauerhaft.csv"),
      fetch("/Bierkarte_saisonal.csv"),
    ]);

    if (!dauerhaftResponse.ok || !saisonalResponse.ok) {
      throw new Error(
        "Fehler beim Laden der Bierkarte. Bitte versuche es später erneut.",
      );
    }

    const [dauerhaftCsv, saisonalCsv] = await Promise.all([
      dauerhaftResponse.text(),
      saisonalResponse.text(),
    ]);

    let beers = [
      ...parseCsvContent(dauerhaftCsv),
      ...parseCsvContent(saisonalCsv),
    ];

    if (beers.length === 0) {
      throw new Error(
        "Die Bierkarte ist leer. Bitte überprüfe die CSV-Dateien.",
      );
    }
    return beers;
  } catch (error) {
    showMessage(error.message, "error");
    return null;
  }
}
/**
 * Extract all unique beer categories from the loaded dataset.
 *
 * @returns {string[]} Sorted list of category names.
 */
function getCategories() {
  const categoryValues = state.beers
    .map((beer) => beer.category?.trim())
    .filter(Boolean);

  return [...new Set(categoryValues)].sort((a, b) =>
    a.localeCompare(b, "de", { sensitivity: "base" }),
  );
}

/**
 * Choose a random beer from the currently active filters.
 *
 * @returns {Record<string, string>|null} The selected beer, or null if none can be chosen.
 */
function selectRandomBeer() {
  if (state.beers.length === 0) {
    showMessage("Keine Biere verfügbar.", "warning");
    return null;
  }

  if (state.settings.selectedCategories.size === 0) {
    showMessage("Kein Filter aktiv!", "warning");
    return null;
  }

  const historyIds = new Set(state.history.map((entry) => entry.id));

  const filteredBeers = state.beers.filter((beer) => {
    const matchesCategory = state.settings.selectedCategories.has(
      beer.category?.trim(),
    );

    if (!matchesCategory) {
      return false;
    }

    if (state.settings.alcoholFreeOnly && beer.alcoholfree !== "1") {
      return false;
    }

    if (state.settings.glutenFreeOnly && beer.glutenfree !== "1") {
      return false;
    }

    if (!state.settings.avoidDuplicates) {
      return true;
    }

    return !historyIds.has(beer.id);
  });

  if (filteredBeers.length === 0) {
    showMessage(
      "Keine Biere mit den ausgewählten Einstellungen verfügbar.",
      "warning",
    );
    return null;
  }

  const beer = filteredBeers[Math.floor(Math.random() * filteredBeers.length)];

  return beer;
}

function checkAppVersion() {
  const savedVersion = localStorage.getItem("app_version");

  if (savedVersion !== APP_VERSION) {
    // Schema mismatch or first run: purge old state
    localStorage.clear();

    // Write current version
    localStorage.setItem("app_version", APP_VERSION);
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem("settings");
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    return {
      ...parsed,
      selectedCategories: new Set(parsed.selectedCategories || []),
    };
  } catch (error) {
    showMessage(
      `Fehler beim Laden der Einstellungen: \n${error.message}`,
      "error",
    );
    return null;
  }
}

function saveSettings() {
  const payload = {
    ...state.settings,
    selectedCategories: Array.from(state.settings.selectedCategories),
  };
  localStorage.setItem("settings", JSON.stringify(payload));
}

function handleSettingInputChange(event) {
  const input = event.target;
  const settingName = input.dataset.setting;

  if (!settingName) {
    return;
  }

  if (input.type === "checkbox") {
    state.settings[settingName] = input.checked;
  } else {
    state.settings[settingName] = input.value;
  }

  saveSettings();
}

function addHistoryEntry(beer) {
  const entry = {
    id: beer.id,
    name: beer.name,
  };

  state.history.push(entry);
  saveHistory();
}

function clearHistory() {
  state.history = [];
  saveHistory();
  showMessage("Verlauf gelöscht");
}

function loadHistory() {
  return JSON.parse(localStorage.getItem("history") || "[]");
}

function saveHistory() {
  localStorage.setItem("history", JSON.stringify(state.history));
}

// -----------------------------------------------------------------------------
// UI rendering
// -----------------------------------------------------------------------------
/**
 * Render the category filter checkboxes inside the menu.
 *
 * @returns {void}
 */
function renderCategoryFilters() {
  const container = $("#category-checkboxes");

  container.innerHTML = state.categories
    .map(
      (category) => `
        <label class="category-option">
          <input type="checkbox" value="${category}" />
          <span>${category}</span>
        </label>
      `,
    )
    .join("");

  container.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = state.settings.selectedCategories.has(checkbox.value);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.settings.selectedCategories.add(checkbox.value);
      } else {
        state.settings.selectedCategories.delete(checkbox.value);
      }

      saveSettings();
    });
  });
}

function initializeSettingInputs() {
  document.querySelectorAll("input[data-setting]").forEach((input) => {
    const settingName = input.dataset.setting;

    if (settingName in state.settings) {
      if (input.type === "checkbox") {
        input.checked = Boolean(state.settings[settingName]);
      } else {
        input.value = state.settings[settingName];
      }
    }

    input.addEventListener("change", handleSettingInputChange);
  });
}

function renderHistoryList() {
  const historyList = $("#history-list");

  historyList.innerHTML = `<table><tbody></tbody></table>`;

  state.history.map((entry, index) => {
    const historyTable = $("#history-list table tbody");
    const newRow = `<tr><td>${index + 1}.</td><td>${entry.name}</td></tr>`;

    historyTable.insertAdjacentHTML("beforeend", newRow);
  });
}
/**
 * Render the selected beer into the results view.
 *
 * @param {Record<string, string>} beer - The beer object to display.
 * @returns {void}
 */
function renderBeer(beer) {
  $("#beer-name").textContent = beer.name;

  $("#beer-info").textContent =
    `${beer.category} (alc. ${beer.alcohol}${isNumber(beer.alcohol) ? "% vol." : ""})`;

  const [sizes, prices] = [beer.sizes, beer.prices].map((str) =>
    str.split("/"),
  );

  $("#beer-pricing").innerHTML = `<table><tbody></tbody></table>`;

  sizes.map((size, index) => {
    const pricingTable = $("#beer-pricing table tbody");
    const newRow = `<tr><td>${size}:</td><td>${prices[index]}€</td></tr>`;

    pricingTable.insertAdjacentHTML("beforeend", newRow);
  });

  $("#beer-description").innerHTML = `<p>"${beer.description}"</p>`;
  $("#beer-hint").innerHTML = `<p>${beer.hint ? `[${beer.hint}]` : ""}</p>`;
}

// -----------------------------------------------------------------------------
// UI interactions
// -----------------------------------------------------------------------------

/**
 * Toggle the burger menu panel and overlay visibility.
 *
 * @returns {void}
 */
function showOverlayBG() {
  const overlayBG = $("#overlay-bg");
  overlayBG.classList.remove("hidden");
}

function toggleMenu() {
  const burgerMenuPanel = $("#burger-menu-panel");

  if (burgerMenuPanel.classList.contains("hidden")) {
    showOverlayBG();
    burgerMenuPanel.classList.remove("hidden");
  } else {
    clearOverlay();
  }
}

function showHistory() {
  const historyWrapper = $(".history-wrapper");

  toggleMenu();
  showOverlayBG();

  renderHistoryList();

  historyWrapper.classList.remove("hidden");
}

function clearOverlay() {
  const overlays = $$(".overlay");

  overlays.forEach((overlay) => {
    overlay.classList.add("hidden");
  });
}

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------

/**
 * Initialize the app by loading data and wiring event listeners.
 *
 * @returns {void}
 */
async function initializeApp() {
  checkAppVersion();

  state.beers = await loadBeers();
  state.categories = getCategories();

  const savedSettings = loadSettings();

  if (savedSettings) {
    state.settings = { ...DEFAULT_SETTINGS, ...savedSettings };
  } else {
    state.settings = {
      ...DEFAULT_SETTINGS,
      selectedCategories: new Set(state.categories),
    };
  }
}

function initializeUI() {
  renderCategoryFilters();

  $(".burger-menu").addEventListener("click", toggleMenu);
  $("#show-history").addEventListener("click", showHistory);
  $(".history-close").addEventListener("click", clearOverlay);
  $("#clear-history").addEventListener("click", clearHistory);
  $("#overlay-bg").addEventListener("click", clearOverlay);

  initializeSettingInputs();

  $("#roulette-button").addEventListener("click", async () => {
    const beer = selectRandomBeer();

    if (beer) {
      await new Promise((resolve) => {
        $("#roulette-button").classList.add("unclickable", "anm-spinning");
        $("#result-wrapper").classList.add("hidden");

        setTimeout(() => {
          $("#roulette-button").classList.remove("unclickable", "anm-spinning");
          resolve();
        }, 2000);
      });

      addHistoryEntry(beer);
      renderBeer(beer);
      $("#result-wrapper").classList.remove("hidden");
    }
  });

  $(".message-wrapper").addEventListener("click", hideMessage);
}

document.addEventListener("DOMContentLoaded", async () => {
  await initializeApp();
  initializeUI();
});
