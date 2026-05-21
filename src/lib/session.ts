const KEY = "aczen.session_id";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = uuid();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
