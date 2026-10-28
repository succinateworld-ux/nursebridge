import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AdminMetrics from "./AdminMetrics";
import AnalyticsChoice from "./AnalyticsChoice";
import { useEffect, useState } from "react";
import "./styles.css";
import "./product.css";
import "./experience.css";
import "./glacier.css";

function Root() {
  const [admin, setAdmin] = useState(window.location.hash === "#admin");
  useEffect(() => {
    const change = () => setAdmin(window.location.hash === "#admin");
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return admin ? <AdminMetrics /> : <><App /><AnalyticsChoice /></>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><Root /></React.StrictMode>);

