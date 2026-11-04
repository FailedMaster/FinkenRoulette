function HistoryDialog({ history, isOpen, onClose }) {
  return (
    <div
      className={`history-wrapper overlay${isOpen ? "" : " hidden"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-title"
    >
      <div className="history-container">
        <button
          className="history-close"
          type="button"
          aria-label="Verlauf schließen"
          onClick={onClose}
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
  );
}

export default HistoryDialog;
