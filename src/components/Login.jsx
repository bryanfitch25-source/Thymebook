import { useState } from "react";
import { supabase } from "../supabaseClient";

// Each family's 2 adults sign in with just their first name - Supabase Auth
// still requires a real email address under the hood, so this maps each
// first name to the fake @family.local address it was provisioned with
// (see supabase/functions/provision-families). Keep this in sync with that
// roster if names ever change.
const NAME_TO_EMAIL = {
  stephen: "stephen@summersidefitches.local",
  jenn: "jenn@summersidefitches.local",
  jon: "jon@phillipsfamily.local",
  lindsay: "lindsay@phillipsfamily.local",
  bryan: "bryan@morningsidefitches.local",
  amy: "amy@morningsidefitches.local",
  stacy: "stacy@ashleyfitches.local",
  rob: "rob@ashleyfitches.local",
  carmel: "carmel@maplehurstfitches.local",
};

// No public sign-up - all 8 accounts are created ahead of time via the
// Supabase dashboard / provisioning function.
export default function Login() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    const email = NAME_TO_EMAIL[name.trim().toLowerCase()];
    if (!email) {
      setError("Name not recognized. Check the spelling of your first name.");
      return;
    }
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message || "Sign in failed. Check your name and password.");
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="app-title">🌿 Thymebook</h1>
        <p className="login-subtitle">Sign in to your shared recipe book.</p>

        <label className="login-field">
          <span>Name</span>
          <input
            type="text"
            autoComplete="username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label className="login-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" className="btn btn-primary login-submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
