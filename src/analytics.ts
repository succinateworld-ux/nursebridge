type EventName = "visit" | "question_answered" | "practice_started" | "practice_completed" | "exam_started" | "exam_completed" | "lesson_completed" | "pathway_selected";
const KEY = "nursebridge:analytics-id:v1";
const OPT_OUT = "nursebridge:analytics-opt-out:v1";
let lastVisit = 0;
export function analyticsEnabled() { try { return localStorage.getItem(OPT_OUT) !== "true"; } catch { return false; } }
export function setAnalyticsEnabled(enabled: boolean) {
  try { localStorage.setItem(OPT_OUT, String(!enabled)); if (!enabled) localStorage.removeItem(KEY); } catch { /* Learning remains available. */ }
}
export function track(name: EventName, pathway?: string | null) {
  try {
    if (!analyticsEnabled() || navigator.doNotTrack === "1" || window.location.hash === "#admin") return;
    let learner = localStorage.getItem(KEY);
    if (!learner) { learner = crypto.randomUUID(); localStorage.setItem(KEY, learner); }
    const body = JSON.stringify({ id: crypto.randomUUID(), learner, name, pathway: pathway ?? "general" });
    void fetch("/api/metrics/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* Metrics must never interrupt learning. */ }
}
export function visit(pathway?: string | null) {
  if (Date.now() - lastVisit < 60_000) return;
  lastVisit = Date.now();
  track("visit", pathway);
}
