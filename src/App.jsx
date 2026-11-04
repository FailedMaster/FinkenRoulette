import { useState } from "react";
import BeerResult from "./components/BeerResult.jsx";
import HistoryDialog from "./components/HistoryDialog.jsx";
import MessageBanner from "./components/MessageBanner.jsx";
import SettingsMenu from "./components/SettingsMenu.jsx";
import useRouletteApp from "./useRouletteApp.js";
import "./style.css";

function App() {
  const [overlay, setOverlay] = useState(null);
  const {
    categories,
    clearHistory,
    history,
    isLoading,
    isSpinning,
    message,
    selectedBeer,
    settings,
    chooseBeer,
    dismissMessage,
    toggleCategory,
    updateSetting,
  } = useRouletteApp();

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

      <SettingsMenu
        categories={categories}
        isOpen={overlay === "menu"}
        onClearHistory={clearHistory}
        onShowHistory={toggleHistory}
        onToggleCategory={toggleCategory}
        onUpdateSetting={updateSetting}
        settings={settings}
      />
      <HistoryDialog
        history={history}
        isOpen={overlay === "history"}
        onClose={dismissOverlays}
      />

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
        <MessageBanner
          message={message}
          onDismiss={dismissMessage}
        />
      )}
    </div>
  );
}

export default App;
