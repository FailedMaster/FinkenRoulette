import "./style.css";

const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

let beers = [];
let categories = [];
let selectedCategories = new Set();

let messageTimeout;

/**
 * Display a message banner and hide it when clicked.
 *
 * @param {string} message - The message text to show.
 * @param {"info"|"warning"|"error"} [type="info"] - The message style.
 */
function showMessage(message, type = "info") {
  hideMessage();
  $("#message-content").textContent = message;
  $(".message-wrapper").classList.add(type);
  $(".message-wrapper").classList.remove("hidden");

  clearTimeout(messageTimeout);
  messageTimeout = setTimeout(hideMessage, 5000);
}

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

  const headers = lines[0].split(separator);

  return lines.slice(1).map((line) => {
    const values = line.split(separator);

    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
  });
}

function getCategories() {
  const categories = beers
    .map((beer) => beer.Kategorie?.trim())
    .filter((category) => category);

  return [...new Set(categories)].sort((a, b) =>
    a.localeCompare(b, "de", { sensitivity: "base" }),
  );
}

function saveSelectedCategories() {
  localStorage.setItem(
    "selectedCategories",
    JSON.stringify([...selectedCategories]),
  );
}

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

/**
 * Select a random beer.
 *
 * @returns {Record<string, string>|null} The randomly selected beer object, or null if none.
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

function renderBeer(beer) {
  const result = $("#result");

  result.innerHTML = Object.entries(beer)
    .map(
      ([key, value]) =>
        `<p><span><strong>${key}:</strong></span><span>${value}</span></p>`,
    )
    .join("");
}

loadBeers();

const burgerButton = $(".burger-menu");
const burgerMenuPanel = $("#burger-menu-panel");

burgerButton.addEventListener("click", () => {
  burgerMenuPanel.classList.toggle("hidden");
  burgerMenuPanel.setAttribute(
    "aria-hidden",
    String(burgerMenuPanel.classList.contains("hidden")),
  );
});

$("#roulette-button").addEventListener("click", () => {
  const beer = selectRandomBeer();

  if (beer) {
    renderBeer(beer);
  }
});

$(".message-wrapper").addEventListener("click", hideMessage);
