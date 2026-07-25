export default function Toast({ message, actionLabel, onAction, onDismiss }) {
  return (
    <div className="toast">
      <span>{message}</span>
      <div className="toast-actions">
        {actionLabel && (
          <button className="btn-link toast-action" onClick={onAction}>
            {actionLabel}
          </button>
        )}
        <button className="btn-close" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
    </div>
  );
}
