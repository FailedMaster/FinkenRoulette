function MessageBanner({ message, onDismiss }) {
  return (
    <button
      type="button"
      className={`message-wrapper ${message.type}`}
      onClick={onDismiss}
      aria-live="polite"
    >
      <span className="message-container">
        <span className="message-icon" />
        <span id="message-content">{message.text}</span>
        <span className="message-icon" />
      </span>
    </button>
  );
}

export default MessageBanner;
