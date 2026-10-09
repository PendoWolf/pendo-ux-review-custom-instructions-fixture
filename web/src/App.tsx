import { useEffect, useState } from "react";
import { api, ApiError, type AppState } from "./api";

// Counter actions. Each successful action sends the Pendo Track Event
// `demo-<action>` (demo-load, demo-increment, demo-decrement, demo-reset,
// demo-refresh); any failure sends demo-action-failed. Pendo matches event
// names exactly, so renaming an action here renames its event.
type Action = "load" | "increment" | "decrement" | "reset" | "refresh";

// Seam for Pendo. Novus installs the Pendo agent, which provides window.pendo
// at runtime; this fires a Track Event for each action. No-op when the agent
// isn't present (local dev), so the app and Playwright mocks both stay simple.
function trackEvent(name: Action | "action-failed", props?: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    try {
      window.pendo?.track?.(`demo-${name}`, props);
    } catch {
      // Analytics must never break the app or make a successful action look failed.
    }
  }
}

// Track Event properties for a successful action. `previous` is the state on
// screen when the action started; `next` is what the server returned.
function successProps(action: Action, previous: AppState, next: AppState): Record<string, unknown> {
  switch (action) {
    case "load":
      return { counter: next.counter, lastAction: next.lastAction };
    case "increment":
    case "decrement":
      return { counter: next.counter, previousCounter: previous.counter };
    case "reset":
      // The returned counter is always 0; the erased value is the useful part.
      return { previousCounter: previous.counter };
    case "refresh":
      return {
        counter: next.counter,
        lastAction: next.lastAction,
        previousCounter: previous.counter,
        counterChanged: next.counter !== previous.counter,
      };
  }
}

// StrictMode runs mount effects twice in dev; this keeps the initial load, and
// its demo-load event, to once per page load.
let initialLoadStarted = false;

export default function App() {
  const [state, setState] = useState<AppState>({ counter: 0, lastAction: "none" });
  const [error, setError] = useState<string | null>(null);

  const run = async (name: Action, fn: () => Promise<AppState>) => {
    try {
      setError(null);
      const next = await fn();
      setState(next);
      trackEvent(name, successProps(name, state, next));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      trackEvent("action-failed", {
        action: name,
        // Set for HTTP errors; network/CORS failures have no status.
        status: e instanceof ApiError ? e.status : undefined,
        errorMessage: message.slice(0, 100),
      });
    }
  };

  useEffect(() => {
    if (!initialLoadStarted) {
      initialLoadStarted = true;
      run("load", api.getState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "4rem auto", textAlign: "center" }}>
      <h1>QAWolf Demo</h1>

      <p data-testid="counter-value" style={{ fontSize: "3rem", margin: "1rem 0" }}>
        {state.counter}
      </p>
      <p data-testid="last-action" style={{ color: "#666" }}>
        Last action: {state.lastAction}
      </p>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <button data-testid="btn-increment" onClick={() => run("increment", api.increment)}>
          Increment
        </button>
        <button data-testid="btn-decrement" onClick={() => run("decrement", api.decrement)}>
          Decrement
        </button>
        <button data-testid="btn-reset" onClick={() => run("reset", api.reset)}>
          Reset
        </button>
        <button data-testid="btn-refresh" onClick={() => run("refresh", api.getState)}>
          Refresh
        </button>
      </div>

      {error && (
        <p data-testid="error" style={{ color: "crimson", marginTop: 16 }}>
          {error}
        </p>
      )}
    </main>
  );
}
