import { createRoot } from "react-dom/client";
import { PreparationController } from "./controller";
import { ExpeditorPanel } from "./ExpeditorPanel";
import { Expeditor } from "./expeditor";
import { browserServices } from "./services";
import { readHandoff } from "./handoff";
import { createCase, restoreCase, PreparationError } from "./case";
import { registerPreparationTools } from "./webmcp";
import type { ModelContext } from "./webmcp";
import "./preparation.css";

export async function mountPreparation({ getInquiry, getHeaders, beforeAnswer }: { getInquiry: () => string; getHeaders?: () => HeadersInit; beforeAnswer?: () => Promise<boolean> }) {
  const container = document.getElementById("preparation-entry");
  if (!container || container.dataset.mounted) return;
  container.dataset.mounted = "true";
  const token = new URLSearchParams(window.location.hash.slice(1)).get("assist");
  let initialCase, incomingError: string | undefined;
  if (token) {
    initialCase = createCase();
    history.replaceState(null, "", window.location.pathname + window.location.search);
    if (token !== "start") {
      try {
        const raw = await readHandoff(token);
        const restored = restoreCase(raw);
        if (restored) initialCase = restored;
        else incomingError = "The continuation could not be restored. Start by telling your assistant what you would like to work through.";
      } catch (error) { incomingError = error instanceof Error ? error.message : "The continuation could not be loaded."; }
    }
  }
  let storage: Storage | undefined;
  let assistantSession = Boolean(token);
  try {
    if (token) window.sessionStorage.setItem("henry_preparation_assistant_tab_v2", "true");
    assistantSession = window.sessionStorage.getItem("henry_preparation_assistant_tab_v2") === "true";
    storage = assistantSession ? window.sessionStorage : window.localStorage;
  } catch { /* Private browsing may block storage. */ }
  const controller = new PreparationController(storage, initialCase);
  const services = browserServices(getHeaders);
  const work = new Expeditor(controller, { ...services, askHenry: async (...args) => {
    if (beforeAnswer && !(await beforeAnswer())) { controller.close(); throw new PreparationError("access_required", "Sign in to Henry in this browser to continue. Your case is preserved."); }
    return services.askHenry(...args);
  } }, storage);
  const root = createRoot(container);
  if (token) controller.open();
  root.render(<ExpeditorPanel controller={controller} work={work} getInquiry={getInquiry} toolStatus="checking" incomingError={incomingError} assistantSession={assistantSession} />);
  const context = (document as Document & { modelContext?: ModelContext }).modelContext;
  const registration = await registerPreparationTools(controller, context, work);
  if (assistantSession && registration.supported) controller.connect();
  root.render(<ExpeditorPanel controller={controller} work={work} getInquiry={getInquiry} toolStatus={registration.supported ? "supported" : "unavailable"} incomingError={incomingError} assistantSession={assistantSession} />);
  return () => { registration.dispose(); work.dispose(); root.unmount(); delete container.dataset.mounted; };
}
