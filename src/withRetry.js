// Mobile connections drop requests mid-flight often enough that a single
// blip shouldn't surface as a scary error (Safari reports these as
// `TypeError: Load failed`, Chrome as `TypeError: Failed to fetch` - both
// are the browser giving up on the network layer, not a real app error).
// Retries a couple of times with a short backoff before giving up for real.
export async function withRetry(fn, attempts = 3, delayMs = 500) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}
