import "./style.css";

const $ = document.querySelector.bind(document);

// -----------------------------------------------------------------------------
// App state
// -----------------------------------------------------------------------------
const CURRENT_VERSION = "1.0.30";

const state = {
  settings: loadSettings(),
  history: loadHistory(),

  beers: [],
  categories: [],
};

let messageTimeout = null;

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
// Filter management
// -----------------------------------------------------------------------------

/**
 * Extract all unique beer categories from the loaded dataset.
 *
 * @returns {string[]} Sorted list of category names.
 */
function getCategories() {
  const categoryValues = state.beers
    .map((beer) => beer.Kategorie?.trim())
    .filter(Boolean);

  return [...new Set(categoryValues)].sort((a, b) =>
    a.localeCompare(b, "de", { sensitivity: "base" }),
  );
}

/**
 * Restore the selected category filters from local storage.
 *
 * @returns {Set<string>} The restored selection or the current category list.
 */
function loadSelectedCategories() {
  try {
    const storedCategories = localStorage.getItem("selectedCategories");

    if (storedCategories) {
      const parsedCategories = JSON.parse(storedCategories);

      if (Array.isArray(parsedCategories)) {
        return new Set(parsedCategories);
      }
    }
  } catch (error) {
    showMessage(
      `Lokale Filtereinstellung konnten nicht geladen werden. \n\n ${error}`,
      "warning",
    );
  }

  return new Set(categories);
}

function saveAvoidDuplicates() {
  localStorage.setItem("avoidDuplicates", JSON.stringify(avoidDuplicates));
}

function loadAvoidDuplicates() {}

/**
 * Render the category filter checkboxes inside the menu.
 *
 * @returns {void}
 */
function renderCategoryFilters() {
  const container = $("#category-checkboxes");

  container.innerHTML = categories
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
    checkbox.checked = selectedCategories.has(checkbox.value);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedCategories.add(checkbox.value);
      } else {
        selectedCategories.delete(checkbox.value);
      }

      saveSelectedCategories();
    });
  });
}

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

    beers = [...parseCsvContent(dauerhaftCsv), ...parseCsvContent(saisonalCsv)];

    if (beers.length === 0) {
      throw new Error(
        "Die Bierkarte ist leer. Bitte überprüfe die CSV-Dateien.",
      );
    }

    categories = getCategories();
    selectedCategories = loadSelectedCategories();
    renderCategoryFilters();
  } catch (error) {
    showMessage(error.message, "error");
    beers = [];
  }
}

// -----------------------------------------------------------------------------
// Beer selection and rendering
// -----------------------------------------------------------------------------

/**
 * Choose a random beer from the currently active filters.
 *
 * @returns {Record<string, string>|null} The selected beer, or null if none can be chosen.
 */
function selectRandomBeer() {
  if (beers.length === 0) {
    showMessage("Keine Biere verfügbar.", "warning");
    return null;
  }

  if (selectedCategories.size === 0) {
    showMessage("Kein Filter aktiv!", "warning");
    return null;
  }

  if (
    selectedCategories.size === 1 &&
    selectedCategories.has("alkoholfreies Bier")
  ) {
    showMessage("Dein Ernst...!?");
  }

  const filteredBeers = beers.filter((beer) =>
    selectedCategories.has(beer.Kategorie?.trim()),
  );

  if (filteredBeers.length === 0) {
    showMessage(
      "Keine Biere für die ausgewählten Filter verfügbar.",
      "warning",
    );
    return null;
  }

  const beer = filteredBeers[Math.floor(Math.random() * filteredBeers.length)];

  return beer;
}

/**
 * Render the selected beer into the results view.
 *
 * @param {Record<string, string>} beer - The beer object to display.
 * @returns {void}
 */
function renderBeer(beer) {
  $("#beer-name").textContent = beer.Bier;

  if (isNumber(beer.Alkoholgehalt)) {
    $("#beer-info").textContent =
      `${beer.Kategorie} (alc. ${beer.Alkoholgehalt}% vol.)`;
  } else {
    $("#beer-info").textContent =
      `${beer.Kategorie} (alc. ${beer.Alkoholgehalt})`;
  }

  const [sizes, prices] = [beer.Portionsgröße, beer.Preis].map((str) =>
    str.split("/"),
  );

  $("#beer-pricing").innerHTML = `<table><tbody></tbody></table>`;

  sizes.map((size, index) => {
    const pricingTable = $("#beer-pricing table tbody");
    const newRow = `<tr><td>${size}:</td><td>${prices[index]}€</td></tr>`;

    pricingTable.insertAdjacentHTML("beforeend", newRow);
  });

  const extraDetails = [beer.Beschreibung, beer.Besonderheiten, beer.Hinweise]
    .filter(Boolean)
    .map((value) => value.trim())
    .filter(Boolean);

  $("#beer-extra").innerHTML = extraDetails
    .map((detail) => `<p>${detail}</p>`)
    .join("");
}

// -----------------------------------------------------------------------------
// UI interactions
// -----------------------------------------------------------------------------

/**
 * Toggle the burger menu panel and overlay visibility.
 *
 * @returns {void}
 */
function toggleMenu() {
  const burgerMenuPanel = $("#burger-menu-panel");
  const overlay = $(".overlay");

  burgerMenuPanel.classList.toggle("hidden");
  overlay.classList.toggle("hidden");
}

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------

/**
 * Initialize the app by loading data and wiring event listeners.
 *
 * @returns {void}
 */
function initializeApp() {
  loadBeers();

  $(".burger-menu").addEventListener("click", toggleMenu);
  $(".overlay").addEventListener("click", toggleMenu);

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

      renderBeer(beer);
      $("#result-wrapper").classList.remove("hidden");
    }
  });

  $(".message-wrapper").addEventListener("click", hideMessage);
}

initializeApp();
