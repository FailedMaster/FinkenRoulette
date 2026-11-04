function SettingsMenu({
  categories,
  isOpen,
  onClearHistory,
  onShowHistory,
  onToggleCategory,
  onUpdateSetting,
  settings,
}) {
  return (
    <div
      id="burger-menu-panel"
      className={`overlay${isOpen ? "" : " hidden"}`}
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
                onChange={() => onToggleCategory(category)}
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
          onChange={(value) => onUpdateSetting("alcoholOnly", value)}
        />
        <SettingCheckbox
          id="alcohol-free-only"
          label="Nur alkoholfrei"
          checked={settings.alcoholFreeOnly}
          onChange={(value) => onUpdateSetting("alcoholFreeOnly", value)}
        />
        <SettingCheckbox
          id="gluten-free-only"
          label="Nur glutenfrei"
          checked={settings.glutenFreeOnly}
          onChange={(value) => onUpdateSetting("glutenFreeOnly", value)}
        />
      </div>
      <div className="menu-section">
        <h2>Verlauf</h2>
        <button type="button" onClick={onShowHistory}>
          Verlauf anzeigen
        </button>
        <button type="button" onClick={onClearHistory}>
          Verlauf löschen
        </button>
        <SettingCheckbox
          id="avoid-duplicates"
          label="Wiederholungen vermeiden"
          checked={settings.avoidDuplicates}
          onChange={(value) => onUpdateSetting("avoidDuplicates", value)}
        />
      </div>
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

export default SettingsMenu;
