import { useState } from "react";
import { analyticsEnabled, setAnalyticsEnabled } from "./analytics";
import "./metrics.css";
export default function AnalyticsChoice() {
  const [enabled, setEnabled] = useState(analyticsEnabled);
  const [open, setOpen] = useState(false);
  return <aside className="analytics-choice" aria-label="Usage analytics preferences">
    <button onClick={() => setOpen(!open)} aria-expanded={open}>Usage privacy</button>
    {open && <><p>Anonymous usage metrics help improve NurseBridge. We collect visits, pathway and learning-action counts, without answers, names or wallets. Browser Do Not Track is respected. Turning this off affects future activity; it does not delete previously recorded metrics.</p><label><input type="checkbox" checked={enabled} onChange={e => { setEnabled(e.target.checked); setAnalyticsEnabled(e.target.checked); }} /> Share anonymous usage</label></>}
  </aside>;
}
