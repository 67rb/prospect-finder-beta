import { ArrowUpRight, Building2, CalendarDays, Check, ClipboardList, Mail, Phone, Users } from "lucide-react";
import { isPlaceholderDomain, isPlaceholderEmail } from "./demoData.js";
import { contactPhoneHref, normalizeLinkedInUrl } from "./contactUtils.js";

const hiddenFields = new Set(["id", "name", "summary", "body", "note", "notes", "preview", "aiResearch", "aiResearchUpdatedAt", "initials", "color", "source", "past", "done", "enrichmentAttempted", "canEnrich", "unread", "apolloOrganizationId", "personId", "draft", "searchMatch", "enrichedAt", "localUpdatedAt", "recipientNeedsReview", "recipientReviewReason"]);
const labels = { role: "Job title", title: "Title", email: "Email address", phone: "Phone", to: "To", recipient: "Contact", from: "From", time: "Updated", folder: "Folder", people: "Contacts", employees: "Employees", person: "Contact", company: "Company", amount: "Deal value", close: "Expected close", domain: "Website", linkedinUrl: "LinkedIn", associatedDeal: "Associated deal", annualRevenue: "Annual revenue", totalFunding: "Total funding", dueDate: "Due date", assignedTo: "Assigned to", taskStatus: "Task status", enrichedAt: "Enriched", aiResearchUpdatedAt: "AI research updated" };
const sourceLabel = record => record.source === "sample" ? "Sample data"
  : record.source === "apollo" || record.apolloOrganizationId ? "Apollo"
    : record.source === "csv-import" ? "CSV import"
      : record.source === "local" ? "Created locally" : "Workspace record";
const sourceTone = record => record.source === "sample" ? "gold"
  : record.source === "apollo" || record.apolloOrganizationId ? "green"
    : record.source === "csv-import" ? "blue" : "";
const validEmailAddress = value => /^[^\s@]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(String(value || "").trim());
function contactChannelDetails(record) {
  const email = String(record.email || "").trim();
  const phone = String(record.phone || "").trim();
  const linkedin = String(record.linkedinUrl || "").trim();
  const emailState = isPlaceholderEmail(email) ? "Sample address · not deliverable"
    : !email ? "Not on file"
      : !validEmailAddress(email) ? "Check address format"
        : ["Verified", "Email available"].includes(record.status) ? `Status · ${record.status}` : "On file · status not verified";
  const phoneState = !phone ? "Not on file" : contactPhoneHref(phone) ? "Number on file" : "Check number format";
  const linkedinState = !linkedin ? "Not on file" : normalizeLinkedInUrl(linkedin) ? "Profile link on file" : "Check profile URL";
  return [
    { label: "Email", value: emailState, icon: Mail, tone: isPlaceholderEmail(email) || Boolean(email && (!validEmailAddress(email) || !["Verified", "Email available"].includes(record.status))) ? "attention" : email ? "present" : "missing" },
    { label: "Phone", value: phoneState, icon: Phone, tone: !phone ? "missing" : contactPhoneHref(phone) ? "present" : "attention" },
    { label: "LinkedIn", value: linkedinState, icon: Users, tone: !linkedin ? "missing" : normalizeLinkedInUrl(linkedin) ? "present" : "attention" },
  ];
}
const money = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
function formatValue(key, value) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "amount") return money(value);
  if (typeof value === "number") return value.toLocaleString();
  if (/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(String(value))) {
    const date = new Date(String(value).includes("T") ? value : `${value}T12:00:00`);
    if (Number.isFinite(date.getTime())) return date.toLocaleString(undefined, String(value).includes("T") ? { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric" });
  }
  return String(value);
}
function valueLink(key, value) {
  if (key === "email" && /^[^\s@]+@[^\s@]+$/.test(value)) return isPlaceholderEmail(value) ? null : `mailto:${value}`;
  if (key === "phone") return contactPhoneHref(value) || null;
  if (key === "linkedinUrl") return normalizeLinkedInUrl(value) || null;
  if (["website", "domain"].includes(key)) {
    try { const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); if (["http:", "https:"].includes(url.protocol) && !isPlaceholderDomain(url.hostname)) return url.href; } catch { /* Show unlinked text. */ }
  }
  return null;
}

