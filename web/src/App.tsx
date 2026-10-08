import { useEffect, useState } from "react";
import { api, ApiError, type AppState } from "./api";

type Action = "load" | "increment" | "decrement" | "reset" | "refresh";

// Seam for Pendo. Novus installs the Pendo agent, which provides window.pendo
// at runtime; this fires a Track Event for each action. No-op when the agent
// isn't present (local dev), so the app and Playwright mocks both stay simple.
// Events: demo-load, demo-increment, demo-decrement, demo-reset and
// demo-refresh after a successful call; demo-action-failed when one fails.
function trackEvent(name: Action | "action-failed", props?: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    try {
      window.pendo?.track?.(`demo-${name}`, props);
    } catch {
      // Analytics must never break the app.
    }
  }
}

// Success-event properties: the state the server returned, plus the counter the
// user saw when they acted. load has no prior value and reset always lands on
// 0, so each event sends only the fields that carry information.
function successProps(action: Action, next: AppState, previousCounter: number) {
  switch (action) {
    case "load":
      return { counter: next.counter, lastAction: next.lastAction };
    case "increment":
    case "decrement":
      return { counter: next.counter, previousCounter };
    case "reset":
      return { previousCounter };
    case "refresh":
      return { counter: next.counter, lastAction: next.lastAction, previousCounter };
  }
}

// demo-action-failed properties. errorMessage is capped to keep the payload
// inside Pendo's 512-byte property limit; httpStatus exists only for non-2xx.
function failureProps(action: Action, e: unknown) {
  const err = e as Error;
  return {
    action,
    errorMessage: err.message.slice(0, 200),
    errorName: err.name,
    httpStatus: err instanceof ApiError ? err.status : undefined,
  };
}

// React StrictMode runs the mount effect twice in development; report the
// initial load once. Module-level (not a ref) so it holds for the page's life.
let initialLoadReported = false;

function shouldReport(action: Action) {
  if (action !== "load") return true;
  if (initialLoadReported) return false;
  initialLoadReported = true;
  return true;
}

export default function App() {
  const [state, setState] = useState<AppState>({ counter: 0, lastAction: "none" });
  const [error, setError] = useState<string | null>(null);

  const run = async (name: Action, fn: () => Promise<AppState>) => {
    const previousCounter = state.counter;
    try {
      setError(null);
      const next = await fn();
      setState(next);
      if (shouldReport(name)) trackEvent(name, successProps(name, next, previousCounter));
    } catch (e) {
      setError((e as Error).message);
      if (shouldReport(name)) trackEvent("action-failed", failureProps(name, e));
    }
  };

  useEffect(() => {
    run("load", api.getState);
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
