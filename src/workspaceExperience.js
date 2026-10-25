export const workspaceCollections = [
  { collection: "contacts", module: "Data enrichment", label: "Contact", fields: ["name", "title", "role", "company", "email", "location"] },
  { collection: "companies", module: "Companies", label: "Company", fields: ["name", "domain", "industry", "location"] },
  { collection: "lists", module: "Lists", label: "List", fields: ["name", "description", "type"] },
  { collection: "sequences", module: "Sequences", label: "Sequence", fields: ["name", "status", "owner"] },
  { collection: "tasks", module: "Tasks", label: "Task", fields: ["title", "person", "type", "notes"] },
  { collection: "emails", module: "Emails", label: "Email", fields: ["subject", "from", "preview", "body"] },
  { collection: "calls", module: "Calls", label: "Call", fields: ["person", "company", "note", "outcome"] },
  { collection: "meetings", module: "Meetings", label: "Meeting", fields: ["title", "person", "time"] },
  { collection: "recordings", module: "Conversations", label: "Conversation", fields: ["title", "person", "summary"] },
  { collection: "deals", module: "Deals", label: "Deal", fields: ["name", "company", "stage", "owner"] },
  { collection: "workflows", module: "Workflows", label: "Workflow", fields: ["name", "trigger", "status"] },
];

export function readWorkspaceSnapshot() {
  try { return JSON.parse(localStorage.getItem("apollo-workspace-state") || "{}") || {}; }
  catch { return {}; }
}

export function workspaceRecordKey(record) {
  return String(record.id || [record.name || record.title || record.subject || record.person || "", record.person || "", record.time || record.date || ""].join("|"));
}

export function workspaceContacts(snapshot, fallback = []) {
  return [...new Map([...(snapshot.people || fallback), ...(snapshot.savedPeople || [])].filter(person => person && typeof person.name === "string").map(person => [person.name.toLowerCase(), person])).values()];
}

export function searchWorkspace(snapshot, fallbackPeople, query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const results = [];
  for (const config of workspaceCollections) {
    const records = config.collection === "contacts" ? workspaceContacts(snapshot, fallbackPeople) : snapshot[config.collection] || [];
    if (!Array.isArray(records)) continue;
    for (const record of records) {
      if (!record || typeof record !== "object") continue;
      const text = config.fields.map(field => String(record[field] || "")).join(" ").toLowerCase();
      if (!terms.every(term => text.includes(term))) continue;
      const title = record.name || record.title || record.subject || record.person || config.label;
      const detail = [record.company || record.person || record.from || record.domain || record.description, record.status || record.stage || record.due || record.time].filter(Boolean).join(" · ");
      const score = title.toLowerCase() === query.trim().toLowerCase() ? 100 : terms.reduce((sum, term) => sum + (title.toLowerCase().startsWith(term) ? 15 : title.toLowerCase().includes(term) ? 8 : 1), 0);
      results.push({ ...config, key: workspaceRecordKey(record), title, detail, record, score });
    }
  }
  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 16);
}

export function defaultWorkspaceView(module) {
  return { query: "", tab: module === "Companies" ? "All companies" : module === "Data enrichment" ? "All records" : module === "Emails" ? "All mail" : module === "Meetings" ? "Upcoming" : module === "Conversations" ? "Recordings" : "All", filterValue: "All records", sortOrder: "Recently updated" };
}

export function workspaceSelectionKey(record, module) {
  return ["Calls", "Meetings", "Conversations"].includes(module) ? workspaceRecordKey(record) : String(record.name || record.title || record.person || record.subject || record.id || "");
}

export function recordsInWorkspaceTab(records, module, tab, today) {
  return records.filter(record => {
    if (module === "Companies") return tab === "Target accounts" ? record.status === "Target" : tab === "In progress" ? record.status === "Working" : true;
    if (module === "Emails") return tab === "All mail" || (record.folder || "Inbox") === tab;
    if (module === "Meetings") return tab === "Past" ? record.past : tab === "Upcoming" ? !record.past : true;
    if (module === "Data enrichment") return tab === "Verified" ? record.status === "Verified" : tab === "Needs attention" ? record.status !== "Verified" : true;
    if (module !== "Tasks" || tab === "All") return true;
    if (tab === "Completed") return record.done;
    if (record.done) return false;
    const dueDate = record.dueDate || (record.due === "Today" ? today : null);
    if (tab === "Due today") return dueDate === today;
    if (tab === "Overdue") return Boolean(dueDate && dueDate < today);
    return dueDate ? dueDate > today : record.due !== "Today";
  });
}
