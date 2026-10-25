import { useState } from "react";
import { ArrowUpRight, Building2, Search, Users, X } from "lucide-react";
import { listMemberRecords } from "./listWorkflows.js";

export function WorkspaceListMembers({ list, contacts, companies, onOpen, onRemove, title = "Members", emptyMessage }) {
  const [query, setQuery] = useState("");
  const members = listMemberRecords(list, contacts, companies);
  const isCompany = list.type === "Companies";
  const visible = members.filter(({ name, record }) => [name, record?.company, record?.title, record?.role, record?.industry].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const memberLabel = isCompany ? members.length === 1 ? "company" : "companies" : members.length === 1 ? "contact" : "contacts";
  return <section className="wm-member-panel" aria-label={title}><header><h3>{title}</h3><span>{members.length} {memberLabel}</span></header>
    {members.length > 3 && <label className="wm-member-search"><Search size={14}/><input aria-label={`Search ${title.toLowerCase()}`} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search members…"/></label>}
    <div className="wm-member-rows">{visible.map(({ name, record }) => <div className="wm-member-row" key={name}><button type="button" className="wm-member-open" disabled={!record} onClick={() => onOpen(record, isCompany ? "Companies" : "Data enrichment")}><span className="wm-member-icon">{isCompany ? <Building2 size={16}/> : <Users size={16}/>}</span><span><strong>{name}</strong><small>{record ? isCompany ? record.industry || record.domain || "Company record" : [record.title || record.role, record.company].filter(Boolean).join(" · ") : "Record unavailable in this workspace"}</small></span>{record && <ArrowUpRight size={13}/>}</button>{onRemove && <button type="button" className="wm-member-remove" onClick={() => onRemove(list, name)} aria-label={`Remove ${name} from ${list.name}`} title={`Remove ${name}`}><X size={14}/></button>}</div>)}</div>
    {!members.length && <p className="wm-member-empty">{emptyMessage || <>No {isCompany ? "companies" : "contacts"} added yet. Select records in {isCompany ? "Companies" : "People"} and add them to this list.</>}</p>}
    {members.length > 0 && !visible.length && <p className="wm-member-empty">No members match this search.</p>}
  </section>;
}
