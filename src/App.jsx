import { useEffect, useMemo, useRef, useState } from "react";
import "./style.css";

const APP_VERSION = "1.1.2";

const DEFAULT_SETTINGS = {
  selectedCategories: new Set(),
  avoidDuplicates: false,
  alcoholOnly: false,
  alcoholFreeOnly: false,
  glutenFreeOnly: false,
};

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

    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function isNumber(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return false;
  }

  return !Number.isNaN(Number(value.replace(",", ".")));
}

function isFlagSet(value) {
  return ["1", "true", "ja"].includes(String(value).trim().toLowerCase());
}

function readSettings() {
  const raw = localStorage.getItem("settings");

  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw);
  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    selectedCategories: new Set(parsed.selectedCategories || []),
  };
}

function saveSettings(settings) {
  localStorage.setItem(
    "settings",
    JSON.stringify({
      ...settings,
      selectedCategories: Array.from(settings.selectedCategories),
    }),
  );
}

function App() {
  const [beers, setBeers] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [history, setHistory] = useState([]);
  const historyRef = useRef(history);
  const [selectedBeer, setSelectedBeer] = useState(null);
  const [overlay, setOverlay] = useState(null);
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const spinTimeout = useRef(null);

  const categories = useMemo(
    () =>
      [...new Set(beers.map((beer) => beer.category?.trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "de", { sensitivity: "base" }),
      ),
    [beers],
  );

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(
    () => () => {
      window.clearTimeout(spinTimeout.current);
    },
    [],
  );

  function updateHistory(nextHistory) {
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    localStorage.setItem("history", JSON.stringify(nextHistory));
  }

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        const savedVersion = localStorage.getItem("app_version");

        if (savedVersion !== APP_VERSION) {
          localStorage.clear();
          localStorage.setItem("app_version", APP_VERSION);
        }

        const savedSettings = readSettings();
        const savedHistory = JSON.parse(localStorage.getItem("history") || "[]");

        if (!Array.isArray(savedHistory)) {
          throw new Error("Der gespeicherte Verlauf ist ungültig.");
        }

        if (isMounted) {
          updateHistory(savedHistory);
          if (savedSettings) {
            setSettings(savedSettings);
          }
        }

        const [permanentResponse, seasonalResponse] = await Promise.all([
          fetch("/Bierkarte_dauerhaft.csv"),
          fetch("/Bierkarte_saisonal.csv"),
        ]);

        if (!permanentResponse.ok || !seasonalResponse.ok) {
          throw new Error(
            "Fehler beim Laden der Bierkarte. Bitte versuche es später erneut.",
          );
        }

        const [permanentCsv, seasonalCsv] = await Promise.all([
          permanentResponse.text(),
          seasonalResponse.text(),
        ]);
        const loadedBeers = [
          ...parseCsvContent(permanentCsv),
          ...parseCsvContent(seasonalCsv),
        ];

        if (loadedBeers.length === 0) {
          throw new Error("Die Bierkarte ist leer. Bitte überprüfe die CSV-Dateien.");
        }

        if (isMounted) {
          setBeers(loadedBeers);
          if (!savedSettings) {
            setSettings({
              ...DEFAULT_SETTINGS,
              selectedCategories: new Set(
                loadedBeers
                  .map((beer) => beer.category?.trim())
                  .filter(Boolean),
              ),
            });
          }
        }
      } catch (error) {
        if (isMounted) {
          setMessage({
            text:
              error instanceof Error
                ? error.message
                : "Ein unbekannter Fehler ist aufgetreten.",
            type: "error",
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initialize();
    return () => {
      isMounted = false;
    };
  }, []);

  function updateSetting(name, value) {
    const nextSettings = { ...settings, [name]: value };

    if (name === "alcoholOnly" && value) {
      nextSettings.alcoholFreeOnly = false;
    }
    if (name === "alcoholFreeOnly" && value) {
      nextSettings.alcoholOnly = false;
    }

    setSettings(nextSettings);
    saveSettings(nextSettings);
  }

  function toggleCategory(category) {
    const selectedCategories = new Set(settings.selectedCategories);

    if (selectedCategories.has(category)) {
      selectedCategories.delete(category);
    } else {
      selectedCategories.add(category);
    }

    const nextSettings = { ...settings, selectedCategories };
    setSettings(nextSettings);
    saveSettings(nextSettings);
  }

  function showMessage(text, type = "info") {
    setMessage({ text, type });
  }

  function clearHistory() {
    updateHistory([]);
    showMessage("Verlauf gelöscht");
  }

  function chooseBeer() {
    if (isSpinning) {
      return;
    }
    if (beers.length === 0) {
      showMessage("Keine Biere verfügbar.", "warning");
      return;
    }
    if (settings.selectedCategories.size === 0) {
      showMessage("Kein Filter aktiv!", "warning");
      return;
    }

    const historyIds = new Set(history.map((entry) => entry.id));
    const filteredBeers = beers.filter((beer) => {
      if (!settings.selectedCategories.has(beer.category?.trim())) {
        return false;
      }
      if (settings.alcoholFreeOnly && !isFlagSet(beer.alcoholfree)) {
        return false;
      }
      if (settings.alcoholOnly && isFlagSet(beer.alcoholfree)) {
        return false;
      }
      if (settings.glutenFreeOnly && !isFlagSet(beer.glutenfree)) {
        return false;
      }
      return !settings.avoidDuplicates || !historyIds.has(beer.id);
    });

    if (filteredBeers.length === 0) {
      showMessage(
        "Keine Biere mit den ausgewählten Einstellungen verfügbar.",
        "warning",
      );
      return;
    }

    const beer = filteredBeers[Math.floor(Math.random() * filteredBeers.length)];
    setIsSpinning(true);
    setSelectedBeer(null);
    spinTimeout.current = window.setTimeout(() => {
      const nextHistory = [...historyRef.current, { id: beer.id, name: beer.name }];
      updateHistory(nextHistory);
      setSelectedBeer(beer);
      setIsSpinning(false);
    }, 2000);
  }

  function toggleHistory() {
    setOverlay((current) => (current === "history" ? null : "history"));
  }

  const dismissOverlays = () => setOverlay(null);

  return (
    <div id="app">
      <div className="top-bar" />
      <header>
        <div className="header-content">
          <button
            id="history-button"
            type="button"
            aria-label="Verlauf anzeigen"
            onClick={toggleHistory}
          >
            <span className="history-icon" />
          </button>
          <h1>Finkenroulette</h1>
          <button
            className="burger-menu"
            type="button"
            aria-label="Menü öffnen"
            aria-expanded={overlay === "menu"}
            onClick={() =>
              setOverlay((current) => (current === "menu" ? null : "menu"))
            }
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <div
        id="overlay-bg"
        className={`overlay${overlay ? "" : " hidden"}`}
        onClick={dismissOverlays}
      />

      <div
        id="burger-menu-panel"
        className={`overlay${overlay === "menu" ? "" : " hidden"}`}
        aria-label="Einstellungen"
      >
        <div className="menu-section">
          <h2>Kategorien</h2>
          <div id="category-checkboxes">
            {categories.map((category) => (
              <label className="category-option" key={category}>
                <input
                  type="checkbox"
                  checked={settings.selectedCategories.has(category)}
                  onChange={() => toggleCategory(category)}
                />
                <span>{category}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="menu-section">
          <h2>Einschränkungen</h2>
          <SettingCheckbox
            id="alcohol-only"
            label="Nur alkoholisch"
            checked={settings.alcoholOnly}
            onChange={(value) => updateSetting("alcoholOnly", value)}
          />
          <SettingCheckbox
            id="alcohol-free-only"
            label="Nur alkoholfrei"
            checked={settings.alcoholFreeOnly}
            onChange={(value) => updateSetting("alcoholFreeOnly", value)}
          />
          <SettingCheckbox
            id="gluten-free-only"
            label="Nur glutenfrei"
            checked={settings.glutenFreeOnly}
            onChange={(value) => updateSetting("glutenFreeOnly", value)}
          />
        </div>
        <div className="menu-section">
          <h2>Verlauf</h2>
          <button type="button" onClick={toggleHistory}>
            Verlauf anzeigen
          </button>
          <button type="button" onClick={clearHistory}>
            Verlauf löschen
          </button>
          <SettingCheckbox
            id="avoid-duplicates"
            label="Wiederholungen vermeiden"
            checked={settings.avoidDuplicates}
            onChange={(value) => updateSetting("avoidDuplicates", value)}
          />
        </div>
      </div>

      <div
        className={`history-wrapper overlay${overlay === "history" ? "" : " hidden"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
      >
        <div className="history-container">
          <button
            className="history-close"
            type="button"
            aria-label="Verlauf schließen"
            onClick={dismissOverlays}
          >
            ×
          </button>
          <div>
            <h1 id="history-title">Verlauf</h1>
          </div>
          <div id="history-list">
            <table>
              <tbody>
                {history.map((entry, index) => (
                  <tr key={`${entry.id}-${index}`}>
                    <td>{index + 1}.</td>
                    <td>{entry.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <button
        id="roulette-button"
        type="button"
        aria-label={isLoading ? "Bierkarte wird geladen" : "Bier auswählen"}
        aria-busy={isSpinning}
        className={isSpinning ? "unclickable anm-spinning" : ""}
        onClick={chooseBeer}
      />
      <div id="result-wrapper" className={selectedBeer ? "" : "hidden"}>
        {selectedBeer && <BeerResult beer={selectedBeer} />}
      </div>

      {message && (
        <button
          type="button"
          className={`message-wrapper ${message.type}`}
          onClick={() => setMessage(null)}
          aria-live="polite"
        >
          <span className="message-container">
            <span className="message-icon" />
            <span id="message-content">{message.text}</span>
            <span className="message-icon" />
          </span>
        </button>
      )}
    </div>
  );
}

function SettingCheckbox({ id, label, checked, onChange }) {
  return (
    <label className="category-option" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function BeerResult({ beer }) {
  const sizes = (beer.sizes || "").split("/");
  const prices = (beer.prices || "").split("/");

  return (
    <div id="result">
      <div id="beer-name">
        <p>{beer.name}</p>
      </div>
      <div id="beer-info">
        <p>
          {beer.category} (alc. {beer.alcohol}
          {isNumber(beer.alcohol) ? "% vol." : ""})
        </p>
      </div>
      <div id="beer-pricing">
        <table>
          <tbody>
            {sizes.map((size, index) => (
              <tr key={`${size}-${index}`}>
                <td>{size}:</td>
                <td>{prices[index] || ""}€</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div id="beer-description">
        <p>{beer.description ? `"${beer.description}"` : ""}</p>
      </div>
      <div id="beer-hint">
        <p>{beer.hint ? `[${beer.hint}]` : ""}</p>
      </div>
    </div>
  );
}

export default App;
