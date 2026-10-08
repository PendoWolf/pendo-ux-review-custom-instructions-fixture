import { useEffect, useState } from "react";
import { api, ApiError, type AppState } from "./api";

type Action = "load" | "increment" | "decrement" | "reset" | "refresh";

// Seam for Pendo. Novus installs the Pendo agent, which provides window.pendo
// at runtime; this fires a Track Event for each action. No-op when the agent
// isn't present (local dev), so the app and Playwright mocks both stay simple.
// Event names are `demo-<name>`: demo-load, demo-increment, demo-decrement,
// demo-reset and demo-refresh on success; demo-action-failed on failure.
function trackEvent(name: Action | "action-failed", properties: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    window.pendo?.track?.(`demo-${name}`, properties);
  }
}

// Properties for a successful action. `previous` is the state that was on
// screen when the action started; `next` is the state the API returned.
function successProperties(
  action: Action,
  previous: AppState,
  next: AppState,
  hadError: boolean,
): Record<string, unknown> {
  switch (action) {
    case "load":
      return { counter: next.counter, lastAction: next.lastAction };
    case "increment":
    case "decrement":
      return { counter: next.counter, previousCounter: previous.counter };
    case "reset":
      // The counter is always 0 afterwards, so report what was cleared.
      return { previousCounter: previous.counter, previousLastAction: previous.lastAction };
    case "refresh":
      return {
        counter: next.counter,
        previousCounter: previous.counter,
        lastAction: next.lastAction,
        stateChanged: next.counter !== previous.counter || next.lastAction !== previous.lastAction,
        recoveredFromError: hadError,
      };
  }
}

// Properties for demo-action-failed. method/path/status are only known for an
// ApiError, and status is absent for network failures (no response).
function failureProperties(action: Action, e: unknown): Record<string, unknown> {
  const apiError = e instanceof ApiError ? e : undefined;
  return {
    action,
    // Capped so the event stays well under Pendo's 512-byte properties limit.
    errorMessage: (e instanceof Error ? e.message : String(e)).slice(0, 100),
    method: apiError?.method,
    path: apiError?.path,
    status: apiError?.status,
  };
}

export default function App() {
  const [state, setState] = useState<AppState>({ counter: 0, lastAction: "none" });
  const [error, setError] = useState<string | null>(null);

  const run = async (name: Action, fn: () => Promise<AppState>) => {
    // What was on screen when the action started, for the Track Event properties.
    const previous = state;
    const hadError = error !== null;
    try {
      setError(null);
      const next = await fn();
      setState(next);
      trackEvent(name, successProperties(name, previous, next, hadError));
    } catch (e) {
      setError((e as Error).message);
      trackEvent("action-failed", failureProperties(name, e));
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
