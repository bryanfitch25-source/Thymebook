import { useMemo, useState } from "react";
import { LEAD_HOUR_OPTIONS } from "../reminders";
import RecipePicker from "./RecipePicker";

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Renders a <input type="datetime-local"> value from "now + 1 hour" so the
// standalone form starts on a sensible, always-future default.
function defaultLocalDateTime() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function Reminders({
  reminders,
  recipes,
  pushSupported,
  pushPermission,
  pushSubscribed,
  onSubscribe,
  onCreateStandalone,
  onCancel,
  onDelete,
  onBack,
}) {
  const [label, setLabel] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [when, setWhen] = useState(defaultLocalDateTime());
  const [subscribing, setSubscribing] = useState(false);

  const sortedRecipes = recipes.slice().sort((a, b) => a.title.localeCompare(b.title));

  const upcoming = useMemo(
    () => reminders.filter((r) => r.status === "pending").sort((a, b) => new Date(a.remindAt) - new Date(b.remindAt)),
    [reminders]
  );
  const past = useMemo(
    () =>
      reminders
        .filter((r) => r.status !== "pending")
        .sort((a, b) => new Date(b.remindAt) - new Date(a.remindAt)),
    [reminders]
  );

  function recipeTitle(id) {
    return recipes.find((r) => r.id === id)?.title || "";
  }

  async function handleSubscribeClick() {
    setSubscribing(true);
    await onSubscribe();
    setSubscribing(false);
  }

  function handleCreate(e) {
    e.preventDefault();
    if (!when) return;
    onCreateStandalone({
      label: label.trim(),
      recipeId: recipeId || null,
      remindAt: new Date(when).toISOString(),
    });
    setLabel("");
    setRecipeId("");
    setWhen(defaultLocalDateTime());
  }

  return (
    <div className="reminders-view">
      <button className="btn btn-link no-print" onClick={onBack}>
        ← Back
      </button>

      <h1>🧊 Reminders</h1>

      <section className="push-status-card no-print">
        {!pushSupported && (
          <p className="hint">
            This browser doesn't support push notifications. On iPhone, Web Push requires adding Thymebook to
            your Home Screen first (Share → Add to Home Screen), then opening it from there — this is an iOS
            limitation, not a bug.
          </p>
        )}
        {pushSupported && pushPermission === "denied" && (
          <p className="hint">Notifications are blocked for this site in your browser settings. Re-enable them to get thaw reminders here.</p>
        )}
        {pushSupported && pushPermission !== "denied" && !pushSubscribed && (
          <button className="btn btn-primary" onClick={handleSubscribeClick} disabled={subscribing}>
            {subscribing ? "Enabling…" : "🔔 Enable notifications on this device"}
          </button>
        )}
        {pushSupported && pushSubscribed && <p className="hint">✅ This device will receive reminder notifications.</p>}
      </section>

      <section>
        <h2>New reminder</h2>
        <form className="reminder-form" onSubmit={handleCreate}>
          <label>
            Remind me at
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
          </label>
          <label>
            Label <span className="hint">(optional)</span>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Move chicken to the fridge" />
          </label>
          <label>
            Link to a recipe <span className="hint">(optional)</span>
            <RecipePicker recipes={sortedRecipes} value={recipeId} onChange={setRecipeId} includeNoneOption noneLabel="— None —" />
          </label>
          <button type="submit" className="btn btn-primary">
            Create reminder
          </button>
        </form>
      </section>

      <section>
        <h2>Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="empty-state">No upcoming reminders.</p>
        ) : (
          <ul className="reminder-list">
            {upcoming.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{formatDateTime(r.remindAt)}</strong>
                  <div className="hint">
                    {r.label || recipeTitle(r.recipeId) || "Reminder"}
                    {r.source === "mealplan" && LEAD_HOUR_OPTIONS.includes(r.leadHours) ? ` · ${r.leadHours}h lead` : ""}
                  </div>
                </div>
                <button className="btn no-print" onClick={() => onCancel(r.id)}>
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Past</h2>
        {past.length === 0 ? (
          <p className="empty-state">No past reminders yet.</p>
        ) : (
          <ul className="reminder-list reminder-list-past">
            {past.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{formatDateTime(r.remindAt)}</strong>
                  <div className="hint">
                    {r.label || recipeTitle(r.recipeId) || "Reminder"} · {r.status}
                  </div>
                </div>
                <button className="btn-close no-print" aria-label="Delete reminder" onClick={() => onDelete(r.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
