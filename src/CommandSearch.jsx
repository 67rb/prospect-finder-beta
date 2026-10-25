import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Building2, ChevronRight, CornerDownLeft, Search, Sparkles, Users, X } from "lucide-react";
import { searchWorkspace } from "./workspaceExperience.js";
import { useDialogFocus } from "./useWorkspaceUX.js";

export function CommandSearch({ query, onQueryChange, snapshot, people, pages, onNavigate, onRecord, onAskLuna, onClose }) {
  const [active, setActive] = useState(0);
  const list = useRef(null);
  const records = searchWorkspace(snapshot, people, query);
  const links = pages.filter(page => page.toLowerCase().includes(query.trim().toLowerCase()));
  const options = [...records.map(item => ({ ...item, type: "record" })), ...links.map(title => ({ title, type: "page" })), ...(query.trim() ? [{ type: "luna", title: `Ask Luna: ${query.trim()}` }] : [])];
  useDialogFocus(true, ".command-dialog", onClose);
  useEffect(() => setActive(0), [query]);
  useEffect(() => { list.current?.querySelector(`[data-index='${active}']`)?.scrollIntoView({ block: "nearest" }); }, [active]);
  const choose = item => { if (!item) return; if (item.type === "record") onRecord(item); else if (item.type === "luna") onAskLuna(query.trim()); else onNavigate(item.title); };
  const keys = event => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActive(value => (value + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length); }
    if (event.key === "Enter") { event.preventDefault(); choose(options[active]); }
  };
  return <div className="modal-backdrop" onClick={onClose}><section className="command-dialog" role="dialog" aria-modal="true" aria-label="Search workspace" onClick={event => event.stopPropagation()}>
    <div className="command-input"><Search size={18}/><input autoFocus role="combobox" aria-label="Search workspace" aria-expanded="true" aria-controls="workspace-search-results" aria-activedescendant={options[active] ? `workspace-search-option-${active}` : undefined} value={query} onChange={event => onQueryChange(event.target.value)} onKeyDown={keys} placeholder="Search contacts, companies, deals, or ask Luna…"/><button className="icon-button" onClick={onClose} aria-label="Close search"><X size={17}/></button></div>
    <div className="command-results" ref={list} role="listbox" id="workspace-search-results" aria-label="Search results">{options.map((item, index) => <div key={`${item.type}-${item.collection || ""}-${item.key || item.title}`}>
      {(index === 0 || item.type !== options[index - 1].type) && <small className="command-group-label">{item.type === "record" ? "Workspace records · saved and sample data" : item.type === "page" ? query ? "Pages" : "Jump to a page" : "AI Assistant"}</small>}
      <button type="button" role="option" id={`workspace-search-option-${index}`} data-index={index} aria-selected={active === index} className={`command-result ${active === index ? "active" : ""}`} onMouseMove={() => setActive(index)} onClick={() => choose(item)} tabIndex={-1}>
        <span className="command-result-icon">{item.type === "luna" ? <Sparkles size={17}/> : item.collection === "contacts" ? <Users size={17}/> : item.collection === "companies" ? <Building2 size={17}/> : <ArrowUpRight size={17}/>}</span><span className="command-result-copy"><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}</span>{item.label && <span className="command-result-type">{item.label}</span>}<ChevronRight size={14}/>
      </button></div>)}</div><footer className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><CornerDownLeft size={12}/> open</span><span><kbd>Esc</kbd> close</span>{query && <small role="status">{records.length} record{records.length === 1 ? "" : "s"} found</small>}</footer>
  </section></div>;
}
