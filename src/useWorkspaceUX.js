import { useEffect, useRef, useState } from "react";
import { defaultWorkspaceView } from "./workspaceExperience.js";

export function useWorkspaceView(module) {
  const [views, setViews] = useState(() => {
    try { const saved = JSON.parse(sessionStorage.getItem("apollo-workspace-views") || "{}"); return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {}; }
    catch { return {}; }
  });
  const view = { ...defaultWorkspaceView(module), ...views[module] };
  const update = (key, value) => setViews(current => {
    const previous = { ...defaultWorkspaceView(module), ...current[module] };
    return { ...current, [module]: { ...previous, [key]: typeof value === "function" ? value(previous[key]) : value } };
  });
  useEffect(() => { try { sessionStorage.setItem("apollo-workspace-views", JSON.stringify(views)); } catch { /* Retain views in memory. */ } }, [views]);
  return { ...view, setQuery: value => update("query", value), setTab: value => update("tab", value), setFilterValue: value => update("filterValue", value), setSortOrder: value => update("sortOrder", value) };
}

export function useDialogFocus(active, selector, onClose) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!active) return undefined;
    const previous = document.activeElement;
    let panel;
    const frame = requestAnimationFrame(() => {
      panel = [...document.querySelectorAll(selector)].at(-1);
      if (!panel) return;
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      if (!panel.hasAttribute("aria-labelledby") && !panel.hasAttribute("aria-label")) panel.setAttribute("aria-label", panel.querySelector("h2,h3")?.textContent || "Workspace dialog");
      panel.tabIndex = -1;
      if (!panel.contains(document.activeElement)) (panel.querySelector("[autofocus], input:not([type=hidden]), textarea, button") || panel).focus({ preventScroll: true });
    });
    const handleKey = event => {
      if (!panel?.isConnected) return;
      const topmost = [...document.querySelectorAll('[aria-modal="true"]')].filter(element => element.getClientRects().length).at(-1);
      if (topmost && topmost !== panel) return;
      if (event.key === "Escape" && close.current) { event.preventDefault(); event.stopPropagation(); close.current(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...panel.querySelectorAll("a[href],button:not(:disabled),input:not(:disabled):not([type=hidden]),textarea:not(:disabled),select:not(:disabled),[tabindex='0']")].filter(element => element.getClientRects().length);
      const first = focusable[0]; const last = focusable.at(-1);
      if (!first) { event.preventDefault(); panel.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", handleKey, true); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [active, selector]);
}
