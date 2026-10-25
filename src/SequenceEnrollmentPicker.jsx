import { useState } from "react";
import { Check, Search, Sparkles, Users, X } from "lucide-react";
import { sequenceChannelGaps, sequenceChannels, sequenceContactChannels, uniqueListMembers } from "./listWorkflows.js";
import { useDialogFocus } from "./useWorkspaceUX.js";

export function SequenceEnrollmentPicker({ sequences, contacts, savedPeople, lists, sequenceName, sourceListName, preselectedNames = [], onClose, onReview }) {
  const [target, setTarget] = useState(sequenceName || sequences.find(item => item.status === "Active")?.name || sequences[0]?.name || "");
  const [source, setSource] = useState(sourceListName ? `list:${sourceListName}` : preselectedNames.length ? "all" : savedPeople.length ? "saved" : "all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(preselectedNames);
  useDialogFocus(true, ".wm-enrollment-modal", onClose);
  const sequence = sequences.find(item => item.name === target);
  const requiredChannels = sequenceChannels(sequence);
  const selectedList = source.startsWith("list:") ? lists.find(list => list.type === "People" && list.name === source.slice(5)) : null;
  const memberNames = source === "saved" ? new Set(savedPeople.map(person => person.name.toLowerCase())) : selectedList ? new Set(uniqueListMembers(selectedList).map(name => name.toLowerCase())) : null;
  const candidates = contacts.filter(person => (!memberNames || memberNames.has(person.name.toLowerCase())) && (!source.startsWith("list:") || selectedList));
  const enrolled = new Set((sequence?.enrolledPeople || []).map(name => name.toLowerCase()));
  const eligible = candidates.filter(person => !enrolled.has(person.name.toLowerCase()));
  const picked = eligible.filter(person => selected.includes(person.name));
  const fullyCoveredCount = eligible.filter(person => sequenceContactChannels(sequence, person).every(item => item.onFile)).length;
  const selectedWithGaps = picked.filter(person => sequenceChannelGaps(sequence, person).length);
  const visible = candidates.filter(person => [person.name, person.company, person.title, person.role].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const visibleEligible = visible.filter(person => !enrolled.has(person.name.toLowerCase()));
  const allVisible = visibleEligible.length > 0 && visibleEligible.every(person => selected.includes(person.name));
  const changeSource = value => { setSource(value); setSelected([]); };
  return <div className="wm-modal-backdrop wm-enrollment-backdrop" onClick={onClose}><form className="wm-modal wm-enrollment-modal" role="dialog" aria-modal="true" aria-labelledby="enrollment-title" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); if (sequence && picked.length) onReview(sequence, picked, selectedList?.name || ""); }}>
    <header><div><h2 id="enrollment-title">Choose prospects to enroll</h2><p>Review the exact selection with Luna.</p></div><button type="button" onClick={onClose} aria-label="Close enrollment picker"><X size={17}/></button></header>
    <div className="wm-form-row"><label>Sequence<select aria-label="Enrollment sequence" value={target} onChange={event => { setTarget(event.target.value); setSelected([]); }}>{sequences.map(item => <option key={item.name} value={item.name}>{item.name} · {item.status}</option>)}</select></label><label>Contact source<select aria-label="Contact source" value={source} onChange={event => changeSource(event.target.value)}><option value="all">All workspace contacts</option><option value="saved">Saved people</option>{lists.filter(list => list.type === "People").map(list => <option key={list.name} value={`list:${list.name}`}>{list.name}</option>)}</select></label></div>
    <section className="wm-enrollment-readiness" aria-label="Sequence channel readiness">
      <div><strong>Sequence channels</strong><span>{requiredChannels.length ? requiredChannels.join(" · ") : "No Email, Call, or LinkedIn steps"}</span></div>
      <div><strong>Contact fields on file</strong><span>{requiredChannels.length ? `${fullyCoveredCount} of ${eligible.length} eligible contacts have every channel field` : "No contact channel fields required"}</span></div>
      <small>Field presence and format only; email delivery, phone reachability, and LinkedIn profiles are not verified.</small>
    </section>
    <label className="wm-member-search"><Search size={15}/><input aria-label="Search enrollment contacts" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name, role, or company…"/></label>
    <div className="wm-enrollment-selection"><label><input type="checkbox" aria-label="Select all shown eligible contacts" checked={allVisible} disabled={!visibleEligible.length} ref={element => { if (element) element.indeterminate = !allVisible && visibleEligible.some(person => selected.includes(person.name)); }} onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, ...visibleEligible.map(person => person.name)])] : current.filter(name => !visibleEligible.some(person => person.name === name)))}/>Select all shown</label><span role="status">{picked.length} selected</span></div>
    <div className="wm-enrollment-contacts">{visible.map(person => { const alreadyEnrolled = enrolled.has(person.name.toLowerCase()); const channelFields = sequenceContactChannels(sequence, person); return <label className={`wm-enrollment-person ${alreadyEnrolled ? "enrolled" : ""}`} key={person.name}><input type="checkbox" aria-label={`Enroll ${person.name}`} checked={alreadyEnrolled || selected.includes(person.name)} disabled={alreadyEnrolled} onChange={event => setSelected(current => event.target.checked ? [...current, person.name] : current.filter(name => name !== person.name))}/><span className="wm-member-icon"><Users size={15}/></span><span><strong>{person.name}</strong><small>{[person.title || person.role, person.company].filter(Boolean).join(" · ")}</small>{channelFields.length > 0 && <span className="wm-enrollment-channel-fields" aria-label={channelFields.map(item => `${item.channel} ${item.onFile ? "on file" : "missing"}`).join(", ")}>{channelFields.map(item => <small className={item.onFile ? "on-file" : "missing"} key={item.channel}>{item.channel} · {item.onFile ? "on file" : "missing"}</small>)}</span>}</span>{alreadyEnrolled && <small><Check size={12}/>Already enrolled</small>}</label>; })}{!visible.length && <p className="wm-member-empty">{candidates.length ? "No contacts match this search." : "No contacts in this source. Choose another source or save people first."}</p>}</div>
    {picked.length > 0 && <div className="wm-enrollment-picked"><small>Contacts included in the review</small><p>{picked.map(person => person.name).join(", ")}</p>{selectedWithGaps.length > 0 && <span role="status">{selectedWithGaps.length} selected {selectedWithGaps.length === 1 ? "contact is" : "contacts are"} missing at least one channel field. You can still enroll in this local plan.</span>}</div>}
    <small className="wm-modal-hint">After Luna’s review, applying this updates only the local sequence plan. No outreach is sent; contact fields on file are not verified.</small>
    <footer><button type="button" className="wm-outline" onClick={onClose}>Cancel</button><button type="submit" className="wm-primary" disabled={!sequence || !picked.length}><Sparkles size={14}/>Review {picked.length || ""} with Luna</button></footer>
  </form></div>;
}
