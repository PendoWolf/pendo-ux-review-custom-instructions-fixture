// API base URL. Defaults to the local server; override via VITE_API_URL for
// deployed/preview environments (QAWolf runs against whatever URL this points at).
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export interface AppState {
  counter: number;
  lastAction: string;
}

// Thrown by call() so callers can report which request failed and how.
// status is undefined for network failures, which never got a response.
export class ApiError extends Error {
  constructor(
    message: string,
    readonly method: "GET" | "POST",
    readonly path: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function call(path: string, method: "GET" | "POST"): Promise<AppState> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method });
  } catch (e) {
    // Network failure (server unreachable, CORS, offline): keep fetch's message.
    throw new ApiError((e as Error).message, method, path);
  }
  if (!res.ok) throw new ApiError(`${method} ${path} failed: ${res.status}`, method, path, res.status);
  return res.json() as Promise<AppState>;
}

export const api = {
  getState: () => call("/api/state", "GET"),
  increment: () => call("/api/increment", "POST"),
  decrement: () => call("/api/decrement", "POST"),
  reset: () => call("/api/reset", "POST"),
};
