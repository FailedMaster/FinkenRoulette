import { useEffect, useMemo, useRef, useState } from "react";
import { isFlagSet, loadBeers } from "./beerData.js";
import {
  DEFAULT_SETTINGS,
  initializeAppStorage,
  loadHistory,
  loadSettings,
  saveHistory,
  saveSettings,
} from "./storage.js";

function useRouletteApp() {
  const [beers, setBeers] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [history, setHistory] = useState([]);
  const historyRef = useRef(history);
  const [selectedBeer, setSelectedBeer] = useState(null);
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

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        initializeAppStorage();
        const savedSettings = loadSettings();
        const savedHistory = loadHistory();

        if (isMounted) {
          updateHistory(savedHistory);
          if (savedSettings) {
            setSettings(savedSettings);
          }
        }

        const loadedBeers = await loadBeers();

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

  function updateHistory(nextHistory) {
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    saveHistory(nextHistory);
  }

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
      updateHistory([...historyRef.current, { id: beer.id, name: beer.name }]);
      setSelectedBeer(beer);
      setIsSpinning(false);
    }, 2000);
  }

  return {
    categories,
    clearHistory,
    history,
    isLoading,
    isSpinning,
    message,
    selectedBeer,
    settings,
    chooseBeer,
    dismissMessage: () => setMessage(null),
    showMessage,
    toggleCategory,
    updateSetting,
  };
}

export default useRouletteApp;
