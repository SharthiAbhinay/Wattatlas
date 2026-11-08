// Every request to the Express API goes through apiFetch, so errors look the
// same everywhere: an ApiError with the server's message and HTTP status.
class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch(path, { method = "GET", body, signal } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      signal,
      credentials: "same-origin",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(
      "Can't reach the server. Check your connection and try again.",
      0
    );
  }

  if (response.status === 204) return null;
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    throw new ApiError(
      data?.error || `The server answered with status ${response.status}.`,
      response.status,
      data?.details
    );
  }
  return data;
}

export const getCurrentUser = () => apiFetch("/api/auth/me");
export const logIn = (credentials) =>
  apiFetch("/api/auth/login", { method: "POST", body: credentials });
export const register = (details) =>
  apiFetch("/api/auth/register", { method: "POST", body: details });
export const logOut = () => apiFetch("/api/auth/logout", { method: "POST" });

export const getComparison = (id, signal) =>
  apiFetch(`/api/comparisons/${encodeURIComponent(id)}`, { signal });
export const createComparison = (comparison) =>
  apiFetch("/api/comparisons", { method: "POST", body: comparison });
export const updateComparison = (id, comparison) =>
  apiFetch(`/api/comparisons/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: comparison,
  });
export const deleteComparison = (id) =>
  apiFetch(`/api/comparisons/${encodeURIComponent(id)}`, { method: "DELETE" });