export function WorkspaceRecordDetails({ record, data, contacts, onOpen }) {
  const isContact = Boolean(record.name && record.company && (record.title || record.role || record.email || record.phone || record.linkedinUrl));
  const isCompany = Boolean(record.name && record.domain && !record.company);
  const recipientContact = contacts.find(person => person.name === record.recipient || (record.to && person.email?.toLowerCase() === String(record.to).toLowerCase()));
  const accountName = isCompany ? record.name : record.company || recipientContact?.company || contacts.find(person => person.name === record.person || person.name === record.from)?.company;
  const emailContact = record.folder === "Drafts" ? record.recipient || recipientContact?.name : record.from;
  const contactNames = new Set(isCompany ? contacts.filter(person => person.company === accountName).map(person => person.name) : [isContact ? record.name : record.person || emailContact].filter(Boolean));
  const statusText = typeof record.done === "boolean" ? record.done ? "Completed" : "Open task" : record.stage || record.status;
  const related = [
    ...(!isCompany && accountName ? data.companies.filter(company => company.name === accountName).map(item => ({ item, module: "Companies", icon: Building2, title: item.name, detail: "Company" })) : []),
    ...(isCompany ? contacts.filter(person => contactNames.has(person.name)).map(item => ({ item, module: "Data enrichment", icon: Users, title: item.name, detail: item.title || item.role || "Contact" })) : []),
    ...data.tasks.filter(task => contactNames.has(task.person) && !task.done && task.title !== record.title).map(item => ({ item, module: "Tasks", icon: ClipboardList, title: item.title, detail: `Open task · ${item.due || "No due date"}` })),
    ...data.meetings.filter(meeting => contactNames.has(meeting.person) && !meeting.past && meeting.title !== record.title).map(item => ({ item, module: "Meetings", icon: CalendarDays, title: item.title, detail: item.time })),
    ...data.emails.filter(email => (contactNames.has(email.from) || contactNames.has(email.recipient)) && email.subject !== record.subject).map(item => ({ item, module: "Emails", icon: Mail, title: item.subject, detail: `${item.from || `Draft for ${item.recipient || item.to || "recipient not set"}`} · ${item.folder || "Inbox"}` })),
  ].slice(0, 7);
  const fields = Object.entries(record).filter(([key, value]) => !key.startsWith("_") && !hiddenFields.has(key) && value !== "" && value != null && typeof value !== "object" && !(key === "title" && !isContact) && !(isContact && key === "title" && record.role && String(record.title).trim().toLowerCase() === String(record.role).trim().toLowerCase()) && !(key === "subject" && record.subject) && !(key === "closeDate" && record.close));
  return <>
    <div className="wm-record-status">{statusText && <span className="wm-pill">{typeof record.done === "boolean" && record.done ? <><Check size={12}/> {statusText}</> : statusText}</span>}<span className={`wm-pill ${sourceTone(record)}`}>{sourceLabel(record)}</span></div>
    {isContact && <section className="wm-contact-channel-coverage" aria-label="Contact channel information"><header><strong>Contact channels</strong><small>Saved fields, not a delivery or profile check</small></header><div>{contactChannelDetails(record).map(({ label, value, icon: Icon, tone }) => <article key={label}><span><Icon size={13}/>{label}</span><small className={tone}>{value}</small></article>)}</div><p>Email status is shown as saved; phone reachability and LinkedIn profile ownership are not verified.</p></section>}
    <div className="wm-record-fields">{fields.map(([key, value]) => { const text = String(value); const href = valueLink(key, text); const placeholder = key === "email" ? isPlaceholderEmail(text) : ["website", "domain"].includes(key) && isPlaceholderDomain(text); const external = href?.startsWith("http"); const linkText = key === "linkedinUrl" ? "Open profile" : formatValue(key, value); return <div className="wm-record-field" key={key}><small>{labels[key] || key.replace(/[A-Z]/g, " $&")}</small>{href ? <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{linkText}{external && <ArrowUpRight size={12}/>}</a> : <><strong>{formatValue(key, value)}</strong>{placeholder && <small className="wm-placeholder-note">{key === "email" ? "Sample address · not deliverable" : "Sample domain · not live"}</small>}</>}</div>; })}</div>
    {[['Enriched', record.enrichedAt], ['AI research updated', record.aiResearchUpdatedAt], ['Edited locally', record.localUpdatedAt]].filter(([, value]) => value).length > 0 && <div className="wm-record-freshness">{[['Enriched', record.enrichedAt], ['AI research updated', record.aiResearchUpdatedAt], ['Edited locally', record.localUpdatedAt]].filter(([, value]) => value).map(([label, value]) => <span key={label}>{label} · {formatValue("updatedAt", value)}</span>)}</div>}
    {[["Message", record.body || record.preview], ["Summary", record.summary], ["Notes", record.note || record.notes], ["AI research", record.aiResearch]].filter(([, text]) => text).map(([label, text]) => <div className="wm-detail-summary" key={label}><small>{label}</small><p>{text}</p></div>)}
    {related.length > 0 && <div className="wm-related-records"><h3>Related activity</h3>{related.map(({ item, module, icon: Icon, title, detail }, index) => <button type="button" key={`${module}-${title}-${index}`} onClick={() => onOpen(item, module)}><Icon size={15}/><span><strong>{title}</strong><small>{detail}</small></span><ArrowUpRight size={13}/></button>)}</div>}
  </>;
}
