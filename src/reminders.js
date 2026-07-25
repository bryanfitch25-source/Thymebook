import { supabase } from "./supabaseClient";
import { DAYS } from "./mealPlan";

const TABLE = "reminders";

// Fixed, documented assumed cook-time anchor for meal-planner-linked
// reminders: "Wednesday" on its own has no absolute moment, so we treat
// every planned day as landing at 6:00 PM local time, and count the chosen
// lead time back from there. Surfaced in the UI copy so it's never a black
// box (e.g. "Remind me 24h before ~6pm Wednesday").
export const ASSUMED_COOK_HOUR = 18; // 6:00 PM local time

export const LEAD_HOUR_OPTIONS = [12, 24, 48];

function newReminderId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function rowToReminder(row) {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    label: row.label || "",
    remindAt: row.remind_at,
    leadHours: row.lead_hours,
    source: row.source,
    status: row.status,
    createdAt: row.created_at,
  };
}

function reminderToRow(reminder) {
  return {
    id: reminder.id,
    recipe_id: reminder.recipeId || null,
    label: reminder.label || "",
    remind_at: reminder.remindAt,
    lead_hours: reminder.leadHours,
    source: reminder.source,
    status: reminder.status || "pending",
    created_at: reminder.createdAt || new Date().toISOString(),
  };
}

export async function fetchReminders() {
  const { data, error } = await supabase.from(TABLE).select("*").order("remind_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToReminder);
}

export async function createReminder({ recipeId, label, remindAt, leadHours, source }) {
  const reminder = {
    id: newReminderId(),
    recipeId: recipeId || null,
    label: label || "",
    remindAt: new Date(remindAt).toISOString(),
    leadHours,
    source,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  const { error } = await supabase.from(TABLE).insert(reminderToRow(reminder));
  if (error) throw error;
  return reminder;
}

export async function cancelReminder(id) {
  const { error } = await supabase.from(TABLE).update({ status: "cancelled" }).eq("id", id);
  if (error) throw error;
}

export async function deleteReminder(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

export function subscribeReminders(onChange) {
  const channel = supabase
    .channel("reminders-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
      if (payload.eventType === "DELETE") {
        onChange("DELETE", { id: payload.old?.id });
      } else {
        onChange(payload.eventType, rowToReminder(payload.new));
      }
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// --- Weekday -> absolute datetime resolution --------------------------------

// Resolves "the next upcoming occurrence of `dayName` at ASSUMED_COOK_HOUR"
// into an absolute Date, from `from` (defaults to now). Today counts as the
// "next occurrence" as long as the assumed cook time hasn't already passed
// today - otherwise it rolls to next week.
export function nextOccurrenceOf(dayName, from = new Date()) {
  const targetIndex = DAYS.indexOf(dayName); // Monday=0 ... Sunday=6
  if (targetIndex === -1) return null;

  // JS Date.getDay(): Sunday=0 ... Saturday=6. Convert to Monday=0 basis.
  const jsToMondayBasis = (d) => (d === 0 ? 6 : d - 1);
  const todayIndex = jsToMondayBasis(from.getDay());

  let daysAhead = targetIndex - todayIndex;
  if (daysAhead < 0) daysAhead += 7;

  const candidate = new Date(from);
  candidate.setHours(ASSUMED_COOK_HOUR, 0, 0, 0);
  candidate.setDate(candidate.getDate() + daysAhead);

  // If today is the target day but 6pm has already passed, roll to next week.
  if (daysAhead === 0 && candidate.getTime() <= from.getTime()) {
    candidate.setDate(candidate.getDate() + 7);
  }

  return candidate;
}

// Given a weekday name and a lead time, returns the absolute remind_at
// Date: `leadHours` before the assumed 6pm cook-time anchor on the next
// occurrence of that weekday.
export function computeMealPlanReminderTime(dayName, leadHours, from = new Date()) {
  const cookMoment = nextOccurrenceOf(dayName, from);
  if (!cookMoment) return null;
  return new Date(cookMoment.getTime() - leadHours * 60 * 60 * 1000);
}
