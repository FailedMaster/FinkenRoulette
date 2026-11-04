export const APP_VERSION = "1.2.0";

const APP_DATA_KEYS = ["settings", "history"];

export const DEFAULT_SETTINGS = {
  selectedCategories: new Set(),
  avoidDuplicates: false,
  alcoholOnly: false,
  alcoholFreeOnly: false,
  glutenFreeOnly: false,
};

export function initializeAppStorage() {
  const savedVersion = localStorage.getItem("app_version");

  if (savedVersion !== APP_VERSION) {
    APP_DATA_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem("app_version", APP_VERSION);
  }
}

export function loadSettings() {
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

export function saveSettings(settings) {
  localStorage.setItem(
    "settings",
    JSON.stringify({
      ...settings,
      selectedCategories: Array.from(settings.selectedCategories),
    }),
  );
}

export function loadHistory() {
  const history = JSON.parse(localStorage.getItem("history") || "[]");

  if (!Array.isArray(history)) {
    throw new Error("Der gespeicherte Verlauf ist ungültig.");
  }

  return history;
}

export function saveHistory(history) {
  localStorage.setItem("history", JSON.stringify(history));
}
