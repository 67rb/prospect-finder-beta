import { useEffect, useRef, useState } from "react";
import { applyWorkflowEvent } from "./workflowEvents.js";
import { defaultWorkspaceView, recordsInWorkspaceTab, workspaceContacts, workspaceRecordKey, workspaceSelectionKey } from "./workspaceExperience.js";
import { useDialogFocus, useWorkspaceView } from "./useWorkspaceUX.js";
import { WorkspaceRecordDetails } from "./WorkspaceRecordDetails.jsx";
import { WorkspaceListMembers } from "./WorkspaceListMembers.jsx";
import { SequenceEnrollmentPicker } from "./SequenceEnrollmentPicker.jsx";
import { enrollmentPrompt, normalizeLocalLists, resolveEnrollmentScope, sequenceChannelGaps, sequenceChannels, uniqueListMembers } from "./listWorkflows.js";
import { demoWorkspaceLists, demoWorkspacePeople, isPlaceholderEmail } from "./demoData.js";
import { contactPhoneHref, normalizeLinkedInUrl } from "./contactUtils.js";
export { applyWorkflowEvent } from "./workflowEvents.js";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Building2, CalendarDays,
  Check, ChevronDown, ChevronRight, CircleHelp, Clock3, ContactRound,
  Database, Download, Filter, Mail, MoreHorizontal, Phone, Plus, Search, Send,
  Mic, MicOff, Pencil, Sparkles, Target, Users, Workflow, X, Zap,
} from "lucide-react";

const people = demoWorkspacePeople;
const usableContactRole = person => {
  const value = String(person?.title || person?.role || "").trim();
  return value && value !== "Title unavailable" ? value : "";
};
const usableContactCompany = person => {
  const value = String(person?.company || "").trim();
  return value && value !== "Company unavailable" ? value : "";
};
const contactReference = person => {
  const role = usableContactRole(person);
  const company = usableContactCompany(person);
  return [person.name, role ? `${role}${company ? ` at ${company}` : ""}` : company].filter(Boolean).join(" · ");
};

const companies = [
  { name: "Northstar Labs", domain: "northstarlabs.example", industry: "Software", employees: "180", location: "San Francisco, CA", people: 2, status: "Target", source: "sample" },
  { name: "Brightline", domain: "brightline.example", industry: "Analytics", employees: "42", location: "New York, NY", people: 1, status: "Working", source: "sample" },
  { name: "Pioneer Cloud", domain: "pioneercloud.example", industry: "Marketing Tech", employees: "280", location: "Austin, TX", people: 1, status: "Target", source: "sample" },
  { name: "Atlas Systems", domain: "atlassystems.example", industry: "Business Software", employees: "680", location: "Portland, OR", people: 1, status: "Working", source: "sample" },
  { name: "Meridian Health", domain: "meridianhealth.example", industry: "Healthcare", employees: "95", location: "Denver, CO", people: 0, status: "New", source: "sample" },
];

const companySourceLabel = company => company.source === "sample" ? "Sample data"
  : company.source === "apollo" || company.apolloOrganizationId ? "Apollo"
    : company.source === "csv-import" ? "CSV import" : "Created locally";
const listSourceLabel = list => list.source === "sample" ? "Sample data"
  : list.source === "apollo" ? "Apollo"
    : list.source === "csv-import" ? "CSV import" : "Created locally";
const listSourceTone = list => list.source === "sample" ? "gold"
  : list.source === "apollo" ? "green"
    : list.source === "csv-import" ? "blue" : "";

const seed = {
  companies,
  lists: demoWorkspaceLists,
  sequences: [
    { name: "SaaS outbound · 8 touches", status: "Active", people: 42, replies: 8, steps: 8, owner: "Robert Berry", source: "sample", stepPlan: [{ channel: "Email", delay: "Immediately", instruction: "Personalized introduction" }, { channel: "Call", delay: "Wait 2 days", instruction: "Call the prospect" }, { channel: "Email", delay: "Wait 3 days", instruction: "Share a useful case study" }], enrolledPeople: [] },
    { name: "Warm inbound follow-up", status: "Active", people: 17, replies: 5, steps: 5, owner: "Robert Berry", source: "sample", stepPlan: [{ channel: "Email", delay: "Immediately", instruction: "Respond to the inbound request" }, { channel: "Call", delay: "Wait 1 day", instruction: "Call to qualify interest" }], enrolledPeople: [] },
    { name: "Q4 re-engagement", status: "Paused", people: 63, replies: 9, steps: 6, owner: "Alex Morgan", source: "sample", stepPlan: [{ channel: "Email", delay: "Immediately", instruction: "Restart the conversation" }, { channel: "Email", delay: "Wait 4 days", instruction: "Share a new insight" }], enrolledPeople: [] },
  ],
  workflows: [
    { name: "New prospect assignment", trigger: "Contact added to list", status: "Active", runs: 128, action: "Create follow-up task", taskTitle: "Follow up with {{contact}} from {{list}}", due: "Today", source: "sample" },
    { name: "Inbound lead follow-up", trigger: "Task completed", status: "Active", runs: 46, action: "Create follow-up task", taskTitle: "Check in with {{contact}} after task completion", due: "Tomorrow", source: "sample" },
  ],
  savedPeople: [],
  tasks: [
    { title: "Follow up with Maya Patel", person: "Maya Patel", due: "Today", type: "Email", assignedTo: "Robert Berry", done: false, source: "sample" },
    { title: "Prepare Brightline account brief", person: "Jordan Lee", due: "Today", type: "Research", assignedTo: "Robert Berry", done: false, source: "sample" },
    { title: "Call Sofia Martinez", person: "Sofia Martinez", due: "Tomorrow", type: "Call", assignedTo: "Alex Morgan", done: false, source: "sample" },
    { title: "Review Atlas Systems activity", person: "Ethan Chen", due: "Oct 24", type: "Research", assignedTo: "Alex Morgan", done: true, source: "sample" },
  ],
  deals: [
    { name: "Northstar Labs · Growth plan", company: "Northstar Labs", amount: 48000, stage: "Discovery", close: "Nov 14", owner: "Robert Berry", source: "sample" },
    { name: "Brightline · Enterprise", company: "Brightline", amount: 72000, stage: "Proposal", close: "Nov 08", owner: "Robert Berry", source: "sample" },
    { name: "Pioneer Cloud · Platform", company: "Pioneer Cloud", amount: 36000, stage: "Qualification", close: "Nov 28", owner: "Alex Morgan", source: "sample" },
    { name: "Atlas Systems · Expansion", company: "Atlas Systems", amount: 54000, stage: "Negotiation", close: "Nov 02", owner: "Robert Berry", source: "sample" },
  ],
  meetings: [
    { title: "Discovery · Northstar Labs", person: "Maya Patel", time: "Today · 2:30 PM", duration: "30 min", type: "Video call", source: "sample" },
    { title: "Product walkthrough · Brightline", person: "Jordan Lee", time: "Tomorrow · 10:00 AM", duration: "45 min", type: "Video call", source: "sample" },
    { title: "Quarterly review · Atlas Systems", person: "Ethan Chen", time: "Oct 24 · 1:00 PM", duration: "30 min", type: "Video call", source: "sample" },
    { title: "Introduction · Pioneer Cloud", person: "Sofia Martinez", time: "Oct 16 · 11:00 AM", duration: "25 min", type: "Video call", past: true, source: "sample" },
  ],
  emails: [
    { from: "Maya Patel", subject: "Re: Improving outbound at Northstar", preview: "Thursday afternoon works for me. I’ll bring our sales ops lead too.", time: "10:42 AM", unread: true, folder: "Inbox", source: "sample" },
    { from: "Jordan Lee", subject: "Brightline platform overview", preview: "Thanks for sending this over. Could you share how onboarding works?", time: "Yesterday", unread: true, folder: "Inbox", source: "sample" },
    { from: "Sofia Martinez", subject: "Re: Demand generation plans", preview: "We are reviewing options for next quarter and would like to reconnect.", time: "Yesterday", unread: false, folder: "Inbox", source: "sample" },
    { from: "Ethan Chen", subject: "Intro from Alex", preview: "Alex suggested we speak about our growth operations this month.", time: "Oct 18", unread: false, folder: "Inbox", source: "sample" },
    { from: "Robert Berry", subject: "Northstar follow-up", preview: "Sent: a short recap and suggested times for next week.", time: "Oct 20", unread: false, folder: "Sent", source: "sample" },
    { from: "Robert Berry", subject: "Brightline onboarding options", preview: "Draft saved locally. Add a note before sending.", time: "Just now", unread: false, folder: "Drafts", source: "sample" },
  ],
  calls: [
    { person: "Sofia Martinez", company: "Pioneer Cloud", time: "Today · 9:18 AM", duration: "12:36", outcome: "Connected", note: "Evaluating demand generation tools for next quarter.", source: "sample" },
    { person: "Ethan Chen", company: "Atlas Systems", time: "Yesterday · 3:42 PM", duration: "08:14", outcome: "Connected", note: "Asked for a technical overview and security details.", source: "sample" },
    { person: "Jordan Lee", company: "Brightline", time: "Oct 18 · 11:05 AM", duration: "—", outcome: "No answer", note: "Left a short voicemail.", source: "sample" },
  ],
  recordings: [
    { title: "Northstar Labs · Discovery call", person: "Maya Patel", date: "Today · 2:30 PM", duration: "28:14", sentiment: "Positive", summary: "Strong interest in improving team prospecting. Follow up with a tailored workflow.", source: "sample" },
    { title: "Atlas Systems · Growth operations", person: "Ethan Chen", date: "Yesterday · 3:42 PM", duration: "08:14", sentiment: "Neutral", summary: "Needs technical and security information before scheduling a deeper review.", source: "sample" },
    { title: "Pioneer Cloud · Qualification", person: "Sofia Martinez", date: "Oct 18 · 11:05 AM", duration: "19:32", sentiment: "Positive", summary: "Planning to review solutions with marketing leadership next week.", source: "sample" },
  ],
  assistantContext: { companyProduct: "", idealCustomerProfile: "", valueProposition: "", writingStyle: "", claimsToAvoid: "" },
  assistantMemory: { writingStyle: "", territory: "", targetAudience: "", customInstructions: "" },
  assistantAgents: [
    { name: "Lead discovery", type: "lead-discovery", description: "Find and score prospects against your ideal customer profile.", enabled: false, frequency: "Weekly", dayOfWeek: "Monday", runTime: "09:00", creditLimit: 0 },
    { name: "Sequence creation", type: "sequence-creation", description: "Recommend an outbound sequence strategy from your product context.", enabled: false, frequency: "Weekly", dayOfWeek: "Monday", runTime: "09:00", creditLimit: 0 },
    { name: "Sequence optimization", type: "sequence-optimization", description: "Review active sequence results and suggest one change at a time.", enabled: false, frequency: "Weekly", dayOfWeek: "Monday", runTime: "09:00", creditLimit: 0 },
  ],
};
const assistantPromptSuggestions = [
  "Find sales leaders in SaaS", "Find people matching my ICP", "Find SaaS companies", "Research Maya Patel before outreach", "Research Northstar Labs and save its AI research", "Research accounts in Emerging companies before outreach", "Summarize my pipeline", "Show rep performance by owner",
  "What should I follow up on?", "Show open call tasks", "Prepare for my upcoming meetings", "Summarize Maya Patel’s discovery call", "Find recurring themes across my recent calls", "Which calls lack a clear next step?", "Create a follow-up task from Maya Patel’s call", "Associate Ethan Chen’s call with the Atlas Systems deal", "Extract Ethan Chen’s call requirements into deal field 'Buyer requirements'", "Extract Ethan Chen’s call requirements into contact field 'Buyer requirements'", "Extract Ethan Chen’s call requirements into company field 'Buyer requirements'", "Update Ethan Chen’s contact custom field 'Buyer requirements' to technical and security information", "Draft an email to Maya Patel", "Reply to Maya Patel’s email saying Thursday works for me.", "Send a one-off email to Maya Patel", "Draft a personalized cold email for contacts on Q1 SaaS", "Analyze email and sequence performance this quarter", "Check my Apollo credit usage and mailbox health", "Update my ICP to UK mid-market SaaS sales teams", "Create a 5-step phone-first sequence for SaaS sales leaders",
  "Improve my active sequence", "Create a workflow for completed tasks", "Export my Q4 SaaS targets as CSV",
  "Create a list called Q1 SaaS and save Maya Patel",
  "Create a company list called Q1 SaaS accounts and save Northstar Labs", "Export Emerging companies as a CSV",
  "Update the Northstar Labs deal stage to Proposal",
  "Create a deal for Northstar Labs called Growth plan worth $50k at Discovery stage",
  "Pause Q4 re-engagement sequence",
  "Log a connected call with Maya Patel and note the budget discussion",
  "Create a contact named Taylor Morgan at Northstar Labs with title VP of Sales and email taylor@example.com",
  "Create a company called Redwood AI with domain redwood.ai, industry AI software, 120 employees, based in Boston, MA",
];
const getAssistantProducts = context => {
  if (Array.isArray(context?.products) && context.products.length) {
    return context.products.map((product, index) => ({ ...product, id: product.id || `product-${index + 1}`, name: product.name || product.companyProduct?.split(/[.!?\n]/)[0] || `Product ${index + 1}` }));
  }
  return [{ id: context?.activeProductId || "primary-product", name: context?.name || "Primary product", ...(context || {}) }];
};
const storeAssistantProducts = (context, products, activeId) => {
  const active = products.find(product => product.id === activeId) || products[0];
  return { ...(context || {}), ...active, products, activeProductId: active.id };
};
const nextAgentRun = agent => {
  const now = new Date();
  const [hours, minutes] = String(agent.runTime || "09:00").split(":").map(Number);
  const next = new Date(now);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  const frequencies = { Daily: 1, Weekly: 7, Monthly: 30 };
  if (agent.frequency === "Weekly") {
    const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(agent.dayOfWeek || "Monday");
    next.setDate(next.getDate() + ((day - next.getDay() + 7) % 7));
  } else if (agent.frequency === "Monthly") {
    next.setDate(1);
  }
  if (next <= now) next.setDate(next.getDate() + (agent.frequency === "Monthly" ? 0 : frequencies[agent.frequency] || 7));
  if (agent.frequency === "Monthly" && next <= now) next.setMonth(next.getMonth() + 1);
  return next;
};
const findWritingStyle = value => {
  const text = String(value || "").toLowerCase();
  const matches = [...text.matchAll(/\b(formal|professional|casual|friendly|warm|consultative|concise|brief|short|direct)\b/g)];
  return matches.find(match => !/(?:not|never|avoid|don't|do not)\s+(?:be\s+)?$/.test(text.slice(Math.max(0, match.index - 18), match.index)))?.[0] || "";
};
const findClaimConflicts = (content, claimsToAvoid) => {
  const text = String(content || "").toLowerCase();
  const rulesText = String(claimsToAvoid || "").toLowerCase();
  if (!text || !rulesText.trim()) return [];
  const rules = rulesText.split(/[;,\n]+/).map(rule => rule.trim()).filter(Boolean);
  const conflicts = rules.filter(rule => text.includes(rule));
  if (/\b(?:unverified|unsupported|avoid|without|no)\b[^.;,\n]{0,48}\b(?:numbers?|statistics|metrics?|percentages?|figures?)\b/.test(rulesText)
    && /\b\d+(?:\.\d+)?\s?(?:%|percent|x|times|million|billion|k\b|m\b)\b/i.test(content)) {
    conflicts.push("numeric performance claim");
  }
  if (/\b(?:unsupported|avoid|without|no)\b[^.;,\n]{0,48}\b(?:guarantees?|promises?)\b/.test(rulesText)
    && /\b(?:guarantee(?:d|s)?|promise(?:d|s)?)\b/i.test(content)) {
    conflicts.push("guarantee or promise wording");
  }
  return [...new Set(conflicts)];
};
const scoreLocalProspectFit = (person, profile, territory, companies) => {
  const company = companies.find(item => item.name?.toLowerCase() === person.company?.toLowerCase());
  const icp = String(profile || "").toLowerCase();
  const roleGroups = [
    ["sales leadership", /\b(sales|revenue|cro|sdr|bdr|account executive|ae)\b/],
    ["founder or executive", /\b(founder|ceo|chief executive|president|owner|executive)\b/],
    ["marketing", /\b(marketing|demand gen|growth marketing)\b/],
    ["growth operations", /\b(growth|operations|revops|sales ops)\b/],
    ["people or talent", /\b(human resources|hr|talent|recruiting|recruiter|people operations)\b/],
    ["customer success", /\b(customer success|customer support|client success|account management)\b/],
    ["finance", /\b(finance|financial planning|accounting|controller|cfo)\b/],
    ["engineering or technical", /\b(engineering|engineer|developer|software development|technical|cto|it operations)\b/],
    ["product", /\b(product management|product manager|product leader|cpo)\b/],
    ["legal", /\b(legal|counsel|compliance)\b/],
    ["procurement", /\b(procurement|purchasing|sourcing|supply chain)\b/],
    ["senior decision-maker", /\b(vp|vice president|director|chief|head|manager)\b/],
  ];
  const requestedRoles = roleGroups.filter(([, pattern]) => pattern.test(icp));
  const dimensions = [];
  const reasons = [];
  if (requestedRoles.length) {
    const title = String(person.title || person.role || "").toLowerCase();
    if (title) {
      const matched = requestedRoles.filter(([, pattern]) => pattern.test(title));
      dimensions.push({ label: "Role", weight: 0.4, match: matched.length / requestedRoles.length });
      if (matched.length) reasons.push(`role fit: ${person.title || person.role}`);
    }
  }
  const industryGroups = [
    ["software", /\b(software|saas|technology|tech)\b/, /\b(software|saas|technology|tech)\b/],
    ["AI and data", /\b(ai|artificial intelligence|machine learning|data|analytics|business intelligence)\b/, /\b(ai|artificial intelligence|machine learning|data|analytics|software|technology)\b/],
    ["cybersecurity", /\b(cybersecurity|cyber security|infosec)\b/, /\b(cybersecurity|cyber security|security|software|technology)\b/],
    ["healthcare", /\b(healthcare|health care|medical|health tech)\b/, /\b(healthcare|medical|health|biotech)\b/],
    ["financial services", /\b(fintech|financial services|finance|banking)\b/, /\b(financial|fintech|bank|insurance)\b/],
    ["marketing", /\b(marketing|advertising|martech)\b/, /\b(marketing|advertising|media)\b/],
    ["manufacturing", /\b(manufacturing|industrial)\b/, /\b(manufactur|industrial)\b/],
  ];
  const requestedIndustries = industryGroups.filter(([, profilePattern]) => profilePattern.test(icp));
  if (requestedIndustries.length) {
    const industryText = String(company?.industry || "").toLowerCase();
    if (industryText) {
      const matched = requestedIndustries.filter(([, , industryPattern]) => industryPattern.test(industryText));
      dimensions.push({ label: "Industry", weight: 0.3, match: matched.length / requestedIndustries.length });
      if (matched.length) reasons.push(`industry fit: ${company.industry}`);
    }
  }
  const sizeMatch = icp.match(/\b(\d{1,6})\s*(?:-|–|to)\s*(\d{1,6})\s*(?:employees?|people|staff)\b/)
    || icp.match(/\b(?:between|from)\s+(\d{1,6})\s+(?:and|to)\s+(\d{1,6})\s*(?:employees?|people|staff)\b/);
  const sizeRange = sizeMatch ? [Number(sizeMatch[1]), Number(sizeMatch[2])] : /\b(?:enterprise|large market|global)\b/.test(icp) ? [1000, Infinity]
    : /\bmid[ -]?market\b/.test(icp) ? [50, 999] : /\b(?:startup|start-up|early stage)\b/.test(icp) ? [1, 99]
      : /\b(?:small business|small company|small team)\b/.test(icp) ? [1, 49] : null;
  if (sizeRange) {
    const [lower, upper] = sizeRange;
    const employeeCount = Number(String(company?.employees || "").replace(/[^\d]/g, ""));
    if (employeeCount) {
      const inRange = employeeCount >= lower && employeeCount <= upper;
      dimensions.push({ label: "Company size", weight: 0.15, match: inRange ? 1 : 0 });
      if (inRange) reasons.push(`company size: ${employeeCount} employees${sizeMatch ? "" : ` (${upper === Infinity ? "enterprise" : lower === 50 ? "mid-market" : upper < 100 ? "startup" : "small business"})`}`);
    }
  }
  const territoryText = String(territory || "").toLowerCase();
  const locationTerms = [...new Set(territoryText.match(/\b[a-z]{2,}\b/g) || [])].filter(term => !["based", "across", "within", "territory", "region", "employees", "employee", "the", "and"].includes(term));
  if (/\b(?:united states|u\.s\.|usa)\b/.test(territoryText) && !locationTerms.includes("us")) locationTerms.push("us");
  if (locationTerms.length) {
    const location = String(person.location || "").toLowerCase();
    if (location) {
      const locationAliases = { us: "united states", usa: "united states", uk: "united kingdom", uae: "united arab emirates" };
      const matched = locationTerms.some(term => {
        const target = locationAliases[term] || term;
        return location.includes(target)
          || (target === "united states" && /(?:,|\s)(?:ca|ny|tx|wa|il|or|co|ma)\b/i.test(location))
        || target.split(/\s+/).filter(word => word.length > 2).every(word => location.includes(word));
      });
      dimensions.push({ label: "Territory", weight: 0.15, match: matched ? 1 : 0 });
      if (matched) reasons.push(`territory fit: ${person.location}`);
    }
  }
  const expectedDimensions = Number(Boolean(requestedRoles.length)) + Number(Boolean(requestedIndustries.length)) + Number(Boolean(sizeRange)) + Number(Boolean(locationTerms.length));
  if (!dimensions.length) return { score: null, reasons: [], dimensions: [], coverage: { available: 0, expected: expectedDimensions, percent: 0 } };
  const availableWeight = dimensions.reduce((total, item) => total + item.weight, 0);
  const score = Math.round(dimensions.reduce((total, item) => total + item.weight * item.match, 0) / availableWeight * 100);
  const coverage = { available: dimensions.length, expected: expectedDimensions, percent: Math.round(dimensions.length / Math.max(1, expectedDimensions) * 100) };
  return { score, reasons, dimensions, coverage };
};
const emailDraftIssues = (emails, claimsToAvoid) => emails.flatMap((email, index) => {
  const issues = [];
  if (!String(email?.subject || "").trim()) issues.push(`Draft ${index + 1}: add a subject.`);
  if (!String(email?.body || "").trim()) issues.push(`Draft ${index + 1}: add an email body.`);
  const conflicts = findClaimConflicts(`${email?.subject || ""}\n${email?.body || ""}`, claimsToAvoid);
  if (conflicts.length) issues.push(`Draft ${index + 1}: remove restricted wording (${conflicts.join(", ")}).`);
  return issues;
});
const emailAddressReviewReason = value => {
  const email = String(value || "").trim();
  if (!email) return "missing";
  if (!/^[^\s@]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(email)) return "invalid";
  if (isPlaceholderEmail(email)) return "sample";
  return "";
};
const contactEmailReviewReason = person => emailAddressReviewReason(person?.email)
  || (["Verified", "Email available"].includes(person?.status) ? "" : "status");
const emailRecipientReviewMessage = email => {
  const reason = email?.recipientReviewReason || emailAddressReviewReason(email?.to) || (email?.recipientNeedsReview ? "review" : "");
  return reason === "missing" ? "No email address on file. Add a recipient before sending."
    : reason === "invalid" ? "This email address has an invalid format. Correct it before sending."
      : reason === "sample" ? "Sample address · not deliverable. Replace it before sending."
        : reason === "status" ? "This contact’s email is not marked available or verified. Confirm it before sending."
          : reason === "changed" ? "The contact’s email changed. Confirm this recipient before sending."
            : reason ? "Review this recipient before sending." : "";
};
const patchDraftEmail = (email, patch) => {
  const next = { ...email, ...patch };
  if (Object.prototype.hasOwnProperty.call(patch, "to")) {
    const reason = emailAddressReviewReason(next.to);
    next.recipientNeedsReview = Boolean(reason);
    next.recipientReviewReason = reason;
  }
  return next;
};
const newEmailId = () => `email-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

function onboardingStatus(data) {
  return [
    Boolean(data.savedPeople?.length),
    (data.savedPeople || []).some(person => person.phone || person.phoneNumber || person.mobileNumber),
    data.lists.some(list => !seed.lists.some(original => original.name === list.name)),
    data.companies.some(company => !seed.companies.some(original => original.name === company.name)),
    data.sequences.some(sequence => !seed.sequences.some(original => original.name === sequence.name)),
    data.sequences.some(sequence => { const original = seed.sequences.find(item => item.name === sequence.name); return original && JSON.stringify(original.stepPlan) !== JSON.stringify(sequence.stepPlan); }),
  ];
}

function loadState() {
  if (typeof window === "undefined") return { ...seed, emails: seed.emails.map(email => ({ ...email, id: newEmailId() })), lists: normalizeLocalLists(seed.lists) };
  try {
    const saved = JSON.parse(localStorage.getItem("apollo-workspace-state") || "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return { ...seed, emails: seed.emails.map(email => ({ ...email, id: newEmailId() })), lists: normalizeLocalLists(seed.lists) };
    const merged = { ...seed, ...saved };
    const sharedSavedPeople = JSON.parse(localStorage.getItem("apollo-prototype-saved-people") || "null");
    if (Array.isArray(sharedSavedPeople)) merged.savedPeople = sharedSavedPeople;
    if (!Array.isArray(merged.savedPeople)) merged.savedPeople = [];
    const recordKey = item => item.name || item.title || item.subject || (item.person && item.time ? `${item.person}|${item.time}` : item.person) || item.from || "";
    for (const [collection, defaults] of Object.entries(seed)) {
      if (!Array.isArray(defaults) || !Array.isArray(saved[collection])) continue;
      const savedByKey = new Map(saved[collection].map(item => [recordKey(item), item]));
      const defaultKeys = new Set(defaults.map(recordKey));
      merged[collection] = defaults.map(item => {
        const savedItem = savedByKey.get(recordKey(item));
        const mergedItem = { ...item, ...(savedItem || {}) };
        if (collection === "sequences" && item.source === "sample" && !savedItem?.source) {
          return { ...mergedItem, people: item.people, replies: item.replies, source: "sample" };
        }
        return mergedItem;
      });
      merged[collection].push(...saved[collection].filter(item => !defaultKeys.has(recordKey(item))));
    }
    merged.workflows = (merged.workflows || []).map(workflow => ({
      ...workflow,
      trigger: workflow.trigger === "Form submitted" ? "Task completed" : workflow.trigger,
      action: workflow.action || "Create follow-up task",
      taskTitle: workflow.taskTitle || "Follow up with {{contact}}",
      due: workflow.due || "Today",
    }));
    merged.lists = normalizeLocalLists(merged.lists);
    merged.emails = (merged.emails || []).map(email => ({ ...email, id: email.id || newEmailId() }));
    return merged;
  }
  catch { return { ...seed, emails: seed.emails.map(email => ({ ...email, id: newEmailId() })), lists: normalizeLocalLists(seed.lists) }; }
}

const fmtMoney = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const sequenceSourceLabel = sequence => sequence.source === "sample" ? "Sample data" : sequence.source === "apollo" ? "Apollo" : "Local plan";
const activitySourceLabel = record => record.source === "sample" ? "Sample data"
  : record.source === "apollo" || record.apolloOrganizationId ? "Apollo"
    : record.source === "csv-import" ? "CSV import"
      : record.source === "local" ? "Created locally" : "Workspace record";
const activitySourceTone = record => record.source === "sample" ? "gold"
  : record.source === "apollo" || record.apolloOrganizationId ? "green"
    : record.source === "csv-import" ? "blue" : "";
const emailSourceLabel = email => email.folder === "Drafts"
  ? email.source === "sample" ? "Sample draft" : "Local draft"
  : activitySourceLabel(email);
const isMeasuredWorkspaceRecord = record => ["apollo", "csv-import", "local"].includes(record.source) || Boolean(record.apolloOrganizationId);
const sequenceHasSampleMetrics = sequence => sequence.source === "sample";
const sequenceHasPerformanceMetrics = sequence => sequence.source === "sample" || sequence.source === "apollo";
const sequencePlanEnrollmentCount = sequence => sequenceHasPerformanceMetrics(sequence) ? Number(sequence.people || 0) : (sequence.enrolledPeople || []).length;
const updateSequenceEnrollment = (sequence, enrolledPeople) => sequenceHasPerformanceMetrics(sequence)
  ? { ...sequence, enrolledPeople }
  : { ...sequence, enrolledPeople, people: enrolledPeople.length };
const csvCell = value => {
  let text = String(value ?? "");
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
const closedDealStages = new Set(["Closed won", "Closed lost"]);
const stages = ["Qualification", "Discovery", "Proposal", "Negotiation", "Closed won", "Closed lost"];
const nextMeetingStart = () => {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return { date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`, time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` };
};
const defaultDealCloseDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const localDateValue = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const assistantRequestedDate = prompt => {
  const explicitDate = prompt.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (explicitDate) return explicitDate[1];
  const base = new Date();
  if (/\btomorrow\b/.test(prompt)) base.setDate(base.getDate() + 1);
  else if (/\bin\s+(\d{1,2})\s+days?\b/.test(prompt)) base.setDate(base.getDate() + Number(prompt.match(/\bin\s+(\d{1,2})\s+days?\b/)[1]));
  else if (/\bnext week\b/.test(prompt)) base.setDate(base.getDate() + 7);
  else if (/\b(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(prompt)) {
    const match = prompt.match(/\b(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    const weekday = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(match[2]);
    let days = (weekday - base.getDay() + 7) % 7;
    if (match[1] || days === 0) days += 7;
    base.setDate(base.getDate() + days);
  }
  else if (!/\btoday\b/.test(prompt)) return "";
  return localDateValue(base);
};
const assistantRequestedTime = prompt => {
  const match = prompt.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (!match) return "";
  let hour = Number(match[1]) % 12;
  if (match[3].toLowerCase() === "pm") hour += 12;
  return `${String(hour).padStart(2, "0")}:${match[2] || "00"}`;
};
const formatTaskDue = value => {
  if (!value) return "Today";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = localDateValue();
  const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  if (value === today) return "Today";
  if (value === localDateValue(tomorrowDate)) return "Tomorrow";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const starterSequenceSteps = () => [
  { channel: "Email", delay: "Immediately", instruction: "Personalized introduction" },
  { channel: "Call", delay: "Wait 2 days", instruction: "Call the prospect" },
  { channel: "Email", delay: "Wait 3 days", instruction: "Share a useful insight" },
];
function Pill({ children, tone = "" }) { return <span className={`wm-pill ${tone}`}>{children}</span>; }
function Metric({ label, value, change, icon: Icon }) { return <article className="wm-metric"><span className="wm-metric-icon"><Icon size={17} /></span><span className="wm-metric-label">{label}</span><strong>{value}</strong><small><ArrowUpRight size={13} />{change}</small></article>; }
function SectionHeading({ title, detail, action, onAction, secondaryAction, onSecondaryAction }) { return <div className="wm-section-heading"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div><span className="wm-section-actions">{secondaryAction && <button className="wm-outline" onClick={onSecondaryAction}>{secondaryAction}</button>}{action && <button className="wm-primary" onClick={onAction}><Plus size={15} />{action}</button>}</span></div>; }

function AssistantEmailDraftEditor({ emails, onChange, disabled, claimsToAvoid }) {
  const issues = disabled ? [] : emailDraftIssues(emails, claimsToAvoid);
  return <div className="wm-email-draft-editor">{emails.map((email, index) => <section key={`${email.recipient}-${index}`}><header><strong>{email.recipient}</strong><span>Local draft · not sent</span></header><label>To<input type="email" aria-label={`Email recipient for ${email.recipient}`} value={email.to || ""} placeholder="name@company.com" disabled={disabled} onChange={event => onChange(index, { to: event.target.value })} /></label>{emailRecipientReviewMessage(email) && <small className="wm-email-recipient-review" role="status">{emailRecipientReviewMessage(email)}</small>}<label>Subject<input aria-label={`Email subject for ${email.recipient}`} value={email.subject || ""} disabled={disabled} onChange={event => onChange(index, { subject: event.target.value })} /></label><label>Email body<textarea aria-label={`Email body for ${email.recipient}`} rows={5} value={email.body || ""} disabled={disabled} onChange={event => onChange(index, { body: event.target.value, preview: event.target.value.replace(/\n/g, " ").slice(0, 140) })} /></label></section>)}{issues.length > 0 && <ul className="wm-email-draft-issues" role="alert">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}</div>;
}

function AssistantSequenceDraftEditor({ sequence, onChange }) {
  const steps = sequence?.stepPlan || [];
  const updateStep = (index, patch) => onChange(steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step));
  const setChannel = (index, channel) => {
    const step = steps[index];
    const next = { ...step, channel, delay: step.delay || (index === 0 ? "Immediately" : "Wait 2 days"), instruction: step.instruction || "" };
    if (channel === "Email") Object.assign(next, { subject: step.subject || "A note for {{company}}", body: step.body || "Hi {{first_name}},\n\n[Add one specific, verified reason this is relevant to {{company}}.]\n\nBest,\n{{sender_name}}" });
    if (channel === "Call") next.callScript = step.callScript || "Opening: Hi {{first_name}}, this is {{sender_name}}. Have I caught you at a good time?\nReason: [Add a specific, verified reason for calling.]\nDiscovery: [Ask one relevant question.]\nNext step: Would a brief conversation be useful?";
    if (channel === "LinkedIn") next.linkedinMessage = step.linkedinMessage || "Hi {{first_name}}, I’m reaching out to connect with people working on {{company}}’s goals. Interested in connecting?";
    if (channel === "Task") next.instruction = "Review the account and prepare a relevant follow-up.";
    updateStep(index, next);
  };
  const contentField = step => step.channel === "Email" ? "body" : step.channel === "Call" ? "callScript" : step.channel === "LinkedIn" ? "linkedinMessage" : "instruction";
  const contentLabel = step => step.channel === "Email" ? "Email body" : step.channel === "Call" ? "Call script" : step.channel === "LinkedIn" ? "LinkedIn message" : "Task instructions";
  return <div className="wm-sequence-draft-editor">{steps.map((step, index) => <section className="wm-sequence-draft-step" key={`${index}-${step.channel}`}><header><strong>Step {index + 1}</strong><label>Channel<select aria-label={`Step ${index + 1} channel`} value={step.channel} onChange={event => setChannel(index, event.target.value)}>{["Email", "Call", "LinkedIn", "Task"].map(channel => <option key={channel}>{channel}</option>)}</select></label><label>Timing<input aria-label={`Step ${index + 1} timing`} value={step.delay || ""} onChange={event => updateStep(index, { delay: event.target.value })} /></label></header>{step.channel === "Email" && <label>Subject<input aria-label={`Step ${index + 1} subject`} value={step.subject || ""} onChange={event => updateStep(index, { subject: event.target.value, instruction: `Subject: ${event.target.value}` })} /></label>}<label>{contentLabel(step)}<textarea aria-label={`Step ${index + 1} ${contentLabel(step).toLowerCase()}`} rows={step.channel === "Email" || step.channel === "Call" ? 4 : 3} value={step[contentField(step)] || step.instruction || ""} onChange={event => updateStep(index, { [contentField(step)]: event.target.value })} /></label></section>)}</div>;
}

function AssistantSequenceOptimizationEditor({ action, onChange }) {
  const index = Number(action.stepIndex || 0);
  const current = action.previousStepPlan?.[index] || {};
  const proposed = action.stepPlan?.[index] || {};
  const update = patch => onChange(action.stepPlan.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step));
  const currentCopy = current.body?.trim() || current.instruction || "No saved email copy is available for this step in the local sample.";
  return <div className="wm-sequence-optimization-editor">
    {action.performance && <div className="wm-sequence-optimization-signal"><span>Observed reply-to-enrollment</span><strong>{action.performance.value} · {action.performance.detail}</strong></div>}
    <section className="wm-sequence-optimization-current"><strong>Current step · {current.delay || "Timing not saved"}</strong>{current.subject && <b>Subject: {current.subject}</b>}<pre>{currentCopy}</pre></section>
    <section className="wm-sequence-optimization-proposed"><strong>Proposed step · review before applying</strong><label>Subject<input aria-label="Proposed email subject" value={proposed.subject || ""} onChange={event => update({ subject: event.target.value, instruction: `Subject: ${event.target.value}` })} /></label><label>Email body<textarea aria-label="Proposed email body" rows={5} value={proposed.body || ""} onChange={event => update({ body: event.target.value })} /></label></section>
    <p>This is a copy hypothesis based on the saved product context. The sample has no per-step open, click, bounce, or interested-rate data, so it does not predict a performance lift.</p>
  </div>;
}

const workflowSteps = workflow => Array.isArray(workflow?.steps) && workflow.steps.length ? workflow.steps : [{ action: workflow?.action, targetName: workflow?.targetName, taskTitle: workflow?.taskTitle, due: workflow?.due }];

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted && character === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (!quoted && character === ",") { row.push(field); field = ""; }
    else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else field += character;
  }
  row.push(field);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

export function WorkspaceModules({ module, onNavigate, onSearchPeople, onFindCompanyPeople, onEnrichPerson, apolloConfigured = false, apolloConnectionSource = null, onApolloConnectionChange, navigationRequest, onNavigationHandled, onWorkspaceChange, onHelp, notify }) {
  const [data, setData] = useState(loadState);
  const [onboardingExpanded, setOnboardingExpanded] = useState(true);
  const { query, setQuery, tab, setTab, filterValue, setFilterValue, sortOrder, setSortOrder } = useWorkspaceView(module);
  const [settingsTab, setSettingsTab] = useState("General");
  const [apolloKeyDraft, setApolloKeyDraft] = useState("");
  const [apolloConnectionBusy, setApolloConnectionBusy] = useState(false);
  const [apolloConnectionError, setApolloConnectionError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [dialog, setDialog] = useState("");
  const [selected, setSelected] = useState(null);
  const [emailDraftEditing, setEmailDraftEditing] = useState(null);
  const [contactEditTarget, setContactEditTarget] = useState(null);
  const [enrollmentRequest, setEnrollmentRequest] = useState(null);
  const pendingFollowUpRef = useRef(null);
  const preserveDialogOnModuleChange = useRef(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [formName, setFormName] = useState("");
  const [formDetail, setFormDetail] = useState("");
  const [listType, setListType] = useState("People");
  const [formBody, setFormBody] = useState("");
  const [formTrigger, setFormTrigger] = useState("Contact added to list");
  const [workflowAction, setWorkflowAction] = useState("Create follow-up task");
  const [workflowTarget, setWorkflowTarget] = useState("");
  const [workflowTaskDue, setWorkflowTaskDue] = useState("Today");
  const [meetingStart, setMeetingStart] = useState(nextMeetingStart);
  const [meetingDuration, setMeetingDuration] = useState("30");
  const [dealAmount, setDealAmount] = useState("25000");
  const [dealStageValue, setDealStageValue] = useState("Qualification");
  const [dealCloseDate, setDealCloseDate] = useState(defaultDealCloseDate);
  const [dealOwner, setDealOwner] = useState("Robert Berry");
  const [taskDueDate, setTaskDueDate] = useState(localDateValue);
  const [taskType, setTaskType] = useState("Follow-up");
  const [contactTitle, setContactTitle] = useState("");
  const [contactCompany, setContactCompany] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactLinkedIn, setContactLinkedIn] = useState("");
  const [contactLocation, setContactLocation] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [companyIndustry, setCompanyIndustry] = useState("");
  const [companyEmployees, setCompanyEmployees] = useState("");
  const [companyLocation, setCompanyLocation] = useState("");
  const [companyStatus, setCompanyStatus] = useState("Target");
  const companyCsvInputRef = useRef(null);
  const [apolloCompanyName, setApolloCompanyName] = useState("");
  const [companySearchExpanded, setCompanySearchExpanded] = useState(() => !window.matchMedia("(max-width: 700px)").matches);
  const [apolloCompanyKeywords, setApolloCompanyKeywords] = useState("");
  const [apolloCompanyLocation, setApolloCompanyLocation] = useState("");
  const [apolloCompanyIndustry, setApolloCompanyIndustry] = useState("");
  const [apolloCompanySize, setApolloCompanySize] = useState("");
  const [apolloCompanyAdvanced, setApolloCompanyAdvanced] = useState({});
  const [apolloCompanyResults, setApolloCompanyResults] = useState(null);
  const [apolloCompanyLookalikeIds, setApolloCompanyLookalikeIds] = useState([]);
  const [apolloCompanyPage, setApolloCompanyPage] = useState(1);
  const [apolloCompanyTotal, setApolloCompanyTotal] = useState(0);
  const [apolloCompanyHasMore, setApolloCompanyHasMore] = useState(false);
  const [apolloCompanyLoading, setApolloCompanyLoading] = useState(false);
  const [apolloCompanyError, setApolloCompanyError] = useState("");
  const [apolloCompanyEnrichmentReview, setApolloCompanyEnrichmentReview] = useState(null);
  const [apolloCompanyEnrichmentLoading, setApolloCompanyEnrichmentLoading] = useState(false);
  const [apolloCompanyEnrichmentError, setApolloCompanyEnrichmentError] = useState("");
  const [sequenceSteps, setSequenceSteps] = useState(starterSequenceSteps);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => typeof window === "undefined" || window.localStorage.getItem("apollo-notifications-enabled") !== "false");
  const [assistantInput, setAssistantInput] = useState("");
  const assistantComposerRef = useRef(null);
  const [assistantVoiceListening, setAssistantVoiceListening] = useState(false);
  const [assistantVoiceStatus, setAssistantVoiceStatus] = useState("");
  const assistantVoiceRecognitionRef = useRef(null);
  const [assistantView, setAssistantView] = useState("Chat");
  const [showAllAssistantPrompts, setShowAllAssistantPrompts] = useState(false);
  const [assistantConversation, setAssistantConversation] = useState(() => {
    const welcome = [{ role: "assistant", text: apolloConfigured
      ? "Hi Robert. I’m connected to Apollo Assistant. Ask me to prospect, research accounts, build outreach, analyze performance, or manage your Apollo workspace."
      : "Hi Robert. I can search your demo people and companies, summarize pipeline activity, or suggest a next step." }];
    try {
      const chats = JSON.parse(localStorage.getItem("apollo-assistant-chats") || "null");
      const validChats = Array.isArray(chats) ? chats.filter(chat => chat && typeof chat.id === "string" && Array.isArray(chat.messages)).map(chat => {
        const firstPrompt = chat.messages.find(message => message.role === "user")?.text;
        return { ...chat, title: chat.title === "New conversation" && firstPrompt ? firstPrompt.slice(0, 56) : chat.title || "New conversation" };
      }) : [];
      if (validChats.length) return { activeId: validChats[0].id, chats: validChats.slice(0, 20) };
      const legacyMessages = JSON.parse(localStorage.getItem("apollo-assistant-messages") || "null");
      const messages = Array.isArray(legacyMessages) && legacyMessages.length ? legacyMessages.slice(-100) : welcome;
      const firstPrompt = messages.find(message => message.role === "user")?.text;
      return { activeId: "chat-main", chats: [{ id: "chat-main", title: firstPrompt ? firstPrompt.slice(0, 56) : "New conversation", updatedAt: new Date().toISOString(), messages }] };
    } catch { return { activeId: "chat-main", chats: [{ id: "chat-main", title: "New conversation", updatedAt: new Date().toISOString(), messages: welcome }] }; }
  });
  const activeAssistantChat = assistantConversation.chats.find(chat => chat.id === assistantConversation.activeId) || assistantConversation.chats[0];
  const assistantMessages = activeAssistantChat?.messages || [];
  const assistantConversationMessages = assistantMessages.length === 1 && assistantMessages[0]?.role === "assistant" && !assistantMessages[0]?.apolloAction ? [] : assistantMessages;
  const assistantChatListRef = useRef(null);
  useEffect(() => () => {
    assistantVoiceRecognitionRef.current?.abort?.();
    assistantVoiceRecognitionRef.current = null;
  }, []);
  useEffect(() => {
    const chatList = assistantChatListRef.current;
    if (chatList) chatList.scrollTop = chatList.scrollHeight;
  }, [activeAssistantChat?.id, assistantMessages.length]);
  const setAssistantMessages = updater => setAssistantConversation(current => {
    const active = current.chats.find(chat => chat.id === current.activeId);
    if (!active) return current;
    const nextMessages = (typeof updater === "function" ? updater(active.messages) : updater).slice(-100);
    const firstPrompt = nextMessages.find(message => message.role === "user")?.text;
    const chats = current.chats.map(chat => chat.id !== active.id ? chat : { ...chat, messages: nextMessages, title: firstPrompt ? firstPrompt.slice(0, 56) : chat.title, updatedAt: new Date().toISOString() });
    return { ...current, chats };
  });
  const updateAssistantChat = (chatId, updater) => setAssistantConversation(current => ({
    ...current,
    chats: current.chats.map(chat => chat.id === chatId ? updater(chat) : chat),
  }));
  const updateAssistantReviewSequence = (messageId, stepPlan) => updateAssistantChat(activeAssistantChat.id, chat => ({
    ...chat,
    messages: chat.messages.map(message => message.id !== messageId || message.reviewAction?.operation !== "create-sequence" ? message : {
      ...message,
      reviewAction: {
        ...message.reviewAction,
        sequence: { ...message.reviewAction.sequence, stepPlan, steps: stepPlan.length },
        summary: `${message.reviewAction.sequence.name} · ${stepPlan.map(step => step.channel).join(" → ")}`,
      },
    }),
  }));
  const updateAssistantReviewStepPlan = (messageId, stepPlan) => updateAssistantChat(activeAssistantChat.id, chat => ({
    ...chat,
    messages: chat.messages.map(message => message.id !== messageId || message.reviewAction?.operation !== "update-sequence-step" ? message : {
      ...message,
      reviewAction: { ...message.reviewAction, stepPlan },
    }),
  }));
  const updateAssistantReviewEmails = (messageId, emailIndex, patch) => updateAssistantChat(activeAssistantChat.id, chat => ({
    ...chat,
    messages: chat.messages.map(message => {
      if (message.id !== messageId || !["create-email-draft", "create-email-drafts"].includes(message.reviewAction?.operation)) return message;
      const action = message.reviewAction;
      if (action.operation === "create-email-draft") {
        const email = patchDraftEmail(action.email, patch);
        return { ...message, text: "Email draft updated. Review the copy before applying.", reviewAction: { ...action, email, summary: `${email.recipient} · ${email.subject}` } };
      }
      return { ...message, text: "Email drafts updated. Review the copy before applying.", reviewAction: { ...action, emails: action.emails.map((email, index) => index === emailIndex ? patchDraftEmail(email, patch) : email) } };
    }),
  }));
  const appendApolloAssistantMessages = (chat, payload) => {
    const incoming = Array.isArray(payload.messages) ? payload.messages : [];
    const taskId = payload.task_id || chat.apolloTaskId || null;
    const seen = new Set((chat.messages || []).filter(message => message.apolloTaskId === taskId).map(message => message.apolloSeq).filter(value => value != null));
    const additions = incoming
      .filter(message => message.role !== "user" && Number.isInteger(Number(message.seq_num)) && !seen.has(Number(message.seq_num)) && String(message.text || "").trim())
      .map(message => ({ role: "assistant", text: String(message.text).trim(), apolloSeq: Number(message.seq_num), apolloTaskId: taskId }));
    const nextTaskId = taskId;
    const sameTask = !payload.task_id || payload.task_id === chat.apolloTaskId;
    return {
      ...chat,
      messages: [...(chat.messages || []), ...additions].slice(-100),
      apolloTaskStatus: payload.status || chat.apolloTaskStatus,
      apolloTaskId: payload.status === "failed" ? null : nextTaskId,
      apolloCursor: payload.cursor ?? payload.latest_seq_num ?? (sameTask ? chat.apolloCursor ?? null : null),
      apolloPollAfterMs: Number(payload.poll_after_ms) || 10_000,
      apolloPollError: "",
      apolloPolledAt: Date.now(),
      updatedAt: new Date().toISOString(),
    };
  };
  const applyingAssistantReviewActions = useRef(new Set());
  const applyAssistantReviewAction = (messageId, action) => {
    if (!action || action.status !== "pending" || applyingAssistantReviewActions.current.has(action.id)) return;
    if (["create-email-draft", "create-email-drafts"].includes(action.operation)) {
      const emails = action.operation === "create-email-draft" ? [action.email] : action.emails || [];
      const issues = emailDraftIssues(emails, assistantContext.claimsToAvoid);
      if (issues.length) {
        setAssistantMessages(current => current.map(message => message.id === messageId ? { ...message, text: `I couldn't apply this draft. ${issues.join(" ")}` } : message));
        return;
      }
    }
    applyingAssistantReviewActions.current.add(action.id);
    let result = "The destination could not be found; no changes were made.";
    let status = "unchanged";
    if (action.type === "save-to-list") {
      const target = data.lists.find(list => list.type === "People" && list.name === action.targetName);
      if (target && !(target.members || []).includes(action.person.name)) {
        const savedRecord = { ...action.person, id: action.person.id || `local-${action.person.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, source: action.person.source || "workspace" };
        setData(current => {
          const currentTarget = current.lists.find(list => list.type === "People" && list.name === action.targetName);
          if (!currentTarget || (currentTarget.members || []).includes(action.person.name)) return current;
          const next = {
            ...current,
            savedPeople: current.savedPeople.some(person => person.name === action.person.name || (person.email && person.email === action.person.email)) ? current.savedPeople : [savedRecord, ...current.savedPeople],
            lists: current.lists.map(list => list.name !== currentTarget.name ? list : { ...list, members: [...(list.members || []), action.person.name], count: Number(list.count || 0) + 1, updated: "Just now" }),
          };
          return applyWorkflowEvent(next, "Contact added to list", [{ contact: action.person.name, company: action.person.company, list: currentTarget.name }]);
        });
        result = `Added ${action.person.name} to ${target.name} and saved the contact in this browser workspace.`;
        status = "applied";
      } else if (target) result = `${action.person.name} is already in ${target.name}; no changes were made.`;
    } else if (action.type === "create-list-and-save") {
      const alreadyExists = data.lists.some(list => list.type === "People" && list.name.toLowerCase() === action.targetName.toLowerCase());
      if (!alreadyExists) {
        const savedRecord = { ...action.person, id: action.person.id || `local-${action.person.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, source: action.person.source || "workspace" };
        setData(current => {
          if (current.lists.some(list => list.type === "People" && list.name.toLowerCase() === action.targetName.toLowerCase())) return current;
          const next = {
            ...current,
            savedPeople: current.savedPeople.some(person => person.name === action.person.name || (person.email && person.email === action.person.email)) ? current.savedPeople : [savedRecord, ...current.savedPeople],
            lists: [{ name: action.targetName, type: "People", count: 1, updated: "Just now", description: "Created by the Apollo Assistant", members: [action.person.name], source: "local" }, ...current.lists],
          };
          return applyWorkflowEvent(next, "Contact added to list", [{ contact: action.person.name, company: action.person.company, list: action.targetName }]);
        });
        result = `Created ${action.targetName} and saved ${action.person.name} to it in this browser workspace.`;
        status = "applied";
      } else result = `A list named ${action.targetName} already exists; no changes were made.`;
    } else if (action.type === "save-company-to-list") {
      const target = data.lists.find(list => list.type === "Companies" && list.name === action.targetName);
      if (target && !(target.members || []).includes(action.company.name)) {
        setData(current => ({
          ...current,
          lists: current.lists.map(list => list.name !== target.name || list.type !== "Companies" ? list : { ...list, members: [...(list.members || []), action.company.name], count: Number(list.count || 0) + 1, updated: "Just now" }),
        }));
        result = `Added ${action.company.name} to the company list ${target.name} in this browser workspace.`;
        status = "applied";
      } else if (target) result = `${action.company.name} is already in ${target.name}; no changes were made.`;
    } else if (action.type === "create-company-list-and-save") {
      const alreadyExists = data.lists.some(list => list.type === "Companies" && list.name.toLowerCase() === action.targetName.toLowerCase());
      if (!alreadyExists) {
        setData(current => {
          if (current.lists.some(list => list.type === "Companies" && list.name.toLowerCase() === action.targetName.toLowerCase())) return current;
          return { ...current, lists: [{ name: action.targetName, type: "Companies", count: 1, updated: "Just now", description: "Created by the Apollo Assistant", members: [action.company.name], source: "local" }, ...current.lists] };
        });
        result = `Created the company list ${action.targetName} and saved ${action.company.name} to it in this browser workspace.`;
        status = "applied";
      } else result = `A company list named ${action.targetName} already exists; no changes were made.`;
    } else if (action.type === "enroll-in-sequence") {
      const target = data.sequences.find(sequence => sequence.name === action.targetName);
      if (target && !(target.enrolledPeople || []).includes(action.person.name)) {
        const savedRecord = { ...action.person, id: action.person.id || `local-${action.person.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, source: action.person.source || "workspace" };
        setData(current => {
          const currentTarget = current.sequences.find(sequence => sequence.name === action.targetName);
          if (!currentTarget || (currentTarget.enrolledPeople || []).includes(action.person.name)) return current;
          return {
            ...current,
            savedPeople: current.savedPeople.some(person => person.name === action.person.name || (person.email && person.email === action.person.email)) ? current.savedPeople : [savedRecord, ...current.savedPeople],
            sequences: current.sequences.map(sequence => sequence.name !== currentTarget.name ? sequence : updateSequenceEnrollment(sequence, [...(sequence.enrolledPeople || []), action.person.name])),
          };
        });
        result = `Enrolled ${action.person.name} in ${target.name}. This is a local plan; no outreach was sent.`;
        status = "applied";
      } else if (target) result = `${action.person.name} is already enrolled in ${target.name}; no changes were made.`;
    } else if (action.type === "local-write") {
      if (action.operation === "save-companies-to-list") {
        const target = data.lists.find(list => list.type === "Companies" && list.name.toLowerCase() === action.targetName.toLowerCase());
        if (!target && !action.createList) result = `The company list ${action.targetName} could not be found; no changes were made.`;
        else {
          const alreadyInList = new Set(target?.members || []);
          const additions = action.companies.filter(company => !alreadyInList.has(company.name));
          if (!additions.length) result = `All ${action.companies.length} selected companies are already in ${action.targetName}; no changes were made.`;
          else {
            setData(current => {
              const currentTarget = current.lists.find(list => list.type === "Companies" && list.name.toLowerCase() === action.targetName.toLowerCase());
              if (!currentTarget && !action.createList) return current;
              const members = new Set(currentTarget?.members || []);
              const currentAdditions = action.companies.filter(company => !members.has(company.name));
              if (!currentAdditions.length) return current;
              const lists = currentTarget
                ? current.lists.map(list => list !== currentTarget ? list : { ...list, members: [...members, ...currentAdditions.map(company => company.name)], count: Number(list.count || 0) + currentAdditions.length, updated: "Just now" })
                : [{ name: action.targetName, type: "Companies", count: currentAdditions.length, updated: "Just now", description: "Created by the Apollo Assistant", members: currentAdditions.map(company => company.name), source: "local" }, ...current.lists];
              return { ...current, lists };
            });
            result = `${action.createList && !target ? `Created ${action.targetName} and ` : ""}added ${additions.length} of ${action.companies.length} selected companies to ${action.targetName}; existing list members were left unchanged.`;
            status = "applied";
          }
        }
      } else if (action.operation === "save-people-to-list") {
        const target = data.lists.find(list => list.type === "People" && list.name.toLowerCase() === action.targetName.toLowerCase());
        if (!target && !action.createList) result = `The People list ${action.targetName} could not be found; no changes were made.`;
        else {
          const alreadyInList = new Set(target?.members || []);
          const additions = action.people.filter(person => !alreadyInList.has(person.name));
          if (!additions.length) result = `All ${action.people.length} selected contacts are already in ${action.targetName}; no changes were made.`;
          else {
            setData(current => {
              const currentTarget = current.lists.find(list => list.type === "People" && list.name.toLowerCase() === action.targetName.toLowerCase());
              if (!currentTarget && !action.createList) return current;
              const members = new Set(currentTarget?.members || []);
              const currentAdditions = action.people.filter(person => !members.has(person.name));
              if (!currentAdditions.length) return current;
              const savedPeople = [...current.savedPeople];
              currentAdditions.forEach(person => {
                if (!savedPeople.some(saved => saved.name === person.name || (person.email && saved.email === person.email))) {
                  savedPeople.unshift({ ...person, id: person.id || `local-${person.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, source: person.source || "workspace" });
                }
                members.add(person.name);
              });
              const lists = currentTarget
                ? current.lists.map(list => list !== currentTarget ? list : { ...list, members: [...members], count: Number(list.count || 0) + currentAdditions.length, updated: "Just now" })
                : [{ name: action.targetName, type: "People", count: members.size, updated: "Just now", description: "Created by the Apollo Assistant", members: [...members], source: "local" }, ...current.lists];
              return applyWorkflowEvent({ ...current, savedPeople, lists }, "Contact added to list", currentAdditions.map(person => ({ contact: person.name, company: person.company, list: action.targetName })));
            });
            result = `${action.createList && !target ? `Created ${action.targetName} and ` : ""}added ${additions.length} of ${action.people.length} selected contacts to ${action.targetName}; existing list members were left unchanged.`;
            status = "applied";
          }
        }
      } else if (action.operation === "create-meeting") {
        setData(current => ({ ...current, meetings: [{ ...action.meeting, source: action.meeting.source || "local" }, ...current.meetings] }));
        result = `Scheduled a local 30-minute meeting with ${action.meeting.person} for ${action.meeting.time}. It is saved in this browser workspace; no calendar invite was sent.`;
        status = "applied";
      } else if (action.operation === "log-call") {
        setData(current => ({ ...current, calls: [{ ...action.call, source: action.call.source || "local" }, ...current.calls] }));
        onNavigate("Calls");
        result = `Logged a ${action.call.outcome.toLowerCase()} call with ${action.call.person} in the local workspace. This did not place a call.`;
        status = "applied";
      } else if (action.operation === "create-email-draft") {
        const sourceEmailStillCurrent = !action.sourceEmail || data.emails.some(email => email.subject === action.sourceEmail.subject && email.from === action.sourceEmail.from && email.preview === action.sourceEmail.preview);
        if (!sourceEmailStillCurrent) result = "The source email changed after review, so I left the draft unchanged. Open the current thread and ask me to draft a reply again.";
        else {
        const savedDraft = { ...action.email, id: action.email.id || newEmailId(), source: action.email.source || "local" };
        setData(current => ({ ...current, emails: [savedDraft, ...current.emails] }));
        const recipientWarning = action.email.recipientNeedsReview ? ` Recipient needs review: ${emailRecipientReviewMessage(action.email)}` : "";
        result = action.sourceEmail
          ? `Created a local reply draft for ${action.email.recipient}, grounded in the saved email thread. Review it in Emails → Drafts; it was not sent.${recipientWarning}`
          : action.sourceSummary
          ? `Created a local post-meeting draft for ${action.email.recipient}, grounded in the saved call summary. Review it in Emails → Drafts; it was not sent.${recipientWarning}`
          : `Created a local email draft for ${action.email.recipient} using saved product context and workspace details. Review it in Emails → Drafts; it was not sent.${recipientWarning}`;
        status = "applied";
        }
      } else if (action.operation === "create-email-drafts") {
        const currentPeople = new Set([...people, ...(data.savedPeople || [])].map(person => person.name.toLowerCase()));
        const currentList = data.lists.find(list => list.type === "People" && list.name.toLowerCase() === action.listName.toLowerCase());
        const currentMembers = new Set((currentList?.members || []).map(name => String(name).toLowerCase()));
        const validDrafts = action.emails.filter(email => currentPeople.has(email.recipient.toLowerCase()) && currentMembers.has(email.recipient.toLowerCase()));
        if (!validDrafts.length) result = `The contacts are no longer members of “${action.listName}”; no drafts were created.`;
        else {
          const savedDrafts = validDrafts.map(email => ({ ...email, id: email.id || newEmailId(), source: email.source || "local" }));
          setData(current => ({ ...current, emails: [...savedDrafts, ...current.emails] }));
          const recipientsNeedingReview = validDrafts.filter(email => email.recipientNeedsReview).length;
          result = `Created ${validDrafts.length} local personalized email draft${validDrafts.length === 1 ? "" : "s"} for ${action.listName}. Review them in Emails → Drafts; none were sent.${recipientsNeedingReview ? ` ${recipientsNeedingReview} recipient${recipientsNeedingReview === 1 ? " needs" : "s need"} review.` : ""}`;
          status = "applied";
        }
      } else if (action.operation === "create-workflow") {
        if (data.workflows.some(workflow => workflow.name.toLowerCase() === action.workflow.name.toLowerCase())) result = `A workflow draft named “${action.workflow.name}” already exists; no changes were made.`;
        else {
          setData(current => ({ ...current, workflows: [{ ...action.workflow, source: action.workflow.source || "local" }, ...(current.workflows || [])] }));
          onNavigate("Workflows");
          const actionSummary = workflowSteps(action.workflow).map(step => `${step.action}${step.targetName ? ` (${step.targetName})` : ""}`).join(" → ");
          result = `Created a ${workflowSteps(action.workflow).length}-step local workflow draft: ${action.workflow.trigger} → ${actionSummary}. Review it in Workflows before activating; it will not run while it is a draft.`;
          status = "applied";
        }
      } else if (action.operation === "create-sequence") {
        if (data.sequences.some(sequence => sequence.name.toLowerCase() === action.sequence.name.toLowerCase())) result = `A sequence draft named “${action.sequence.name}” already exists; no changes were made.`;
        else {
          setData(current => ({ ...current, sequences: [{ ...action.sequence, source: action.sequence.source || "local" }, ...current.sequences] }));
          onNavigate("Sequences");
          result = `Created a ${action.sequence.stepPlan.length}-step local sequence draft for ${action.targetLabel}. No contacts were enrolled and nothing was sent.`;
          status = "applied";
        }
      } else if (action.operation === "set-sequence-status") {
        const sequence = data.sequences.find(item => item.name === action.sequenceName);
        if (!sequence) result = `Sequence “${action.sequenceName}” could not be found; no changes were made.`;
        else if (sequence.status !== action.previousStatus) result = `“${action.sequenceName}” changed after review; no status change was made.`;
        else {
          setData(current => ({ ...current, sequences: current.sequences.map(item => item.name !== action.sequenceName ? item : { ...item, status: action.targetStatus }) }));
          onNavigate("Sequences");
          result = `${action.sequenceName} is now ${action.targetStatus.toLowerCase()} in the local workspace. No contacts were enrolled and no outreach was sent.`;
          status = "applied";
        }
      } else if (action.operation === "update-sequence-step") {
        const currentSequence = data.sequences.find(sequence => sequence.name === action.sequenceName);
        if (!currentSequence) result = `Sequence “${action.sequenceName}” no longer exists; no changes were made.`;
        else if (JSON.stringify(currentSequence.stepPlan || []) !== JSON.stringify(action.previousStepPlan)) result = `The sequence changed after this review was prepared, so I left it untouched. Ask me to review it again.`;
        else {
          setData(current => ({ ...current, sequences: current.sequences.map(sequence => sequence.name !== action.sequenceName ? sequence : { ...sequence, stepPlan: action.stepPlan }) }));
          onNavigate("Sequences");
          result = `Updated the first email step in ${action.sequenceName}. The other steps, enrolled contacts, and sequence status were left unchanged; nothing was sent.`;
          status = "applied";
        }
      } else if (action.operation === "create-task") {
        setData(current => ({ ...current, tasks: [{ ...action.task, source: action.task.source || "local" }, ...current.tasks] }));
        result = `Created a follow-up task for ${action.task.person}, due ${action.task.due.toLowerCase()}. It is saved in this browser workspace.`;
        status = "applied";
      } else if (action.operation === "create-contact") {
        const duplicate = [...people, ...data.savedPeople].some(person => person.name.toLowerCase() === action.person.name.toLowerCase() || (action.person.email && person.email?.toLowerCase() === action.person.email.toLowerCase()));
        if (duplicate) result = `A contact named ${action.person.name}${action.person.email ? ` or using ${action.person.email}` : ""} already exists; no changes were made.`;
        else {
          setData(current => {
            if ([...people, ...current.savedPeople].some(person => person.name.toLowerCase() === action.person.name.toLowerCase() || (action.person.email && person.email?.toLowerCase() === action.person.email.toLowerCase()))) return current;
            const companyExists = current.companies.some(company => company.name.toLowerCase() === action.person.company.toLowerCase());
            const companies = action.person.company !== "Company unavailable" && !companyExists
              ? [{ name: action.person.company, domain: "", industry: "—", employees: "—", location: action.person.location === "Location unavailable" ? "—" : action.person.location, people: 1, status: "New", source: "local" }, ...current.companies]
              : current.companies;
            return { ...current, savedPeople: [{ ...action.person, source: action.person.source || "local" }, ...current.savedPeople], companies };
          });
          result = `Created ${action.person.name} as a local contact${action.person.company !== "Company unavailable" ? ` at ${action.person.company}` : ""}. Review the record in People; nothing was sent to Apollo.`;
          status = "applied";
        }
      } else if (action.operation === "create-company") {
        const duplicate = data.companies.some(company => company.name.toLowerCase() === action.company.name.toLowerCase() || (action.company.domain && company.domain?.toLowerCase() === action.company.domain.toLowerCase()));
        if (duplicate) result = `A company named ${action.company.name}${action.company.domain ? ` or using ${action.company.domain}` : ""} already exists; no changes were made.`;
        else {
          setData(current => current.companies.some(company => company.name.toLowerCase() === action.company.name.toLowerCase() || (action.company.domain && company.domain?.toLowerCase() === action.company.domain.toLowerCase()))
            ? current
            : { ...current, companies: [{ ...action.company, source: action.company.source || "local" }, ...current.companies] });
          result = `Created ${action.company.name} in the local Companies workspace. You can now use it when creating contacts and deals; nothing was sent to Apollo.`;
          status = "applied";
        }
      } else if (action.operation === "create-deal") {
        if (data.deals.some(deal => deal.name.toLowerCase() === action.deal.name.toLowerCase())) result = `A deal named “${action.deal.name}” already exists; no changes were made.`;
        else {
          setData(current => current.deals.some(deal => deal.name.toLowerCase() === action.deal.name.toLowerCase())
            ? current
            : { ...current, deals: [{ ...action.deal, source: action.deal.source || "local" }, ...current.deals] });
          onNavigate("Deals");
          result = `Created “${action.deal.name}” in the local pipeline for ${fmtMoney(action.deal.amount)}. Review it in Deals; no external CRM record was changed.`;
          status = "applied";
        }
      } else if (action.operation === "create-follow-up-tasks") {
        const recordingsStillCurrent = !action.sourceRecordings || action.sourceRecordings.every(source => data.recordings.some(recording => recording.title === source.title && recording.person === source.person && recording.summary === source.summary));
        const callsStillCurrent = !action.sourceCalls || action.sourceCalls.every(source => data.calls.some(call => call.person === source.person && call.time === source.time && call.outcome === source.outcome && call.note === source.note));
        if (!recordingsStillCurrent || !callsStillCurrent) result = "A source call note changed after this review was prepared, so I left the tasks unchanged. Ask me to review the call again.";
        else {
          setData(current => ({ ...current, tasks: action.tasks.map(task => ({ ...task, source: task.source || "local" })).concat(current.tasks) }));
          result = action.sourceRecordings || action.sourceCalls
            ? `Created ${action.tasks.length} follow-up task${action.tasks.length === 1 ? "" : "s"} from saved call notes, due ${action.due.toLowerCase()}. The tasks are in this browser workspace.`
            : `Created ${action.tasks.length} follow-up task${action.tasks.length === 1 ? "" : "s"} in this browser workspace, due ${action.due.toLowerCase()}.`;
          status = "applied";
        }
      } else if (action.operation === "associate-recording-deal") {
        const recordingStillCurrent = data.recordings.some(recording => recording.title === action.recording.title && recording.person === action.recording.person && recording.summary === action.recording.summary && (recording.associatedDeal || "") === action.previousDeal);
        const dealStillExists = data.deals.some(deal => deal.name === action.dealName);
        if (!recordingStillCurrent || !dealStillExists) result = "The conversation or deal changed after this review was prepared, so I left the association unchanged. Ask me to review it again.";
        else {
          setData(current => ({ ...current, recordings: current.recordings.map(recording => recording.title === action.recording.title && recording.person === action.recording.person ? { ...recording, associatedDeal: action.dealName } : recording) }));
          result = `Associated “${action.recording.title}” with “${action.dealName}” in this browser workspace.`;
          status = "applied";
        }
      } else if (action.operation === "extract-recording-record-field") {
        const recordingStillCurrent = data.recordings.some(recording => recording.title === action.recording.title && recording.person === action.recording.person && recording.summary === action.recording.summary);
        const collection = action.recordType === "contact" ? "savedPeople" : action.recordType === "company" ? "companies" : "deals";
        const record = (collection === "savedPeople" ? [...data.savedPeople, ...people] : data[collection]).find(item => item.name === action.recordName);
        const currentValue = String(record?.customFields?.[action.fieldName] || "").trim();
        if (!recordingStillCurrent || !record || currentValue !== action.previousValue) result = `The saved conversation or ${action.recordType} field changed after review, so I left the CRM record unchanged. Ask me to extract the value again.`;
        else {
          setData(current => {
            const currentRecord = (collection === "savedPeople" ? [...current.savedPeople, ...people] : current[collection]).find(item => item.name === action.recordName);
            if (!currentRecord || String(currentRecord.customFields?.[action.fieldName] || "").trim() !== action.previousValue) return current;
            const updatedRecord = { ...currentRecord, customFields: { ...(currentRecord.customFields || {}), [action.fieldName]: action.value }, source: currentRecord.source || "workspace" };
            return { ...current, [collection]: collection === "savedPeople"
              ? current.savedPeople.some(item => item.name === action.recordName) ? current.savedPeople.map(item => item.name === action.recordName ? updatedRecord : item) : [updatedRecord, ...current.savedPeople]
              : current[collection].map(item => item.name === action.recordName ? updatedRecord : item) };
          });
          result = `Saved “${action.fieldName}” on “${action.recordName}” from ${action.recording.title} in this browser workspace.`;
          status = "applied";
        }
      } else if (action.operation === "enroll-people-in-sequence") {
        const scope = { sequenceName: action.targetName, contactNames: action.people.map(person => person.name), sourceListName: action.sourceListName || "" };
        const plan = resolveEnrollmentScope(scope, data, workspacePeople);
        if (plan.error) result = `${plan.error} No changes were made.`;
        else if (!plan.people.length) result = "The selected contacts are already enrolled or no longer eligible in the source list. No changes were made.";
        else {
          setData(current => {
            const currentPlan = resolveEnrollmentScope(scope, current, workspaceContacts({ ...current, people }));
            if (currentPlan.error || !currentPlan.people.length) return current;
            const savedPeople = [...current.savedPeople];
            const currentEnrolled = new Set(currentPlan.sequence.enrolledPeople || []);
            currentPlan.people.forEach(person => {
              if (!savedPeople.some(saved => saved.name.toLowerCase() === person.name.toLowerCase() || (person.email && saved.email === person.email))) savedPeople.unshift({ ...person, id: person.id || `local-${person.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, source: person.source || "workspace" });
              currentEnrolled.add(person.name);
            });
            return { ...current, savedPeople, sequences: current.sequences.map(sequence => sequence.name !== currentPlan.sequence.name ? sequence : updateSequenceEnrollment(sequence, [...currentEnrolled])) };
          });
          result = `Added ${plan.people.length} of ${action.people.length} selected contacts to the local ${action.targetName} sequence plan. No outreach was sent.`;
          status = "applied";
        }
      } else if (action.operation === "complete-tasks") {
        const reviewedTasks = action.tasks || [];
        const stillOpen = reviewedTasks.filter(task => data.tasks.some(current => current.title === task.title && current.person === task.person && current.dueDate === task.dueDate && !current.done));
        if (!stillOpen.length) result = "Those tasks are already complete or have changed since review; no changes were made.";
        else {
          const reviewedKeys = new Set(stillOpen.map(task => `${task.title}|${task.person}|${task.dueDate || task.due || ""}`));
          setData(current => ({
            ...current,
            tasks: current.tasks.map(task => !reviewedKeys.has(`${task.title}|${task.person}|${task.dueDate || task.due || ""}`) ? task : { ...task, done: true, taskStatus: action.taskStatus, ...(action.note ? { completionNote: action.note } : {}) }),
          }));
          result = `${action.taskStatus === "Skipped" ? "Skipped" : "Marked complete"} ${stillOpen.length} task${stillOpen.length === 1 ? "" : "s"}${action.note ? ` with note: ${action.note}` : ""}.`;
          status = "applied";
        }
      } else if (action.operation === "reschedule-tasks") {
        const taskKeys = new Set(action.tasks.map(task => `${task.title}|${task.person}|${task.dueDate || task.due || ""}`));
        const currentMatches = data.tasks.filter(task => taskKeys.has(`${task.title}|${task.person}|${task.dueDate || task.due || ""}`) && !task.done);
        if (!currentMatches.length) result = "Those open tasks have changed since review; no changes were made.";
        else {
          setData(current => ({
            ...current,
            tasks: current.tasks.map(task => !taskKeys.has(`${task.title}|${task.person}|${task.dueDate || task.due || ""}`) ? task : { ...task, dueDate: action.dueDate, due: action.due }),
          }));
          result = `Rescheduled ${currentMatches.length} task${currentMatches.length === 1 ? "" : "s"} to ${action.due.toLowerCase()}.`;
          status = "applied";
        }
      } else if (action.operation === "edit-tasks") {
        const keys = new Set(action.tasks.map(task => `${task.title}|${task.person}|${task.dueDate || task.due || ""}`));
        const currentMatches = data.tasks.filter(task => keys.has(`${task.title}|${task.person}|${task.dueDate || task.due || ""}`));
        if (!currentMatches.length) result = "Those tasks have changed since review; no changes were made.";
        else {
          setData(current => ({
            ...current,
            tasks: current.tasks.map(task => {
              if (!keys.has(`${task.title}|${task.person}|${task.dueDate || task.due || ""}`)) return task;
              const next = { ...task, ...action.changes };
              if (action.changes.notes && task.notes) next.notes = `${task.notes}\n${action.changes.notes}`;
              return next;
            }),
          }));
          result = `Updated ${currentMatches.length} task${currentMatches.length === 1 ? "" : "s"}: ${action.changeSummary}.`;
          status = "applied";
        }
      } else if (action.operation === "update-record") {
        if (action.recordType === "person") {
          const currentRecord = [...data.savedPeople, ...people].find(person => person.name === action.recordName);
          if (!currentRecord) result = `Contact ${action.recordName} could not be found; no changes were made.`;
          else if (String(currentRecord[action.fieldKey] || "").trim() !== action.previousValue) result = `The ${action.fieldLabel.toLowerCase()} for ${action.recordName} changed after review; no changes were made.`;
          else {
            setData(current => {
              const savedRecord = current.savedPeople.find(person => person.name === action.recordName) || people.find(person => person.name === action.recordName);
              if (!savedRecord || String(savedRecord[action.fieldKey] || "").trim() !== action.previousValue) return current;
              const updatedRecord = { ...savedRecord, [action.fieldKey]: action.value, source: savedRecord.source || "workspace" };
              return {
                ...current,
                savedPeople: current.savedPeople.some(person => person.name === action.recordName)
                  ? current.savedPeople.map(person => person.name === action.recordName ? updatedRecord : person)
                  : [updatedRecord, ...current.savedPeople],
              };
            });
            result = `Updated ${action.recordName}'s ${action.fieldLabel.toLowerCase()} to ${action.value} in the local workspace.`;
            status = "applied";
          }
        } else if (action.recordType === "deal") {
          const currentRecord = data.deals.find(deal => deal.name === action.recordName);
          if (!currentRecord) result = `Deal ${action.recordName} could not be found; no changes were made.`;
          else if (String(currentRecord[action.fieldKey] ?? "").trim() !== action.previousValue) result = `The ${action.fieldLabel.toLowerCase()} for ${action.recordName} changed after review; no changes were made.`;
          else {
            setData(current => {
              const deal = current.deals.find(item => item.name === action.recordName);
              if (!deal || String(deal[action.fieldKey] ?? "").trim() !== action.previousValue) return current;
              let next = { ...current, deals: current.deals.map(item => item.name === action.recordName ? { ...item, [action.fieldKey]: action.value } : item) };
              if (action.fieldKey === "stage") next = applyWorkflowEvent(next, "Deal stage changed", [{ contact: deal.company, company: deal.company, deal: deal.name, stage: action.value }]);
              return next;
            });
            const displayedValue = action.fieldKey === "amount" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(action.value) : action.value;
            result = `Updated ${action.recordName}'s ${action.fieldLabel.toLowerCase()} to ${displayedValue} in the local workspace.`;
            status = "applied";
          }
        } else {
          const currentRecord = data.companies.find(company => company.name === action.recordName);
          if (!currentRecord) result = `Company ${action.recordName} could not be found; no changes were made.`;
          else if (String(currentRecord[action.fieldKey] || "").trim() !== action.previousValue) result = `The ${action.fieldLabel.toLowerCase()} for ${action.recordName} changed after review; no changes were made.`;
          else {
            setData(current => ({
              ...current,
              companies: current.companies.map(company => company.name !== action.recordName ? company : { ...company, [action.fieldKey]: action.value }),
            }));
            result = `Updated ${action.recordName}'s ${action.fieldLabel.toLowerCase()} to ${action.value} in the local workspace.`;
            status = "applied";
          }
        }
      } else if (action.operation === "update-custom-field") {
        const collection = action.recordType === "contact" ? "savedPeople" : action.recordType === "company" ? "companies" : "deals";
        const record = (collection === "savedPeople" ? [...data.savedPeople, ...people] : data[collection]).find(item => item.name === action.recordName);
        const currentValue = String(record?.customFields?.[action.fieldName] || "").trim();
        if (!record) result = `The ${action.recordType} ${action.recordName} could not be found; no changes were made.`;
        else if (currentValue !== action.previousValue) result = `The custom field “${action.fieldName}” on ${action.recordName} changed after review; no changes were made.`;
        else {
          setData(current => {
            const currentRecord = (collection === "savedPeople" ? [...current.savedPeople, ...people] : current[collection]).find(item => item.name === action.recordName);
            if (!currentRecord || String(currentRecord.customFields?.[action.fieldName] || "").trim() !== action.previousValue) return current;
            const updatedRecord = { ...currentRecord, customFields: { ...(currentRecord.customFields || {}), [action.fieldName]: action.value }, source: currentRecord.source || "workspace" };
            return { ...current, [collection]: collection === "savedPeople"
              ? current.savedPeople.some(item => item.name === action.recordName) ? current.savedPeople.map(item => item.name === action.recordName ? updatedRecord : item) : [updatedRecord, ...current.savedPeople]
              : current[collection].map(item => item.name === action.recordName ? updatedRecord : item) };
          });
          result = `Updated “${action.fieldName}” on “${action.recordName}” in this browser workspace.`;
          status = "applied";
        }
      } else if (action.operation === "save-ai-research") {
        if (action.person) {
          const savedRecord = { ...action.person, aiResearch: action.research, aiResearchUpdatedAt: action.researchedAt, source: action.person.source || "workspace" };
          setData(current => ({ ...current, savedPeople: current.savedPeople.some(person => person.name === action.person.name)
            ? current.savedPeople.map(person => person.name === action.person.name ? { ...person, ...savedRecord } : person)
            : [savedRecord, ...current.savedPeople] }));
          result = `Saved the local research note to ${action.person.name}'s contact record. Open People and select the contact to review it.`;
        } else {
          setData(current => ({ ...current, companies: current.companies.map(company => company.name !== action.company.name ? company : { ...company, aiResearch: action.research, aiResearchUpdatedAt: action.researchedAt }) }));
          result = `Saved the local research note to ${action.company.name}'s account record. Open Companies and select the account to review it.`;
        }
        status = "applied";
      } else if (action.operation === "save-ai-research-batch") {
        const currentList = data.lists.find(list => list.type === "Companies" && list.name.toLowerCase() === action.listName.toLowerCase());
        const currentMembers = new Set((currentList?.members || []).map(name => String(name).toLowerCase()));
        const currentCompanies = new Set(data.companies.map(company => company.name.toLowerCase()));
        const validNotes = action.notes.filter(note => currentMembers.has(note.name.toLowerCase()) && currentCompanies.has(note.name.toLowerCase()));
        if (!validNotes.length) result = `The accounts are no longer members of “${action.listName}”; no research notes were saved.`;
        else {
          setData(current => ({ ...current, companies: current.companies.map(company => {
            const note = validNotes.find(item => item.name.toLowerCase() === company.name.toLowerCase());
            return note ? { ...company, aiResearch: note.research, aiResearchUpdatedAt: action.researchedAt } : company;
          }) }));
          result = `Saved local account overviews for ${validNotes.length} ${validNotes.length === 1 ? "company" : "companies"} from “${action.listName}.” Open Companies and select an account to review its note.`;
          status = "applied";
        }
      } else if (action.operation === "update-ai-context") {
        const currentProduct = getAssistantProducts(data.assistantContext || seed.assistantContext).find(product => product.id === action.productId);
        if (!currentProduct || String(currentProduct[action.fieldKey] || "").trim() !== action.previousValue) result = `The selected product context changed after this review was prepared, so I left it unchanged. Ask me to make the update again to review the current value.`;
        else {
          setData(current => {
            const stored = current.assistantContext || seed.assistantContext;
            const products = getAssistantProducts(stored).map(product => product.id === action.productId ? { ...product, [action.fieldKey]: action.value } : product);
            return { ...current, assistantContext: storeAssistantProducts(stored, products, stored.activeProductId || action.productId) };
          });
          result = `Updated ${action.fieldLabel.toLowerCase()} for ${action.productName}. You can review it in Admin settings → AI Context.`;
          status = "applied";
        }
      } else if (action.operation === "export-csv") {
        const url = URL.createObjectURL(new Blob([action.csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = action.filename;
        link.hidden = true;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
        result = action.exportSummary;
        status = "applied";
      }
    }
    setAssistantMessages(current => current.map(message => message.id !== messageId ? message : {
      ...message,
      text: result,
      reviewAction: { ...action, status },
    }));
    applyingAssistantReviewActions.current.delete(action.id);
  };
  const cancelAssistantReviewAction = (messageId, action) => setAssistantMessages(current => current.map(message => message.id !== messageId ? message : {
    ...message,
    text: "No changes were made.",
    reviewAction: { ...action, status: "cancelled" },
  }));
  const buildApolloInstruction = prompt => {
    const profile = assistantProducts.find(product => product.id === activeAssistantContextId) || assistantProducts[0];
    const context = [
      profile?.companyProduct && `Company/product: ${profile.companyProduct}`,
      profile?.idealCustomerProfile && `Ideal customer profile: ${profile.idealCustomerProfile}`,
      profile?.valueProposition && `Value proposition: ${profile.valueProposition}`,
      profile?.writingStyle && `Writing style: ${profile.writingStyle}`,
      profile?.claimsToAvoid && `Claims to avoid: ${profile.claimsToAvoid}`,
      activeAssistantChat?.chatInstructions && `Instructions for this chat: ${activeAssistantChat.chatInstructions}`,
      data.assistantMemory?.writingStyle && `Saved writing style: ${data.assistantMemory.writingStyle}`,
      data.assistantMemory?.territory && `Saved territory: ${data.assistantMemory.territory}`,
      data.assistantMemory?.targetAudience && `Saved target audience: ${data.assistantMemory.targetAudience}`,
      data.assistantMemory?.customInstructions && `Saved personal preferences: ${data.assistantMemory.customInstructions}`,
    ].filter(Boolean);
    return context.length ? `${prompt}\n\nUse this context from the prototype for this request:\n${context.join("\n")}` : prompt;
  };
  const runApolloAssistantAction = async (chatId, messageId, action) => {
    updateAssistantChat(chatId, chat => ({
      ...chat,
      messages: chat.messages.map(message => message.id !== messageId ? message : { ...message, apolloAction: { ...action, status: "starting" } }),
      apolloTaskStatus: "starting",
      apolloPollError: "",
      updatedAt: new Date().toISOString(),
    }));
    try {
      const response = await fetch("/api/apollo/assistant/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(action.taskId ? { taskId: action.taskId } : {}), instruction: action.instruction }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Apollo Assistant could not start this task.");
      updateAssistantChat(chatId, chat => {
        const next = appendApolloAssistantMessages(chat, payload);
        next.messages = next.messages.map(message => message.id !== messageId ? message : {
          ...message,
          apolloAction: { ...action, status: "sent", taskId: payload.task_id || action.taskId || null },
        });
        return next;
      });
      if (action.agentType) setData(current => ({
        ...current,
        assistantAgents: (current.assistantAgents || seed.assistantAgents).map(agent => agent.type === action.agentType
          ? { ...agent, lastRunAt: new Date().toISOString(), lastRunType: "Apollo Assistant" }
          : agent),
      }));
    } catch (error) {
      updateAssistantChat(chatId, chat => ({
        ...chat,
        apolloTaskStatus: action.taskId ? "complete" : null,
        messages: chat.messages.map(message => message.id !== messageId ? message : {
          ...message,
          apolloAction: { ...action, status: "error", error: error instanceof Error ? error.message : "Apollo Assistant could not start this task." },
        }),
        updatedAt: new Date().toISOString(),
      }));
    }
  };
  useEffect(() => {
    const chat = activeAssistantChat;
    if (!apolloConfigured || !chat?.apolloTaskId || chat.apolloTaskStatus !== "running") return;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/apollo/assistant/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: chat.apolloTaskId, ...(chat.apolloCursor == null ? {} : { cursor: chat.apolloCursor }) }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Could not check Apollo Assistant progress.");
        updateAssistantChat(chat.id, current => appendApolloAssistantMessages(current, payload));
      } catch (error) {
        updateAssistantChat(chat.id, current => ({
          ...current,
          apolloPollError: error instanceof Error ? error.message : "Could not check Apollo Assistant progress.",
          apolloPolledAt: Date.now(),
        }));
      }
    }, Math.max(3_000, Number(chat.apolloPollAfterMs) || 10_000));
    return () => window.clearTimeout(timer);
  }, [apolloConfigured, activeAssistantChat?.id, activeAssistantChat?.apolloTaskId, activeAssistantChat?.apolloTaskStatus, activeAssistantChat?.apolloCursor, activeAssistantChat?.apolloPollAfterMs, activeAssistantChat?.apolloPolledAt]);
  const toolbarRef = useRef(null);
  useEffect(() => {
    try { localStorage.setItem("apollo-workspace-state", JSON.stringify(data)); } catch { /* Keep the workspace usable if browser storage is full. */ }
    onWorkspaceChange?.({ ...data, people, notificationsEnabled, onboardingCompleted: onboardingStatus(data).filter(Boolean).length });
  }, [data, notificationsEnabled, onWorkspaceChange]);
  useEffect(() => {
    try {
      localStorage.setItem("apollo-prototype-saved-people", JSON.stringify(data.savedPeople));
      window.dispatchEvent(new CustomEvent("apollo:saved-people", { detail: data.savedPeople }));
    } catch { /* Keep workspace people available for this session if browser storage is unavailable. */ }
  }, [data.savedPeople]);
  useEffect(() => { try { localStorage.setItem("apollo-notifications-enabled", String(notificationsEnabled)); } catch { /* Keep the preference in memory. */ } }, [notificationsEnabled]);
  useEffect(() => {
    try {
      const chats = [...assistantConversation.chats].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 20);
      localStorage.setItem("apollo-assistant-chats", JSON.stringify(chats));
      localStorage.setItem("apollo-assistant-messages", JSON.stringify(assistantMessages.slice(-100)));
    } catch { /* Keep the current conversation available for this session. */ }
  }, [assistantConversation, assistantMessages]);
  const previousModule = useRef(module);
  useEffect(() => {
    if (previousModule.current === module) return;
    previousModule.current = module;
    if (preserveDialogOnModuleChange.current) preserveDialogOnModuleChange.current = false;
    else setDialog("");
    setEnrollmentRequest(null);
    setSelected(pendingFollowUpRef.current); pendingFollowUpRef.current = null;
    setSelectedRows([]); setFilterOpen(false); setSortOpen(false);
  }, [module]);
  useEffect(() => {
    if (module !== "Assistant") return;
    try {
      const pendingPrompt = localStorage.getItem("apollo-assistant-prefill");
      if (pendingPrompt) { setAssistantInput(pendingPrompt); localStorage.removeItem("apollo-assistant-prefill"); }
    } catch { /* Keep the assistant usable when browser storage is unavailable. */ }
  }, [module]);
  useEffect(() => {
    if (module !== "Workflows") return;
    try {
      const action = localStorage.getItem("apollo-workflow-prefill");
      if (!action) return;
      localStorage.removeItem("apollo-workflow-prefill");
      const target = action === "Add contact to a list" ? data.lists.find(list => list.type === "People")?.name : data.sequences[0]?.name;
      setFormName(action === "Enroll contact in a sequence" ? "Enroll new list contacts in a sequence" : action === "Add contact to a list" ? "Add contacts to another list" : "Follow up with new list contacts");
      setFormTrigger("Contact added to list");
      setWorkflowAction(action);
      setWorkflowTarget(target || "");
      setFormDetail("");
      setDialog("create");
    } catch { /* Keep navigation available if storage is unavailable. */ }
  }, [module]);
  useEffect(() => {
    const closeMenus = event => {
      if (!toolbarRef.current?.contains(event.target)) { setFilterOpen(false); setSortOpen(false); }
    };
    document.addEventListener("pointerdown", closeMenus);
    return () => document.removeEventListener("pointerdown", closeMenus);
  }, []);

  const handledNavigationRequest = useRef(null);
  useEffect(() => {
    if (!navigationRequest || navigationRequest.module !== module || handledNavigationRequest.current === navigationRequest.requestId) return;
    handledNavigationRequest.current = navigationRequest.requestId;
    onNavigationHandled?.(navigationRequest.requestId);
    if (navigationRequest.workflowAction) {
      const action = navigationRequest.workflowAction;
      setFormName(action === "Enroll contact in a sequence" ? "Enroll new list contacts in a sequence" : action === "Add contact to a list" ? "Add contacts to another list" : "Follow up with new list contacts");
      setFormTrigger("Contact added to list"); setWorkflowAction(action);
      setWorkflowTarget((action === "Add contact to a list" ? data.lists.find(list => list.type === "People") : data.sequences[0])?.name || "");
      setFormDetail(""); setDialog("create"); return;
    }
    if (navigationRequest.prompt) { startAssistantChat(); setAssistantView("Chat"); setAssistantInput(navigationRequest.prompt); return; }
    if (navigationRequest.settingsTab) { setSettingsTab(navigationRequest.settingsTab); return; }
    const source = navigationRequest.collection === "contacts" ? workspaceContacts({ ...data, people }) : data[navigationRequest.collection] || [];
    const record = source.find(item => workspaceRecordKey(item) === navigationRequest.key || (navigationRequest.collection === "contacts" && item.name === navigationRequest.record?.name));
    if (record) {
      setSelected(record);
      if (navigationRequest.collection === "emails" && record.unread) setData(current => ({ ...current, emails: current.emails.map(email => workspaceRecordKey(email) === workspaceRecordKey(record) ? { ...email, unread: false } : email) }));
    }
    else notify("That record is no longer in this workspace.");
  }, [navigationRequest?.requestId, module]);

  const titleByModule = {
    Home: "Home", Assistant: "AI Assistant", Companies: "Companies", Lists: "Lists", Settings: "Admin settings", "Data enrichment": "Data enrichment",
    Sequences: "Sequences", Emails: "Emails", Calls: "Calls", Tasks: "Tasks", Meetings: "Meetings",
    Conversations: "Conversations", Deals: "Deals", Workflows: "Workflows", Analytics: "Analytics",
  };
  const title = titleByModule[module] || module;
  useEffect(() => { document.title = `${title} | Apollo`; }, [title]);
  const openAssistantWithPrompt = (prompt, actionScope = null) => {
    startAssistantChat({ actionScope: actionScope ? { ...actionScope, prompt } : null });
    setAssistantInput(prompt);
    setAssistantView("Chat");
    onNavigate("AI Assistant");
  };
  useEffect(() => {
    const input = assistantComposerRef.current;
    if (!input) return;
    input.style.height = "0px";
    input.style.height = `${Math.min(200, Math.max(34, input.scrollHeight))}px`;
  }, [assistantInput, module, assistantView]);
  useEffect(() => { setSelectedRows([]); }, [query, filterValue, tab]);
  const openRelatedRecord = (record, targetModule) => {
    if (targetModule === "Emails" && record.unread) setData(current => ({ ...current, emails: current.emails.map(email => workspaceRecordKey(email) === workspaceRecordKey(record) ? { ...email, unread: false } : email) }));
    if (module === targetModule) setSelected(record);
    else { pendingFollowUpRef.current = record; onNavigate(targetModule); }
  };
  const resetView = () => { setQuery(""); setFilterValue("All records"); setTab(defaultWorkspaceView(module).tab); setSelectedRows([]); };
  const renderEmptyState = () => <div className="wm-empty wm-empty-state"><Search size={22}/><strong>No records in this view</strong><span>{query.trim() ? `No matches for “${query.trim()}”. Try another name or keyword.` : "Try a different tab or clear the filters to see more records."}</span><button className="wm-outline" onClick={resetView}>Clear search and filters</button></div>;
  const quickAdd = () => { setFormName(""); setFormDetail(""); if (module === "Lists") setListType("People"); if (module === "People") { setContactTitle(""); setContactCompany(""); setContactEmail(""); setContactPhone(""); setContactLinkedIn(""); setContactLocation(""); } if (module === "Companies") { setCompanyDomain(""); setCompanyIndustry(""); setCompanyEmployees(""); setCompanyLocation(""); setCompanyStatus("Target"); } if (module === "Tasks") { setTaskDueDate(localDateValue()); setTaskType("Follow-up"); } if (module === "Meetings") { setMeetingStart(nextMeetingStart()); setMeetingDuration("30"); } if (module === "Sequences") setSequenceSteps(starterSequenceSteps()); if (module === "Workflows") { setFormTrigger("Contact added to list"); setWorkflowAction("Create follow-up task"); setWorkflowTarget(""); setFormDetail("Follow up with {{contact}} from {{list}}"); setWorkflowTaskDue("Today"); } if (module === "Deals") { setFormDetail(data.companies[0]?.name || ""); setDealAmount("25000"); setDealStageValue("Qualification"); setDealCloseDate(defaultDealCloseDate()); setDealOwner("Robert Berry"); } setDialog("create"); };
  const startCreateList = type => { setFormName(""); setFormDetail(""); setListType(type); setDialog("create"); };
  const closeDialog = () => { setDialog(""); setFormName(""); setFormDetail(""); setFormBody(""); setEmailDraftEditing(null); setContactEditTarget(null); };
  const openContactEditor = person => {
    if (person?.source !== "local") return;
    setContactEditTarget({ id: person.id || "", name: person.name });
    setFormName(person.name || "");
    setContactTitle(person.title && person.title !== "Title unavailable" ? person.title : person.role || "");
    setContactCompany(person.company && person.company !== "Company unavailable" ? person.company : "");
    setContactEmail(person.email || "");
    setContactPhone(person.phone || "");
    setContactLinkedIn(person.linkedinUrl || "");
    setContactLocation(person.location && person.location !== "Location unavailable" ? person.location : "");
    setSelected(null);
    setDialog("edit-contact");
  };
  const openSelectedEmailDraft = () => {
    const contact = workspacePeople.find(person => person.name === selected?.recipient);
    setEmailDraftEditing(selected?.id || null);
    setFormName(selected?.to || contact?.email || "");
    setFormDetail(selected?.subject || "");
    setFormBody(selected?.body || "");
    setSelected(null);
    setDialog("compose");
  };
  useDialogFocus(dialog || (selected ? "record" : ""), ".wm-modal-backdrop > .wm-modal, .wm-modal-backdrop > .wm-detail-drawer", () => dialog ? closeDialog() : setSelected(null));
  const exportWorkspace = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), workspace: data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `apollo-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Workspace data exported as JSON");
  };
  const exportCurrentModuleCsv = () => {
    const exportConfig = {
      Companies: [apolloCompanyResults ?? data.companies, ["name", "domain", "industry", "employees", "location", "people", "status", "website", "annualRevenue", "totalFunding", "latestFundingStage", "foundedYear", "record_source"]],
      Lists: [data.lists, ["name", "type", "count", "updated", "description", "members", "record_source"]],
      Sequences: [data.sequences, ["name", "status", "people", "replies", "steps", "owner", "enrolledPeople", "record_source"]],
      Tasks: [data.tasks, ["title", "person", "due", "type", "assignedTo", "done", "taskStatus", "record_source"]],
      Deals: [data.deals, ["name", "company", "amount", "stage", "close", "owner", "record_source"]],
      Meetings: [data.meetings, ["title", "person", "time", "duration", "type", "status", "record_source"]],
      Emails: [data.emails, ["from", "subject", "preview", "time", "folder", "unread", "record_source"]],
      Calls: [data.calls, ["person", "company", "time", "duration", "outcome", "note", "record_source"]],
      Conversations: [data.recordings, ["title", "person", "date", "duration", "sentiment", "summary", "record_source"]],
      Workflows: [data.workflows, ["name", "trigger", "status", "runs", "localRuns", "action", "taskTitle", "due", "record_source"]],
      "Data enrichment": [workspacePeople, ["name", "title", "company", "email", "phone", "linkedinUrl", "location", "status", "owner", "record_source", "enrichedAt", "aiResearchUpdatedAt"]],
    };
    const config = exportConfig[module];
    if (!config) return;
    const [records, fields] = config;
    const available = filtered(recordsInWorkspaceTab(records, module, tab, localDateValue()), fields);
    const selected = selectedRows.length
      ? available.filter(row => selectedRows.includes(workspaceSelectionKey(row, module)))
      : available;
    if (!selected.length) { notify("No matching records to export"); return; }
    const csvCell = value => {
      const raw = Array.isArray(value) ? value.join("; ") : value && typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
      const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const csvValue = (row, field) => field !== "record_source" ? row[field]
      : module === "Companies" ? companySourceLabel(row)
        : module === "Sequences" ? sequenceSourceLabel(row)
          : module === "Lists" ? listSourceLabel(row)
            : module === "Emails" ? emailSourceLabel(row) : activitySourceLabel(row);
    const csv = [fields.map(csvCell).join(","), ...selected.map(row => fields.map(field => csvCell(csvValue(row, field))).join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `apollo-${module.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Exported ${selected.length} ${module.toLowerCase()} record${selected.length === 1 ? "" : "s"} as CSV`);
  };
  const importCompaniesCsv = async event => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const rows = parseCsvRows(await file.text());
      if (rows.length < 2) { notify("The CSV has no company rows"); return; }
      const headers = rows[0].map(value => value.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
      const findColumn = (...aliases) => headers.findIndex(header => aliases.includes(header));
      const at = (values, index) => index < 0 ? "" : String(values[index] || "").trim();
      const nameIndex = findColumn("name", "company", "companyname", "organization", "organizationname", "account", "accountname");
      const domainIndex = findColumn("domain", "companydomain", "website", "websiteurl", "primarydomain");
      if (nameIndex < 0 && domainIndex < 0) { notify("CSV needs a Company, Name, or Domain column"); return; }
      const industryIndex = findColumn("industry", "companyindustry");
      const employeesIndex = findColumn("employees", "employeecount", "estimatednumemployees", "headcount");
      const locationIndex = findColumn("location", "headquarters", "hq", "address", "rawaddress");
      const statusIndex = findColumn("status", "accountstatus");
      const domainValue = value => String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
      const imported = rows.slice(1).map(values => {
        const name = at(values, nameIndex) || domainValue(at(values, domainIndex));
        if (!name) return null;
        const status = at(values, statusIndex);
        return {
          name,
          domain: domainValue(at(values, domainIndex)),
          industry: at(values, industryIndex) || "—",
          employees: at(values, employeesIndex) || "—",
          location: at(values, locationIndex) || "—",
          people: 0,
          status: ["Target", "Working", "New"].includes(status) ? status : "Target",
          source: "csv-import",
        };
      }).filter(Boolean);
      const existingNames = new Set(data.companies.map(company => String(company.name || "").trim().toLowerCase()));
      const existingDomains = new Set(data.companies.map(company => domainValue(company.domain)).filter(Boolean));
      const unique = imported.filter(company => {
        const name = company.name.toLowerCase();
        const domain = company.domain;
        if (existingNames.has(name) || (domain && existingDomains.has(domain))) return false;
        existingNames.add(name);
        if (domain) existingDomains.add(domain);
        return true;
      });
      const skipped = imported.length - unique.length;
      if (!unique.length) { notify(imported.length ? `No new companies to import · ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped` : "No company names or domains found in the CSV"); return; }
      setData(current => ({ ...current, companies: [...unique, ...current.companies] }));
      setApolloCompanyResults(null);
      setTab("All companies");
      setSelectedRows([]);
      notify(`Imported ${unique.length} compan${unique.length === 1 ? "y" : "ies"}${skipped ? ` · ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped` : ""} from ${file.name}`);
    } catch {
      notify("Could not read this CSV file");
    }
  };
  const saveNewItem = () => {
    const name = formName.trim(); if (!name) return;
    const linkedinUrl = module === "People" ? normalizeLinkedInUrl(contactLinkedIn) : "";
    if (linkedinUrl === null) { notify("Enter a valid LinkedIn profile or company URL"); return; }
    if (module === "People" && workspacePeople.some(person => person.name.toLowerCase() === name.toLowerCase())) { notify(`${name} is already in this workspace`); return; }
    const namedCollection = { Lists: "lists", Sequences: "sequences", Companies: "companies" }[module];
    if (namedCollection && data[namedCollection].some(item => item.name.trim().toLowerCase() === name.toLowerCase())) { notify(`A ${module === "Companies" ? "company" : module === "Sequences" ? "sequence" : "list"} named “${name}” already exists. Choose a different name.`); return; }
    setData(current => {
      const next = { ...current };
      if (module === "People") {
        const companyName = contactCompany.trim();
        const person = { id: `local:${crypto.randomUUID()}`, name, title: contactTitle.trim() || "Title unavailable", company: companyName || "Company unavailable", email: contactEmail.trim(), phone: contactPhone.trim(), linkedinUrl, location: contactLocation.trim() || "Location unavailable", status: contactEmail.trim() ? "Added manually" : "Unavailable", owner: "Robert Berry", source: "local" };
        next.savedPeople = [person, ...current.savedPeople];
        if (companyName && !current.companies.some(company => company.name.toLowerCase() === companyName.toLowerCase())) next.companies = [{ name: companyName, domain: "", industry: "—", employees: "—", location: contactLocation.trim() || "—", people: 1, status: "New", source: "local" }, ...current.companies];
      }
      if (module === "Lists") next.lists = [{ name, type: listType, count: 0, updated: "Just now", description: formDetail || (listType === "Companies" ? "New company list" : "New prospect list"), members: [], source: "local" }, ...current.lists];
      if (module === "Sequences") next.sequences = [{ name, status: "Draft", people: 0, replies: 0, steps: sequenceSteps.length, stepPlan: sequenceSteps, enrolledPeople: [], owner: "Robert Berry", source: "local" }, ...current.sequences];
      if (module === "Tasks") next.tasks = [{ title: name, person: formDetail || "Unassigned", due: formatTaskDue(taskDueDate), dueDate: taskDueDate, type: taskType, done: false, source: "local" }, ...current.tasks];
      if (module === "Meetings") {
        const scheduled = new Date(`${meetingStart.date}T${meetingStart.time}`);
        const displayDate = scheduled.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        const displayTime = scheduled.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        next.meetings = [{ title: name, person: formDetail || "Unassigned", time: `${displayDate} · ${displayTime}`, duration: `${meetingDuration} min`, type: "Video call", past: scheduled < new Date(), scheduledAt: scheduled.toISOString(), source: "local" }, ...current.meetings];
      }
      if (module === "Deals") {
        const date = new Date(`${dealCloseDate}T12:00:00`);
        const close = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        next.deals = [{ name, company: formDetail, amount: Number(dealAmount), stage: dealStageValue, close, closeDate: dealCloseDate, owner: dealOwner, source: "local" }, ...current.deals];
      }
      if (module === "Workflows") next.workflows = [{ name, status: "Draft", trigger: formTrigger, action: workflowAction, targetName: workflowTarget, taskTitle: workflowAction === "Create follow-up task" ? formDetail.trim() || "Follow up with {{contact}}" : "", due: workflowTaskDue, runs: 0, source: "local" }, ...(current.workflows || [])];
      if (module === "Companies") next.companies = [{ name, domain: companyDomain.trim(), industry: companyIndustry.trim() || "—", employees: companyEmployees.trim() || "—", location: companyLocation.trim() || "—", people: 0, status: companyStatus, source: "local" }, ...(current.companies || [])];
      return next;
    });
    notify(module === "People" ? `${name} added to People` : `${name} created`); closeDialog();
  };
  const saveLocalContactEdits = () => {
    if (!contactEditTarget) return;
    const original = data.savedPeople.find(person => (contactEditTarget.id ? person.id === contactEditTarget.id : person.name === contactEditTarget.name) && person.source === "local");
    if (!original) { notify("This local contact is no longer available. Nothing was changed."); closeDialog(); return; }
    const name = formName.trim();
    const title = contactTitle.trim() || "Title unavailable";
    const company = contactCompany.trim() || "Company unavailable";
    const email = contactEmail.trim().toLowerCase();
    const phone = contactPhone.trim();
    const linkedinUrl = normalizeLinkedInUrl(contactLinkedIn);
    const location = contactLocation.trim() || "Location unavailable";
    if (linkedinUrl === null) { notify("Enter a valid LinkedIn profile or company URL"); return; }
    const isOriginal = person => original.id ? person.id === original.id : person.name === original.name;
    const duplicateName = workspacePeople.some(person => !isOriginal(person) && person.name.trim().toLowerCase() === name.toLowerCase());
    if (duplicateName) { notify(`A contact named “${name}” already exists`); return; }
    const duplicateEmail = email && workspacePeople.some(person => !isOriginal(person) && String(person.email || "").trim().toLowerCase() === email);
    if (duplicateEmail) { notify("That email address already belongs to another contact"); return; }
    const now = new Date().toISOString();
    const emailChanged = email !== String(original.email || "").trim().toLowerCase();
    const updatedPerson = { ...original, name, title, role: title, company, email, phone, linkedinUrl, location, status: email ? emailChanged ? "Added manually" : original.status || "Added manually" : "Unavailable", initials: name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase(), localUpdatedAt: now, source: "local" };
    const companyExists = company !== "Company unavailable" && data.companies.some(item => item.name.trim().toLowerCase() === company.toLowerCase());
    const linkedCompany = original.company && original.company !== "Company unavailable" ? original.company : "";
    const companyChanged = linkedCompany.toLowerCase() !== company.toLowerCase();
    setData(current => {
      const replaceName = value => value === original.name ? name : value;
      const updateLocalActivity = records => records.map(record => {
        if (record.source !== "local" || record.person !== original.name) return record;
        const next = { ...record, person: name };
        if (companyChanged && record.company === linkedCompany && company !== "Company unavailable") next.company = company;
        if (record.title?.includes(original.name)) next.title = record.title.replaceAll(original.name, name);
        return next;
      });
      const updatedLists = current.lists.map(list => list.type === "People" && (list.members || []).includes(original.name)
        ? { ...list, members: list.members.map(replaceName) }
        : list);
      const updatedSequences = current.sequences.map(sequence => (sequence.enrolledPeople || []).includes(original.name)
        ? updateSequenceEnrollment(sequence, sequence.enrolledPeople.map(replaceName))
        : sequence);
      const companies = !companyExists && company !== "Company unavailable"
        ? [{ name: company, domain: "", industry: "—", employees: "—", location: location === "Location unavailable" ? "—" : location, people: 1, status: "New", source: "local" }, ...current.companies]
        : current.companies;
      return {
        ...current,
        savedPeople: current.savedPeople.map(person => isOriginal(person) ? updatedPerson : person),
        companies,
        lists: updatedLists,
        sequences: updatedSequences,
        tasks: updateLocalActivity(current.tasks),
        meetings: updateLocalActivity(current.meetings),
        calls: updateLocalActivity(current.calls),
        recordings: updateLocalActivity(current.recordings),
        emails: current.emails.map(email => {
          if (email.source !== "local" || email.recipient !== original.name) return email;
          const updated = { ...email, recipient: name };
          const oldEmail = String(original.email || "").trim().toLowerCase();
          const draftAddress = String(email.to || "").trim().toLowerCase();
          if (emailChanged && (!draftAddress || (oldEmail && draftAddress === oldEmail))) {
            updated.recipientNeedsReview = true;
            updated.recipientReviewReason = "changed";
          }
          return updated;
        }),
      };
    });
    setSelected(null);
    closeDialog();
    notify(`Updated ${name} locally${emailChanged && email ? " · new email is unverified" : ""}`);
  };
  const handleDialogSubmit = event => {
    event.preventDefault();
    if (dialog === "edit-contact") return saveLocalContactEdits();
    if (dialog === "create") return saveNewItem();
    if (dialog === "compose") {
      const existingDraft = data.emails.find(email => email.id === emailDraftEditing);
      const matchedContact = workspacePeople.find(person => person.email && person.email.toLowerCase() === formName.trim().toLowerCase());
      const recipientReviewReason = emailAddressReviewReason(formName);
      const nextDraft = {
        ...(existingDraft || {}),
        id: emailDraftEditing || newEmailId(),
        from: "Robert Berry",
        to: formName.trim(),
        recipient: matchedContact?.name || (existingDraft?.to?.toLowerCase() === formName.trim().toLowerCase() ? existingDraft.recipient : ""),
        subject: formDetail.trim() || "New message",
        preview: formBody.trim().replace(/\s+/g, " ").slice(0, 140) || "No message content yet.",
        body: formBody,
        time: "Just now",
        unread: false,
        folder: "Drafts",
        source: "local",
        recipientNeedsReview: Boolean(recipientReviewReason),
        recipientReviewReason,
      };
      if (emailDraftEditing) setData(current => ({ ...current, emails: current.emails.map(email => email.id === emailDraftEditing ? nextDraft : email) }));
      else setData(current => ({ ...current, emails: [nextDraft, ...current.emails] }));
      notify(emailDraftEditing ? "Local draft updated" : "Email saved as a local draft");
    } else if (dialog === "log-call") {
      const contact = workspacePeople.find(person => person.name === formName);
      setData(current => ({ ...current, calls: [{ person: contact?.name || formName, company: contact?.company || "Company unavailable", time: "Just now", duration: "—", outcome: formDetail || "Connected", note: formBody.trim() || "No notes added.", source: "local" }, ...current.calls] }));
      notify("Call added to activity");
    } else if (dialog === "add-to-list") {
      const requestedNames = [...new Set([...(selectedRows.length ? selectedRows : []), ...(formName.trim() ? [formName.trim()] : [])])];
      const targetName = formDetail.trim();
      if (!requestedNames.length || !targetName) return;
      const targetType = module === "Companies" ? "Companies" : "People";
      const targetList = data.lists.find(list => list.name === targetName && list.type === targetType);
      if (!targetList) { notify(`Choose an existing ${targetType === "Companies" ? "company" : "people"} list.`); return; }
      const candidates = targetType === "Companies" ? data.companies : workspacePeople;
      const names = requestedNames.map(name => candidates.find(record => record.name.toLowerCase() === name.toLowerCase())?.name);
      if (names.some(name => !name)) { notify("Save the missing record in this workspace before adding it to a list."); return; }
      const existingNames = new Set(uniqueListMembers(targetList).map(name => name.toLowerCase()));
      const additions = names.filter(name => !existingNames.has(name.toLowerCase()));
      if (!additions.length) { notify(`All selected ${module === "Companies" ? "accounts" : "prospects"} are already in ${targetName}`); closeDialog(); return; }
      setData(current => {
        const next = { ...current, lists: current.lists.map(list => {
          if (list.name !== targetName || list.type !== targetType) return list;
          const members = uniqueListMembers(list);
          const newMembers = additions.filter(name => !members.includes(name));
          return { ...list, members: [...members, ...newMembers], count: members.length + newMembers.length, updated: newMembers.length ? "Just now" : list.updated };
        }) };
        return module === "Companies" ? next : applyWorkflowEvent(next, "Contact added to list", additions.map(contact => ({ contact, list: targetName })));
      });
      setSelectedRows([]);
      notify(`${additions.length} ${module === "Companies" ? "account" : "prospect"}${additions.length === 1 ? "" : "s"} added to ${targetName}`);
    }
    closeDialog();
  };
  const startAssistantChat = (options = {}) => {
    const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let creditPreference = { limit: null, custom: false };
    try { creditPreference = { ...creditPreference, ...(JSON.parse(localStorage.getItem("apollo-assistant-credit-limit") || "null") || {}) }; } catch { /* Use ask-before-spend by default. */ }
    const chat = { id, ...(options.actionScope ? { actionScope: options.actionScope } : {}), title: "New conversation", updatedAt: new Date().toISOString(), chatInstructions: "", creditLimit: creditPreference.limit, creditLimitCustom: creditPreference.custom, creditUsed: 0, messages: [{ role: "assistant", text: apolloConfigured ? "Hi Robert. What would you like to work on in Apollo? I can prospect, research, engage, analyze, and help manage your workspace." : "Hi Robert. What would you like to work on? I can search demo records, prepare outreach, or review workspace activity." }] };
    setAssistantConversation(current => ({ activeId: id, chats: [chat, ...current.chats].slice(0, 20) }));
    setAssistantInput("");
    setShowAllAssistantPrompts(false);
  };
  const setAssistantChatInstructions = value => setAssistantConversation(current => ({
    ...current,
    chats: current.chats.map(chat => chat.id === current.activeId ? { ...chat, chatInstructions: value, updatedAt: new Date().toISOString() } : chat),
  }));
  const setAssistantChatCreditLimit = (limit, custom = false) => {
    const parsedLimit = limit == null || limit === "" ? null : Math.max(0, Number(limit) || 0);
    setAssistantConversation(current => ({ ...current, chats: current.chats.map(chat => chat.id === current.activeId ? { ...chat, creditLimit: parsedLimit, creditLimitCustom: custom, updatedAt: new Date().toISOString() } : chat) }));
    try { localStorage.setItem("apollo-assistant-credit-limit", JSON.stringify({ limit: parsedLimit, custom })); } catch { /* Keep the chat setting in memory for this session. */ }
  };
  const updateAssistantChatCreditUsage = credits => setAssistantConversation(current => ({
    ...current,
    chats: current.chats.map(chat => chat.id === current.activeId ? { ...chat, creditUsed: Number(chat.creditUsed || 0) + credits, updatedAt: new Date().toISOString() } : chat),
  }));
  const toggleAssistantVoiceInput = () => {
    if (assistantVoiceRecognitionRef.current) {
      assistantVoiceRecognitionRef.current.stop?.();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setAssistantVoiceStatus("Voice dictation is not supported in this browser. You can type your prompt instead.");
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = navigator.language || "en-US";
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onstart = () => {
        setAssistantVoiceListening(true);
        setAssistantVoiceStatus("Listening… your words will be added to the prompt for review.");
      };
      recognition.onresult = event => {
        let finalText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          if (event.results[index].isFinal) finalText += event.results[index][0]?.transcript || "";
        }
        if (finalText.trim()) {
          setAssistantInput(current => `${current}${current.trim() ? " " : ""}${finalText.trim()}`);
          setAssistantVoiceStatus("Transcript added to the prompt. Review it before sending.");
        }
      };
      recognition.onerror = event => {
        const message = event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone access was blocked. Allow microphone access and try again."
          : event.error === "no-speech"
            ? "No speech was detected. Try again when you’re ready."
            : `Voice input stopped${event.error ? ` (${event.error})` : ""}. You can type your prompt instead.`;
        setAssistantVoiceStatus(message);
      };
      recognition.onend = () => {
        assistantVoiceRecognitionRef.current = null;
        setAssistantVoiceListening(false);
      };
      assistantVoiceRecognitionRef.current = recognition;
      setAssistantVoiceStatus("");
      recognition.start();
    } catch {
      assistantVoiceRecognitionRef.current = null;
      setAssistantVoiceListening(false);
      setAssistantVoiceStatus("Voice input could not start. Check microphone access or type your prompt instead.");
    }
  };
  const sendAssistant = event => {
    event?.preventDefault();
    const prompt = assistantInput.trim(); if (!prompt) return;
    const lower = prompt.toLowerCase();
    if (apolloConfigured) {
      if (activeAssistantChat?.apolloTaskStatus === "running" || activeAssistantChat?.messages.some(message => ["pending", "starting"].includes(message.apolloAction?.status))) return;
      const action = {
        id: `apollo-task-${Date.now()}`,
        taskId: activeAssistantChat?.apolloTaskId || null,
        instruction: buildApolloInstruction(prompt),
        status: "pending",
      };
      const actionMessageId = `apollo-action-${Date.now()}`;
      setAssistantMessages(current => [...current,
        { role: "user", text: prompt },
        { role: "assistant", id: actionMessageId, text: action.taskId ? "Review this follow-up before continuing the Apollo Assistant conversation." : "Review this request before sending it to Apollo Assistant.", apolloAction: action },
      ]);
      setAssistantInput("");
      return;
    }
    const memory = data.assistantMemory || seed.assistantMemory;
    const effectiveWritingStyle = findWritingStyle(prompt)
      || findWritingStyle(activeAssistantChat?.chatInstructions)
      || findWritingStyle(memory.writingStyle)
      || findWritingStyle(memory.customInstructions)
      || findWritingStyle(assistantContext.writingStyle);
    const routeNames = { people: "People", prospects: "People", contacts: "People", companies: "Companies", accounts: "Companies", lists: "Lists", tasks: "Tasks", deals: "Deals", pipeline: "Deals", meetings: "Meetings", emails: "Emails", inbox: "Emails", calls: "Calls", sequences: "Sequences", workflows: "Workflows", analytics: "Analytics", enrichment: "Data enrichment" };
    const requestedRoute = Object.entries(routeNames).find(([word]) => new RegExp(`\\b${word}\\b`).test(lower));
    const isTaskQueueSearch = /\b(?:show|list|find|search|view|which|how many|open)\b/.test(lower) && /\btasks?\b/.test(lower);
    const matchedContact = [...people, ...data.savedPeople].find(person => person.name && lower.includes(person.name.toLowerCase()));
    const matchedContacts = [...new Map([...people, ...data.savedPeople]
      .filter(person => person.name && lower.includes(person.name.toLowerCase()))
      .map(person => [person.name.toLowerCase(), person])).values()];
    const matchedCompany = data.companies.find(company => company.name && lower.includes(company.name.toLowerCase()));
    const matchedCompanies = [...new Map(data.companies
      .filter(company => company.name && lower.includes(company.name.toLowerCase()))
      .map(company => [company.name.toLowerCase(), company])).values()];
    const searchingCompanies = /\bcompanies?|accounts?|organizations?|businesses?\b/.test(lower);
    const isAssistantSearchRequest = /\b(find|search|prospect|discover|qualify|identify|match|matches)\b/.test(lower);
    const isPerformanceReportRequest = /\b(?:rep performance|team performance|performance by (?:rep|representative|owner)|by (?:rep|representative|owner)|team average|team's average)\b/.test(lower);
    let reply = "I can answer questions from the records in this browser. Ask about people, pipeline, tasks, meetings, inbox, sequences, or analytics.";
    let creditAction = null;
    let reviewAction = null;
    let reportData = null;
    let nextSteps = null;
    let nextStepsTitle = null;
    const isConversationFollowUp = /\b(?:follow.?up|thank(?:s| you)|following our|after (?:the )?(?:call|meeting|conversation))\b/.test(lower)
      && /\b(?:call|meeting|conversation)\b/.test(lower);
    const isConversationTaskRequest = /\b(?:task|todo|to-do)\b/.test(lower)
      && /\b(?:call|conversation|recording|meeting)\b/.test(lower);
    const contextUpdateMatch = prompt.match(/\b(?:update|change|set|edit)\s+(?:(?:my|our|the)\s+)?(?:(?:ai\s+)?context(?:\s+center)?\s*[,;:]?\s*)?(ideal customer profile|icp|company and product|company\/product|product context|product description|company|product|value proposition|writing style|claims to avoid)\s*(?:to|as|is|:|=)\s*(.+)$/i);
    const isCapabilityQuestion = /\b(?:what can (?:you|luna) do|what can i use (?:luna|apollo) for|how can (?:you|luna) help|show (?:me )?(?:your )?(?:capabilities|examples))\b/.test(lower) || /^help\b/.test(lower);
    const enrollmentScope = activeAssistantChat?.actionScope?.kind === "sequence-enrollment" && activeAssistantChat.actionScope.prompt === prompt ? activeAssistantChat.actionScope : null;
    const scopedEnrollment = enrollmentScope ? resolveEnrollmentScope(enrollmentScope, data, workspacePeople) : null;
    if (scopedEnrollment) {
      if (scopedEnrollment.error) reply = `${scopedEnrollment.error} Choose the current sequence and contacts again.`;
      else if (!scopedEnrollment.people.length) reply = "None of the chosen contacts are eligible now. They may already be enrolled or no longer belong to the source list. No changes were made.";
      else {
        const { people: chosen, sequence, sourceList } = scopedEnrollment;
        const channels = sequenceChannels(sequence);
        const gapsByContact = chosen.map(person => ({ person, missing: sequenceChannelGaps(sequence, person) }));
        const contactsWithGaps = gapsByContact.filter(item => item.missing.length);
        const preview = gapsByContact.map(({ person, missing }) => `${person.name} · ${person.company || "Company unavailable"}${missing.length ? ` · Missing on file: ${missing.join(", ")}` : channels.length ? ` · Channel fields on file: ${channels.join(", ")}` : " · No Email, Call, or LinkedIn fields required"}`).join("\n");
        reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "enroll-people-in-sequence", people: chosen, targetName: sequence.name, ...(sourceList ? { sourceListName: sourceList.name } : {}), label: "Add contacts to sequence plan · local workspace", summary: `${sequence.name} · ${chosen.length} selected contact${chosen.length === 1 ? "" : "s"}`, preview, status: "pending" };
        reply = `Review enrolling exactly ${chosen.length} selected contact${chosen.length === 1 ? "" : "s"}${sourceList ? ` from “${sourceList.name}”` : ""} in “${sequence.name}”. This updates the local sequence plan and saves these contacts; no outreach is sent.${contactsWithGaps.length ? ` ${contactsWithGaps.length} selected contact${contactsWithGaps.length === 1 ? " is" : "s are"} missing saved fields for ${contactsWithGaps.map(item => `${item.person.name} (${item.missing.join(", ")})`).join("; ")}. Field presence does not verify delivery or profile ownership.` : " Channel fields shown as on file are not independently verified."}${scopedEnrollment.excludedCount ? ` ${scopedEnrollment.excludedCount} chosen contacts are no longer eligible and were excluded.` : ""}`;
      }
    } else if (isCapabilityQuestion) {
      reply = apolloConfigured
        ? "I’m connected to Apollo Assistant. Ask me to find and qualify people or companies, research accounts, save prospects to lists, enrich records, build or improve sequences and workflows, draft or send a one-off email, analyze outreach performance, check account usage or mailbox health, or update your AI context. I can also help manage tasks and other Apollo workspace actions when your account and API key allow them.\n\nEvery connected request is shown for review before it is sent to Apollo. Credit use depends on the actions and data returned; enrichment and other data actions may consume credits. Your Apollo permissions and plan still apply.\n\nTry: “Find sales leaders at growing SaaS companies and save the best matches to a list,” “Check my Apollo credit usage and mailbox health,” or “Review my active sequence and suggest one improvement.”"
        : "In this local Luna demo, I can find and qualify sample people or companies against your saved ICP; summarize contacts, accounts, calls, meetings, tasks, and pipeline records; prepare meeting briefs and follow-up suggestions; draft personalized emails and multichannel sequences; create reviewed contacts, companies, deals, tasks, lists, workflows, and CRM updates; and compare sample pipeline or sequence results. Changes appear in review cards before they are applied. Email drafts stay local and are not sent.\n\nTry: “Find SaaS sales leaders,” “Prepare for my meeting with Maya Patel,” “Draft an email for Maya Patel,” or “Create a follow-up task for Maya Patel tomorrow.”\n\nThis browser demo uses sample records and template-based reasoning. Connect an Apollo API key to use Apollo Assistant, live prospect search, enrichment, and Apollo account actions. Local demo schedules run only while this page is open.";
    } else if (/\b(?:how many credits?|credit balance|credits?\s+(?:used|usage|remaining|left)|plan limits?|(?:compare|show|review)\b.{0,35}\bplans?|billing history|invoices?|mailbox health|deliverability status)\b/.test(lower)) {
      reply = "This demo cannot read your Apollo credit balance, plan, billing, or mailbox health. Local sample metrics are not account data. Connect Apollo to ask Luna for your current usage or mailbox status.";
      nextStepsTitle = "Connection settings";
      nextSteps = [{ title: "Review Apollo connection", detail: apolloConfigured ? "Connected account settings" : "This workspace is using local demo data", module: "Settings", targetType: "module", priority: 0 }];
    } else if (contextUpdateMatch) {
      const field = contextUpdateMatch[1].toLowerCase();
      const value = contextUpdateMatch[2].trim().replace(/^["'“]|["'”]$/g, "");
      const fieldKey = field === "icp" || field === "ideal customer profile" ? "idealCustomerProfile"
        : field === "value proposition" ? "valueProposition"
          : field === "writing style" ? "writingStyle"
            : field === "claims to avoid" ? "claimsToAvoid" : "companyProduct";
      const fieldLabel = { idealCustomerProfile: "Ideal customer profile", companyProduct: "Company and product", valueProposition: "Value proposition", writingStyle: "Writing style", claimsToAvoid: "Claims to avoid" }[fieldKey];
      if (!value) reply = `What should I use for ${fieldLabel.toLowerCase()}? Include the value after “to”.`;
      else if (value === String(assistantContext[fieldKey] || "").trim()) reply = `${fieldLabel} for ${assistantContext.name || "the selected product"} already has that value; I left it unchanged.`;
      else {
        reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "update-ai-context", productId: activeAssistantContextId, productName: assistantContext.name || "the selected product", fieldKey, fieldLabel, previousValue: String(assistantContext[fieldKey] || "").trim(), value, label: "Update AI context · local workspace", summary: `${fieldLabel} · ${value.slice(0, 160)}${value.length > 160 ? "…" : ""}`, status: "pending" };
        reply = `Review updating ${fieldLabel.toLowerCase()} for ${assistantContext.name || "the selected product"}. I’ll change only this field after you apply it.`;
      }
    } else if (/\b(?:update|change|set|edit)\b/i.test(prompt) && /\bcustom\s+field\b/i.test(prompt)) {
      const customFieldMatch = prompt.match(/\b(?:update|change|set|edit)\s+(.+?)\s+custom\s+field\s+["'“]([^"'”]+)["'”]\s+(?:to|as|=)\s*(.+)$/i);
      if (!customFieldMatch) reply = "Name the contact, company, or deal, the exact custom field in quotes, and its new value. For example: ‘Update Ethan Chen’s contact custom field “Buyer requirements” to technical and security information.’";
      else {
        const rawEntity = customFieldMatch[1].trim();
        const explicitType = rawEntity.match(/\b(contact|person|company|account|deal|opportunity)\b/i)?.[1]?.toLowerCase();
        const entityText = rawEntity.replace(/\b(?:contact|person|company|account|deal|opportunity)\b/gi, " ").replace(/[’']s\b/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();
        const fieldName = customFieldMatch[2].trim();
        const value = customFieldMatch[3].trim().replace(/[.!?]+$/, "").replace(/^['"“]|['"”]$/g, "");
        const candidateTypes = explicitType && /contact|person/.test(explicitType) ? ["contact"] : explicitType && /company|account/.test(explicitType) ? ["company"] : explicitType ? ["deal"] : ["contact", "company", "deal"];
        const candidates = candidateTypes.flatMap(type => {
          const records = type === "contact" ? [...data.savedPeople, ...people] : type === "company" ? data.companies : data.deals;
          return records.filter(record => record.name && entityText.includes(record.name.toLowerCase())).map(record => ({ type, record }));
        }).filter((candidate, index, all) => all.findIndex(other => other.type === candidate.type && other.record.name === candidate.record.name) === index);
        if (!entityText) reply = "Name the exact record whose custom field you want to update.";
        else if (candidates.length !== 1) reply = candidates.length > 1 ? `I found multiple records matching “${entityText}.” Specify whether you mean a contact, company, or deal, and include the exact deal name if needed.` : `I couldn't match “${entityText}” to a contact, company, or deal in this workspace.`;
        else if (!value) reply = `What value should I use for “${fieldName}”?`;
        else {
          const { type: recordType, record } = candidates[0];
          const previousValue = String(record.customFields?.[fieldName] || "").trim();
          if (previousValue === value) reply = `“${fieldName}” on ${record.name} already has that value; I left it unchanged.`;
          else {
            reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "update-custom-field", recordType, recordName: record.name, fieldName, previousValue, value, label: `Update ${recordType} custom field · local workspace`, summary: `${record.name} · ${fieldName}: ${previousValue || "(empty)"} → ${value}`, preview: `${record.name} · ${recordType}\nCustom field: ${fieldName}\n${previousValue || "(empty)"} → ${value}`, status: "pending" };
            reply = `Review updating “${fieldName}” on ${record.name}. I’ll change only this custom field after you apply it.`;
          }
        }
      }
    } else if (/\b(?:update|change|set|edit)\b/i.test(prompt) && /\b(?:title|role|company|email|location|industry|domain|employees?|employee count|status|deal stage|stage|deal amount|amount|value|close date|owner)\b/i.test(prompt)) {
      const recordUpdateMatch = prompt.match(/\b(?:update|change|set|edit)\s+(.+?)(?:['’]s)?\s+(deal stage|stage|deal amount|amount|value|close date|owner|title|role|company|email|location|industry|domain|employee count|employees|status)\s+(?:to|as|=)\s*(.+)$/i);
      if (!recordUpdateMatch) reply = "Tell me which contact, company, or deal to update, which field, and the new value. For example: ‘Update the Northstar Labs deal stage to Proposal.’";
      else {
        const entityText = recordUpdateMatch[1].trim().replace(/^(?:the\s+)?(?:contact|person|company|account|deal|opportunity)\s+/i, "").replace(/[’']s$/i, "").replace(/\b(?:deal|opportunity)\b/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();
        const field = recordUpdateMatch[2].toLowerCase();
        let value = recordUpdateMatch[3].trim().replace(/[.!?]+$/, "").replace(/^['"“]|['"”]$/g, "");
        const person = [...data.savedPeople, ...people].find(item => item.name && entityText.includes(item.name.toLowerCase()));
        const company = data.companies.find(item => item.name && entityText.includes(item.name.toLowerCase()));
        const matchingDeals = data.deals.filter(item => item.name && (entityText.includes(item.name.toLowerCase()) || (item.company && entityText.includes(item.company.toLowerCase()))));
        const isPersonField = ["title", "role", "company", "email", "location"].includes(field);
        const isCompanyField = ["industry", "domain", "employee count", "employees", "location", "status"].includes(field);
        const isDealField = ["stage", "deal stage", "amount", "deal amount", "value", "close date", "owner"].includes(field);
        const recordType = isDealField && matchingDeals.length === 1 ? "deal" : person && isPersonField ? "person" : company && isCompanyField ? "company" : null;
        const record = recordType === "deal" ? matchingDeals[0] : recordType === "person" ? person : recordType === "company" ? company : null;
        const fieldKey = field === "role" ? "title" : field === "employee count" || field === "employees" ? "employees" : ["deal stage", "stage"].includes(field) ? "stage" : ["deal amount", "value"].includes(field) ? "amount" : field === "close date" ? "close" : field;
        const fieldLabel = field === "employee count" || field === "employees" ? "Employee count" : fieldKey === "close" ? "Close date" : fieldKey === "amount" ? "Amount" : fieldKey === "stage" ? "Stage" : fieldKey[0].toUpperCase() + fieldKey.slice(1);
        if (isDealField && matchingDeals.length > 1) reply = `I found ${matchingDeals.length} deals for that company. Name the specific deal so I update the right one.`;
        else if (!record) reply = "I couldn't match that record and field in the local workspace. Use a contact title/company/email/location field, a company industry/domain/employee count/location/status field, or a deal stage/amount/close date/owner field.";
        else if (!value) reply = `What should ${record.name}'s ${fieldLabel.toLowerCase()} be?`;
        else if (recordType === "deal" && fieldKey === "amount" && !/^\$?\d+(?:\.\d+)?\s*[km]?$/i.test(value.replace(/,/g, "").trim())) reply = "Enter a numeric deal amount, such as $48000, $48k, or $1.2m.";
        else if (recordType === "deal" && fieldKey === "stage" && !["Qualification", "Discovery", "Proposal", "Negotiation", "Closed won", "Closed lost"].some(stage => stage.toLowerCase() === value.toLowerCase())) reply = "Choose one of the available deal stages: Qualification, Discovery, Proposal, Negotiation, Closed won, or Closed lost.";
        else {
          if (recordType === "deal" && fieldKey === "stage") value = ["Qualification", "Discovery", "Proposal", "Negotiation", "Closed won", "Closed lost"].find(stage => stage.toLowerCase() === value.toLowerCase());
          if (recordType === "deal" && fieldKey === "amount") {
            const amountMatch = value.replace(/,/g, "").trim().match(/^\$?(\d+(?:\.\d+)?)\s*([km])?$/i);
            value = Math.round(Number(amountMatch[1]) * (amountMatch[2]?.toLowerCase() === "m" ? 1000000 : amountMatch[2]?.toLowerCase() === "k" ? 1000 : 1));
          }
          const previousValue = String(record[fieldKey] ?? "").trim();
          const displayValue = candidate => fieldKey === "amount" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(candidate) : candidate;
          if (previousValue === String(value)) reply = `${record.name}'s ${fieldLabel.toLowerCase()} already has that value; I left it unchanged.`;
          else {
            reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "update-record", recordType, recordName: record.name, fieldKey, fieldLabel, previousValue, value, label: `Update ${recordType === "person" ? "contact" : recordType === "deal" ? "deal" : "company"} · local workspace`, summary: `${record.name} · ${fieldLabel}: ${displayValue(record[fieldKey] || "(empty)")} → ${displayValue(value)}`, preview: `${fieldLabel}\n${displayValue(record[fieldKey] || "(empty)")} → ${displayValue(value)}`, status: "pending" };
            reply = `Review updating ${record.name}'s ${fieldLabel.toLowerCase()} from ${displayValue(record[fieldKey] || "(empty)")} to ${displayValue(value)}.`;
          }
        }
      }
    } else if (/^(forget|clear) (my )?(assistant )?memory\b/i.test(prompt)) {
      setData(current => ({ ...current, assistantMemory: { ...seed.assistantMemory } }));
      reply = "Cleared your saved personal assistant memory. Product contexts and chat-specific instructions are unchanged.";
    } else if (/^(remember|save (this )?(as a )?preference|going forward|from now on|for future chats)\b/i.test(prompt)) {
      const instruction = prompt.replace(/^(remember|save (this )?(as a )?preference|going forward|from now on|for future chats)( that)?\s*[:,-]?\s*/i, "").trim();
      if (!instruction) reply = "What would you like me to remember? You can include your writing style, territory, or target audience.";
      else {
        const styleMatch = instruction.match(/(?:writing style|email style|tone|emails? should be|outreach should be)\s*(?:is|should be|:)?\s*([^.;]+)/i);
        const territoryMatch = instruction.match(/territory\s*(?:is|:)?\s*([^.;]+)/i);
        const audienceMatch = instruction.match(/(?:target audience|audience)\s*(?:is|:)?\s*([^.;]+)/i);
        setData(current => {
          const currentMemory = current.assistantMemory || seed.assistantMemory;
          return { ...current, assistantMemory: {
            ...currentMemory,
            ...(findWritingStyle(instruction) ? { writingStyle: styleMatch?.[1]?.trim() || findWritingStyle(instruction) } : {}),
            ...(territoryMatch ? { territory: territoryMatch[1].trim() } : {}),
            ...(audienceMatch ? { targetAudience: audienceMatch[1].trim() } : {}),
            customInstructions: instruction,
          } };
        });
        reply = `Saved this personal preference for future chats: ${instruction}. You can edit it in Admin settings → AI Context. Instructions in the current request take priority.`;
      }
    } else if (/\b(?:find|get|look up|search|check|enrich|reveal)\b/.test(lower) && /\b(?:phone|mobile|cell(?:phone)?|number|direct dial|telephone)\b/.test(lower)) {
      const savedNumber = matchedContact && (matchedContact.phone || matchedContact.phoneNumber || matchedContact.mobileNumber || matchedContact.directPhone || matchedContact.direct_phone);
      if (matchedContact && savedNumber) reply = `${matchedContact.name} already has a phone number saved in this browser workspace: ${savedNumber}. This is a saved local value, not a fresh Apollo lookup.`;
      else if (matchedContact) reply = `There is no phone number saved for ${matchedContact.name} in this browser workspace. Live phone lookup is not connected in the demo, so I did not search Apollo or use credits.`;
      else reply = "Which prospect should I check? This browser demo has no live phone lookup or sample phone numbers, so I did not search Apollo or use credits.";
      if (!savedNumber) {
        nextStepsTitle = "Live phone lookup";
        nextSteps = [{ title: "Review Apollo connection", detail: "Connect Apollo to ask Luna for a live number lookup; credit use depends on the account action.", module: "Settings", targetType: "module", priority: 0 }];
      }
    } else if (/\b(?:find|get|look up|enrich|reveal)\b/.test(lower) && /\b(?:email|email address|contact details?)\b/.test(lower)) {
      if (!matchedContact) reply = "Which person should I look up? Include their name from this workspace.";
      else if (matchedContact.email) reply = `${matchedContact.name} already has an email in this workspace: ${matchedContact.email}.`;
      else if (!matchedContact.canEnrich || matchedContact.source !== "apollo") reply = `${matchedContact.name} does not have an Apollo person ID in the saved workspace record. Find and save this person from live People Search before requesting email enrichment.`;
      else if (!apolloConfigured) reply = "Apollo email enrichment is not connected. Add APOLLO_API_KEY to the local server and restart the preview before requesting contact data.";
      else {
        const estimate = 9;
        const used = Number(activeAssistantChat?.creditUsed || 0);
        const limit = activeAssistantChat?.creditLimit;
        if (limit != null && used + estimate <= Number(limit)) {
          const started = onEnrichPerson?.(matchedContact, { autoApprove: true });
          if (started) {
            updateAssistantChatCreditUsage(estimate);
            reply = `Started Apollo email enrichment for ${matchedContact.name} within this chat's ${limit}-credit allowance. Up to ${estimate} credits are reserved; the actual charge may be lower. Personal email and phone enrichment stay off.`;
          } else reply = "Apollo enrichment could not start. Open People and check the connection status before retrying.";
        } else {
          creditAction = { id: `credit-${Date.now()}`, type: "enrich-email", person: matchedContact, estimatedMaxCredits: estimate };
          reply = limit == null
            ? `Apollo email enrichment for ${matchedContact.name} may use 1–9 credits. This chat requires approval before every credit-consuming action.`
            : `Apollo email enrichment for ${matchedContact.name} may use 1–9 credits. This could exceed the remaining ${Math.max(0, Number(limit) - used)} credits in this chat, so approval is required.`;
        }
      }
    } else if (/\b(open|go to|take me to|navigate to)\b/.test(lower) && requestedRoute && !(requestedRoute[0] === "tasks" && isTaskQueueSearch)) {
      onNavigate(requestedRoute[1]);
      reply = `Opening ${requestedRoute[1]} in this workspace.`;
    } else if (/\b(schedule|book|set up|create)\b/.test(lower) && /\bmeeting\b/.test(lower) && !/\b(workflow|automation)\b/.test(lower)) {
      if (!matchedContact) reply = "Which contact should I schedule this with? Include a contact name from this workspace.";
      else {
        const date = assistantRequestedDate(lower);
        const time = assistantRequestedTime(lower);
        if (!date || !time) reply = `I found ${matchedContact.name}. Please include a date (such as tomorrow) and time (such as 2:30 PM) so I can create the meeting.`;
        else {
          const meeting = { title: `Meeting · ${matchedContact.company || matchedContact.name}`, person: matchedContact.name, time: `${formatTaskDue(date)} · ${new Date(`2000-01-01T${time}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`, duration: "30 min", type: "Video call", date, past: false };
          reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "create-meeting", meeting, label: "Schedule meeting · local workspace", summary: `${meeting.person} · ${meeting.time}`, status: "pending" };
          reply = `Review scheduling a local 30-minute meeting with ${matchedContact.name} for ${meeting.time}. No calendar invite will be sent.`;
        }
      }
    } else if (/\b(draft|write|compose|send|reply|respond|answer)\b/.test(lower) && /\b(emails?|threads?|messages?)\b/.test(lower)) {
      const requestedSend = /\bsend\b/.test(lower) && !/\b(?:do not|don't|never)\s+send\b/.test(lower);
      const requestedReply = /\b(reply|respond|answer)\b/.test(lower);
      const requestedReplyText = requestedReply
        ? prompt.match(/\b(?:saying|with(?: the following)?(?: message| reply)?|that)\s+["'“]?([\s\S]+)$/i)?.[1]?.trim().replace(/["'”]+$/, "") || ""
        : "";
      const listTarget = data.lists.find(list => list.type === "People" && list.name && lower.includes(list.name.toLowerCase()));
      const sourceEmail = requestedReply && matchedContact ? data.emails.find(email => email.from === matchedContact.name && (email.folder || "Inbox") === "Inbox") : null;
      if (!matchedContact && !listTarget) reply = "Who should I draft this email for? Name a contact from this workspace or a People list.";
      else if (requestedReply && !matchedContact) reply = "Name one contact so I can find the matching email thread before preparing a reply.";
      else if (requestedReply && !sourceEmail) reply = `I couldn't find an inbox email from ${matchedContact.name} in this workspace, so I can't ground a reply draft in the original thread.`;
      else if (!assistantContext.companyProduct?.trim() && !isConversationFollowUp && !requestedReply) {
        reply = "Add your Company and product details first, so the draft can describe what you offer accurately.";
        nextStepsTitle = "Finish setup to prepare this draft";
        nextSteps = [{ title: "Add company and product context", detail: "Required before Luna can write an accurate email", module: "Settings", targetType: "ai-context", priority: 0 }];
      }
      else if (listTarget) {
        const memberNames = new Set((listTarget.members || []).map(name => String(name).toLowerCase()));
        const candidates = [...new Map([...people, ...data.savedPeople].filter(person => person.name && memberNames.has(person.name.toLowerCase())).map(person => [person.name.toLowerCase(), person])).values()];
        if (!candidates.length) reply = `I couldn't match saved contacts for “${listTarget.name}.” Add contacts to that People list before drafting.`;
        else if (isConversationFollowUp && !candidates.some(contact => data.recordings.some(recording => recording.person === contact.name))) reply = `I couldn't find saved call summaries for contacts on “${listTarget.name}.” I need a related conversation summary to ground each follow-up draft.`;
        else if ((isConversationFollowUp ? candidates.filter(contact => data.recordings.some(recording => recording.person === contact.name)).length : candidates.length) > 25) reply = `“${listTarget.name}” has more than 25 matching contacts. Narrow the list before I prepare drafts, so you can review each message.`;
        else {
          const concise = ["concise", "brief", "short"].includes(effectiveWritingStyle);
          const draftCandidates = isConversationFollowUp ? candidates.filter(contact => data.recordings.some(recording => recording.person === contact.name)) : candidates;
          const emails = draftCandidates.map(contact => {
            const greeting = effectiveWritingStyle === "formal" || effectiveWritingStyle === "professional" ? `Dear ${contact.name.split(" ")[0]},` : `Hi ${contact.name.split(" ")[0]},`;
            const company = contact.company ? ` at ${contact.company}` : "";
            const role = contact.title || contact.role;
            const recording = isConversationFollowUp ? data.recordings.find(item => item.person === contact.name) : null;
            const opener = recording ? `Thanks for speaking with me. One key takeaway from our call: ${recording.summary}` : role ? `I thought this may be relevant given your role as ${role}${company}.` : `I thought this may be relevant to your team${company}.`;
            const productLines = [concise ? (assistantContext.valueProposition.trim() || assistantContext.companyProduct.trim()) : assistantContext.companyProduct.trim(), ...(concise ? [] : [assistantContext.valueProposition.trim()])].filter(Boolean);
            const question = isConversationFollowUp ? "What would be the most useful next step from your side?" : "Would you be open to a short conversation to see whether this could be useful for your team?";
            const body = [greeting, "", opener, ...(productLines.length ? ["", ...productLines] : []), ...(concise ? [] : ["", question]), "", "Best,", "Robert"].join("\n");
            const recipientReviewReason = contactEmailReviewReason(contact);
            return { from: "Robert Berry", to: contact.email || "", recipient: contact.name, recipientNeedsReview: Boolean(recipientReviewReason), recipientReviewReason, subject: recording ? `Following up on our conversation · ${contact.company || ""}`.trim() : `Introduction for ${contact.company || "your team"}`, preview: body.replace(/\n/g, " ").slice(0, 140), body, time: "Just now", unread: false, folder: "Drafts" };
          });
          reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "create-email-drafts", emails, listName: listTarget.name, label: "Create personalized drafts · local workspace", summary: `${emails.length} contact${emails.length === 1 ? "" : "s"} from ${listTarget.name}`, preview: emails.map(email => `${email.recipient} · ${email.subject}\n${email.body}`).join("\n\n"), status: "pending" };
          const skipped = candidates.length - emails.length;
          reply = `Review ${emails.length} separate local email drafts for “${listTarget.name}.” ${isConversationFollowUp ? `Each available draft uses that contact’s saved call summary${skipped ? `; ${skipped} contact${skipped === 1 ? " has" : "s have"} no saved call summary and was skipped` : ""}.` : "Each uses saved product context and contact details."} They will be saved to Drafts and not sent.${requestedSend ? " This demo has no connected mailbox; connect Apollo to send through Luna." : ""}`;
        }
      } else {
        const greeting = effectiveWritingStyle === "formal" || effectiveWritingStyle === "professional" ? `Dear ${matchedContact.name.split(" ")[0]},` : `Hi ${matchedContact.name.split(" ")[0]},`;
        const company = matchedContact.company ? ` at ${matchedContact.company}` : "";
        const role = matchedContact.title || matchedContact.role;
        const recording = isConversationFollowUp ? data.recordings.find(item => item.person === matchedContact.name) : null;
        if (isConversationFollowUp && !recording) {
          reply = `I couldn't find a saved call summary for ${matchedContact.name}, so I can't ground a post-meeting follow-up in conversation context.`;
        } else {
        const opener = sourceEmail ? requestedReplyText || `Thanks for your note. I’ve noted the details you shared: “${sourceEmail.preview}”` : recording ? `Thanks for speaking with me. One key takeaway from our call: ${recording.summary}` : role ? `I thought this may be relevant given your role as ${role}${company}.` : `I thought this may be relevant to your team${company}.`;
        const concise = ["concise", "brief", "short"].includes(effectiveWritingStyle);
        const productLines = sourceEmail ? [] : [concise ? (assistantContext.valueProposition.trim() || assistantContext.companyProduct.trim()) : assistantContext.companyProduct.trim(), ...(concise ? [] : [assistantContext.valueProposition.trim()])].filter(Boolean);
        const question = isConversationFollowUp ? "What would be the most useful next step from your side?" : "Would you be open to a short conversation to see whether this could be useful for your team?";
        const body = [greeting, "", opener, ...(productLines.length ? ["", ...productLines] : []), ...(sourceEmail ? [] : concise ? [] : ["", question]), "", "Best,", "Robert"].join("\n");
        const originalSubject = sourceEmail?.subject.replace(/^(?:re:\s*)+/i, "");
        const recipientReviewReason = contactEmailReviewReason(matchedContact);
        const email = { from: "Robert Berry", to: matchedContact.email || "", recipient: matchedContact.name, recipientNeedsReview: Boolean(recipientReviewReason), recipientReviewReason, subject: sourceEmail ? `Re: ${originalSubject}` : recording ? `Following up on our conversation · ${matchedContact.company || ""}`.trim() : `Introduction for ${matchedContact.company || "your team"}`, preview: body.replace(/\n/g, " ").slice(0, 140), body, time: "Just now", unread: false, folder: "Drafts" };
        reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "create-email-draft", email, ...(recording ? { sourceSummary: recording.summary } : {}), ...(sourceEmail ? { sourceEmail: { subject: sourceEmail.subject, from: sourceEmail.from, preview: sourceEmail.preview } } : {}), label: sourceEmail ? "Draft email reply · local workspace" : "Create email draft · local workspace", summary: `${email.recipient} · ${email.subject}`, preview: `${email.subject}\n\n${email.body}`, status: "pending" };
        reply = sourceEmail
          ? `Review a local reply draft for ${matchedContact.name}, grounded in “${sourceEmail.subject}.” It will be saved to Drafts and not sent.${requestedSend ? " This demo has no connected mailbox; connect Apollo to send through Luna." : ""}`
          : `Review a local ${isConversationFollowUp ? "post-meeting " : ""}email draft for ${matchedContact.name}${recording ? ", grounded in the saved call summary" : ""}. It will be saved to Drafts and not sent.${requestedSend ? " This demo has no connected mailbox; connect Apollo to send through Luna." : ""}`;
        }
      }
    } else if (/\b(create|build|draft|make)\b/.test(lower) && /\b(workflow|automation)\b/.test(lower)) {
      const listTarget = data.lists.find(list => list.type === "People" && list.name && lower.includes(list.name.toLowerCase()));
      const sequenceTarget = data.sequences.find(sequence => sequence.name && lower.includes(sequence.name.toLowerCase()));
      const trigger = /\b(no.?show|miss(?:ed)? (?:a )?meeting|meeting.{0,20}(?:missed|not attended)|did(?:n't| not) attend)\b/.test(lower) ? "Meeting marked no-show" : /\b(task completed|task is complete|completed tasks?|when a task is completed)\b/.test(lower) ? "Task completed" : /\b(deal stage|stage changes|stage changed)\b/.test(lower) ? "Deal stage changed" : "Contact added to list";
      const sequenceAction = lower.match(/\b(?:enroll(?:s|ed|ing)?|sequence)\b/);
      const listAction = lower.match(/\b(?:add(?:s|ing)?|mov(?:e|es|ing)|sav(?:e|es|ing))\b.{0,35}\blist\b/);
      const taskAction = lower.match(/\b(?:(?:create|schedule)(?:s|d|ing)?|creat(?:e|es|ed|ing)|make|makes|made|making|add(?:s|ed|ing)?)\b.{0,35}\b(?:task|follow.?up|reminder)\b/);
      const requestedSteps = [
        sequenceAction && { position: sequenceAction.index, action: "Enroll contact in a sequence", targetName: sequenceTarget?.name || "" },
        listAction && { position: listAction.index, action: "Add contact to a list", targetName: listTarget?.name || "" },
        taskAction && { position: taskAction.index, action: "Create follow-up task", taskTitle: "Follow up with {{contact}}", due: assistantRequestedDate(lower) ? formatTaskDue(assistantRequestedDate(lower)) : "Today" },
      ].filter(Boolean).sort((a, b) => a.position - b.position);
      if (!requestedSteps.length) requestedSteps.push({ action: "Create follow-up task", taskTitle: "Follow up with {{contact}}", due: "Today" });
      const action = requestedSteps[0].action;
      const missingSequence = requestedSteps.some(step => step.action === "Enroll contact in a sequence" && !step.targetName);
      const missingList = requestedSteps.some(step => step.action === "Add contact to a list" && !step.targetName);
      if (missingSequence) reply = "Which sequence should the workflow use? Include the exact sequence name from Sequences.";
      else if (missingList) reply = "Which People list should the workflow use? Include the exact list name from Lists.";
      else {
        const workflowName = `AI draft · ${trigger.toLowerCase()}`;
        if (data.workflows.some(workflow => workflow.name.toLowerCase() === workflowName.toLowerCase())) reply = `A workflow draft named “${workflowName}” already exists; I left it unchanged.`;
        else {
          const steps = requestedSteps.map(({ position, ...step }) => step);
          const workflow = { name: workflowName, trigger, status: "Draft", runs: 0, action, targetName: requestedSteps[0].targetName || "", taskTitle: requestedSteps[0].taskTitle || "", due: requestedSteps[0].due || "Today", steps };
          const actionSummary = steps.map(step => `${step.action}${step.targetName ? ` (${step.targetName})` : step.due ? ` · due ${step.due}` : ""}`).join(" → ");
          const preview = steps.map((step, index) => `${index + 1}. ${step.action}${step.targetName ? ` · ${step.targetName}` : step.taskTitle ? ` · ${step.taskTitle} · due ${step.due}` : ""}`).join("\n");
          reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "create-workflow", workflow, label: `Create ${steps.length}-step workflow draft · local workspace`, summary: `${trigger} → ${actionSummary}`, preview, status: "pending" };
          reply = `Review a ${steps.length}-step local workflow draft: ${trigger} → ${actionSummary}. It will remain a draft until you activate it in Workflows.`;
        }
      }
    } else if (/\b(export|download)\b/.test(lower) && /\b(contact|prospect|people|company|companies|account|accounts|organization|organizations|list|csv)\b/.test(lower)) {
      const targetList = data.lists.find(list => list.name && lower.includes(list.name.toLowerCase()));
      const exportCompanies = targetList ? targetList.type === "Companies" : /\b(company|companies|account|accounts|organization|organizations)\b/.test(lower);
      const records = exportCompanies
        ? targetList ? data.companies.filter(company => (targetList.members || []).includes(company.name)) : data.companies
        : targetList ? workspacePeople.filter(person => (targetList.members || []).includes(person.name)) : workspacePeople;
      const fields = exportCompanies
        ? ["name", "domain", "website", "industry", "employees", "location", "status", "annualRevenue", "totalFunding", "technologyNames"]
        : ["name", "title", "company", "email", "location", "status"];
      const csv = [fields.map(csvCell).join(","), ...records.map(record => fields.map(field => csvCell(record[field])).join(","))].join("\r\n");
      const filename = `${(targetList?.name || (exportCompanies ? "apollo-companies" : "apollo-prospects")).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
      const recordLabel = exportCompanies ? "account" : "contact";
      const exportSummary = `Exported ${records.length} local workspace ${recordLabel}${records.length === 1 ? "" : "s"}${targetList ? ` from ${targetList.name}` : ""} as a CSV. This file includes browser-local records only.`;
      reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "export-csv", csv, filename, exportSummary, label: "Download CSV · local records", summary: `${records.length} ${recordLabel}${records.length === 1 ? "" : "s"}${targetList ? ` from ${targetList.name}` : ""} · ${filename}`, status: "pending" };
      reply = `Review downloading ${filename} with ${records.length} local workspace ${recordLabel}${records.length === 1 ? "" : "s"}.`;
    } else if (/\b(?:create|add)\s+(?:(?:a|new)\s+)?company\b/.test(lower)) {
      const nameMatch = prompt.match(/\b(?:named|called)\s+["'“]?(.+?)["'”]?(?=\s+(?:with\s+)?(?:domain|website|industry|\d[\d,]*\s+employees|employees|based in|located in|headquartered in|location|status|as)\b|[,;.]|$)/i)
        || prompt.match(/\bcompany\s+([\p{L}\p{N}][\p{L}\p{N} &.'’-]*?)(?=\s+(?:with\s+)?(?:domain|website|industry|\d[\d,]*\s+employees|employees|based in|located in|headquartered in|location|status|as)\b|[,;.]|$)/iu);
      const companyName = nameMatch?.[1]?.trim().replace(/[.!?]+$/, "").replace(/["'“”]+$/g, "");
      const domain = prompt.match(/\b(?:domain|website)\s+(?:is\s+|:\s*)?([\w.-]+\.[A-Za-z]{2,})/i)?.[1]?.toLowerCase().replace(/^www\./, "") || "";
      const industryMatch = prompt.match(/\bindustry\s+(?:is\s+|:\s*)?(.+?)(?=\s+(?:\d[\d,]*\s+employees|employees|based in|located in|headquartered in|location|domain|website|status)\b|[,;.]|$)/i);
      const employeeCount = prompt.match(/\b([\d,]+)\s+employees\b/i)?.[1] || prompt.match(/\bemployees\s+(?:is\s+|:\s*)?([\d,]+)/i)?.[1] || "";
      const locationMatch = prompt.match(/\b(?:based in|located in|headquartered in|location)\s+(?:is\s+|:\s*)?(.+?)(?=\s+(?:domain|website|industry|\d[\d,]*\s+employees|status)\b|[.!?]|$)/i);
      const requestedStatus = prompt.match(/\b(?:status|as)\s+(target|working|new)\b/i)?.[1];
      const status = ["Target", "Working", "New"].find(value => value.toLowerCase() === requestedStatus?.toLowerCase()) || "Target";
      if (!companyName) reply = "What is the company name? For example: ‘Create a company called Redwood AI with domain redwood.ai.’";
      else if (data.companies.some(company => company.name.toLowerCase() === companyName.toLowerCase() || (domain && company.domain?.toLowerCase() === domain))) reply = `A company named ${companyName}${domain ? ` or using ${domain}` : ""} already exists; I left it unchanged.`;
      else {
        const company = { name: companyName, domain, industry: industryMatch?.[1]?.trim() || "—", employees: employeeCount ? String(Number(employeeCount.replace(/,/g, ""))) : "—", location: locationMatch?.[1]?.trim().replace(/[.!?]+$/, "") || "—", people: 0, status };
        const preview = [`Company: ${company.name}`, `Domain: ${company.domain || "Not provided"}`, `Industry: ${company.industry}`, `Employees: ${company.employees}`, `Location: ${company.location}`, `Status: ${company.status}`].join("\n");
        reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "create-company", company, preview, label: "Create company · local workspace", summary: `${company.name} · ${company.industry} · ${company.status}`, status: "pending" };
        reply = `Review the company record for ${company.name}. I’ll add it to the local Companies workspace after approval; no Apollo account data will be changed.`;
      }
    } else if (/\b(?:create|add)\s+(?:(?:a|new)\s+)?(?:contact|person|prospect)\b/.test(lower)) {
      const nameMatch = prompt.match(/\b(?:named|called)\s+["'“]?(.+?)["'”]?(?=\s+(?:at|working at|with title|title|job title|role|as|email|with email|located|based|location|in)\b|[,;]|$)/i)
        || prompt.match(/\b(?:contact|person|prospect)\s+(.+?)(?=\s+(?:at|working at|with title|title|job title|role|as|email|with email|located|based|location|in)\b|[,;]|$)/i);
      const contactName = nameMatch?.[1]?.trim().replace(/[.!?]+$/, "").replace(/["'“”]+$/g, "");
      const companyMatch = prompt.match(/\b(?:at|working at|with company|company)\s+["'“]?(.+?)["'”]?(?=\s+(?:with title|title|job title|role|as|email|with email|located|based|location|in)\b|[,;.]|$)/i);
      const titleMatch = prompt.match(/\b(?:with title|job title|title|role|as)\s+(?:is\s+|:\s*)?(.+?)(?=\s+(?:at|working at|company|email|with email|located|based|location|in)\b|[,;.]|$)/i);
      const email = prompt.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] || "";
      const locationMatch = prompt.match(/\b(?:located in|based in|location)\s+(?:is\s+|:\s*)?(.+?)(?:[.!?]|$)/i);
      if (!contactName) reply = "What is the contact's full name? For example: ‘Create a contact named Taylor Morgan at Northstar Labs with title VP of Sales.’";
      else if ([...people, ...data.savedPeople].some(person => person.name.toLowerCase() === contactName.toLowerCase() || (email && person.email?.toLowerCase() === email.toLowerCase()))) reply = `A contact named ${contactName}${email ? ` or using ${email}` : ""} already exists; I left it unchanged.`;
      else {
        const companyName = companyMatch?.[1]?.trim().replace(/["'“”]+$/g, "") || "Company unavailable";
        const person = {
          id: `local:${crypto.randomUUID()}`,
          name: contactName,
          title: titleMatch?.[1]?.trim().replace(/\s+and$/i, "").replace(/[.!?]+$/, "") || "Title unavailable",
          company: companyName,
          email,
          location: locationMatch?.[1]?.trim().replace(/[.!?]+$/, "") || "Location unavailable",
          status: email ? "Added manually" : "Unavailable",
          owner: "Robert Berry",
        };
        const preview = [`Name: ${person.name}`, `Title: ${person.title}`, `Company: ${person.company}`, `Email: ${person.email || "Not provided"}`, `Location: ${person.location}`].join("\n");
        reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "create-contact", person, label: "Create contact · local workspace", summary: `${person.name} · ${person.title} · ${person.company}`, preview, status: "pending" };
        reply = `Review the contact record for ${person.name}. Applying adds it to People in this browser; it does not send outreach or write to your Apollo account.`;
      }
    } else if (/\b(?:log|record|add)\s+(?:(?:a|the|my|this)\s+)?(?:connected\s+|no answer\s+|left voicemail\s+)?call\b/.test(lower)) {
      if (matchedContacts.length !== 1) reply = matchedContacts.length > 1
        ? `I found multiple contacts: ${matchedContacts.map(person => person.name).join(", ")}. Name one person for the call log.`
        : "Who was the call with? Include a contact name from the People workspace.";
      else {
        const person = matchedContacts[0];
        const outcomeMatch = lower.match(/\b(connected|no answer|left voicemail|voicemail|busy|wrong number)\b/);
        const outcome = outcomeMatch ? (outcomeMatch[1] === "voicemail" ? "Left voicemail" : outcomeMatch[1].replace(/\b\w/g, letter => letter.toUpperCase())) : "Connected";
        const noteMatch = prompt.match(/\b(?:note|notes|summary|discussed|discussion)\s*(?:is|was|:)?\s*(.+)$/i);
        const note = noteMatch?.[1]?.trim().replace(/[.!?]+$/, "") || "Call logged from Luna.";
        const durationMatch = prompt.match(/\b(?:duration(?: was)?\s+)?(\d{1,2}:\d{2}|\d+\s*(?:minutes?|mins?))\b/i);
        const duration = durationMatch ? durationMatch[1].replace(/\s+/g, " ") : "—";
        const call = { person: person.name, company: person.company || "New account", time: "Just now", duration, outcome, note };
        const preview = [`Contact: ${call.person}`, `Company: ${call.company}`, `Outcome: ${outcome}`, `Duration: ${duration}`, `Note: ${note}`].join("\n");
        reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "log-call", call, preview, label: "Log call · local workspace", summary: `${call.person} · ${outcome}`, status: "pending" };
        reply = `Review logging a ${outcome.toLowerCase()} call with ${call.person}.${outcomeMatch ? "" : " Outcome defaults to Connected."} The note is saved to Calls; this will not place a call.`;
      }
    } else if (/\b(pause|resume|activate|deactivate|stop|start|unpause)\b/.test(lower) && (/\b(?:sequence|campaign)\b/.test(lower) || data.sequences.some(sequence => lower.includes(sequence.name.toLowerCase())))) {
      const targetSequences = data.sequences.filter(sequence => lower.includes(sequence.name.toLowerCase()));
      const status = /\b(?:pause|deactivate|stop)\b/.test(lower) ? "Paused" : "Active";
      if (!targetSequences.length) reply = `Which sequence should I ${status === "Paused" ? "pause" : "activate"}? Available sequences: ${data.sequences.map(sequence => sequence.name).join(", ") || "none"}.`;
      else if (targetSequences.length > 1) reply = `I found more than one sequence name in that request. Name just one: ${targetSequences.map(sequence => sequence.name).join(", ")}.`;
      else if (targetSequences[0].status === status) reply = `${targetSequences[0].name} is already ${status.toLowerCase()}; I left it unchanged.`;
      else {
        const sequence = targetSequences[0];
        reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "set-sequence-status", sequenceName: sequence.name, previousStatus: sequence.status, targetStatus: status, label: `${status === "Paused" ? "Pause" : "Activate"} sequence · local workspace`, summary: `${sequence.name} · ${sequence.status} → ${status}`, status: "pending" };
        reply = `Review changing ${sequence.name} from ${sequence.status} to ${status}. This only changes its status in the local workspace; it will not send or resume outreach in Apollo.`;
      }
    } else if (/\b(create|add|open|make)\b/.test(lower) && /\b(deal|opportunity)\b/.test(lower)) {
      const companies = [...new Map([
        ...data.companies.map(company => [company.name, company.name]),
        ...data.deals.map(deal => [deal.company, deal.company]),
      ].filter(([name]) => name).map(([name]) => [name.toLowerCase(), name])).values()];
      const company = companies.find(name => lower.includes(name.toLowerCase()));
      const amountMatch = prompt.match(/\b(?:worth|valued at|amount(?: of)?|value(?:d)? at|for)\s+\$?([\d,.]+)\s*([km])?\b/i) || prompt.match(/\$([\d,.]+)\s*([km])?\b/i);
      const namedMatch = prompt.match(/\b(?:called|named|titled)\s+["'“]?(.+?)["'”]?(?=\s+(?:worth|valued|amount|value|at|in|stage|closing|close|expected|owned|owner|assigned)\b|[,.!?]|$)/i);
      const dealName = namedMatch?.[1]?.trim().replace(/["'“”]+$/g, "") || (company ? `${company} · New opportunity` : "");
      const stageNames = ["Qualification", "Discovery", "Proposal", "Negotiation", "Closed won", "Closed lost"];
      const requestedStage = prompt.match(/\b(?:stage\s+(?:to\s+)?|at\s+|in\s+)(qualification|discovery|proposal|negotiation|closed won|closed lost)\b/i)?.[1];
      const stage = stageNames.find(item => item.toLowerCase() === requestedStage?.toLowerCase()) || "Qualification";
      const owners = [...new Set(["Robert Berry", ...data.deals.map(deal => deal.owner).filter(Boolean)])];
      const owner = owners.find(name => lower.includes(name.toLowerCase())) || "Robert Berry";
      const ownerWasProvided = owners.some(name => lower.includes(name.toLowerCase()));
      const hasOwnerClause = /\b(?:owned by|owner(?: is)?|assigned to)\b/i.test(prompt);
      const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
      const monthCloseMatch = prompt.match(/\b(?:closing|close(?: date)?|expected close)\s+(?:on\s+|by\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,?\s+(20\d{2}))?/i);
      const closeWasProvided = Boolean(monthCloseMatch || /\b(?:tomorrow|next week|in\s+\d+\s+days?|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|20\d{2}-\d{2}-\d{2})\b/i.test(prompt));
      let closeDate;
      if (monthCloseMatch) {
        const month = monthNames.findIndex(name => name.startsWith(monthCloseMatch[1].toLowerCase().slice(0, 3)));
        const now = new Date();
        let close = new Date(Number(monthCloseMatch[3] || now.getFullYear()), month, Number(monthCloseMatch[2]));
        if (!monthCloseMatch[3] && close < new Date(now.getFullYear(), now.getMonth(), now.getDate())) close.setFullYear(close.getFullYear() + 1);
        closeDate = `${close.getFullYear()}-${String(close.getMonth() + 1).padStart(2, "0")}-${String(close.getDate()).padStart(2, "0")}`;
      } else if (/\b(?:tomorrow|next week|in\s+\d+\s+days?|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|20\d{2}-\d{2}-\d{2})\b/i.test(prompt)) closeDate = assistantRequestedDate(prompt);
      else {
        const defaultClose = new Date();
        defaultClose.setDate(defaultClose.getDate() + 30);
        closeDate = `${defaultClose.getFullYear()}-${String(defaultClose.getMonth() + 1).padStart(2, "0")}-${String(defaultClose.getDate()).padStart(2, "0")}`;
      }
      const close = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(new Date(`${closeDate}T12:00:00`));
      const amount = amountMatch ? Math.round(Number(amountMatch[1].replace(/,/g, "")) * (amountMatch[2]?.toLowerCase() === "m" ? 1000000 : amountMatch[2]?.toLowerCase() === "k" ? 1000 : 1)) : 0;
      const deal = { name: dealName, company: company || "", amount, stage, close, closeDate, owner };
      if (!company) reply = "Which company should this deal belong to? Use a company already in the local workspace, or add the company first.";
      else if (hasOwnerClause && !ownerWasProvided) reply = `I couldn't match that owner. Available local owners are ${owners.join(", ")}.`;
      else if (!amount) reply = `What amount should I use for the ${company} deal? For example: “Create a deal for ${company} worth $50k.”`;
      else if (data.deals.some(item => item.name.toLowerCase() === deal.name.toLowerCase())) reply = `A deal named “${deal.name}” already exists. Give the new deal a different name.`;
      else {
        const preview = [`Deal: ${deal.name}`, `Company: ${company}`, `Amount: ${fmtMoney(amount)}`, `Stage: ${stage}`, `Expected close: ${close}`, `Owner: ${owner}`].join("\n");
        reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "create-deal", deal, preview, label: "Create deal · local workspace", summary: `${deal.name} · ${fmtMoney(amount)} · ${stage}`, status: "pending" };
        const defaults = [!requestedStage && `stage defaults to ${stage}`, !closeWasProvided && `close date defaults to ${close}`, !ownerWasProvided && `owner defaults to ${owner}`].filter(Boolean);
        reply = `Review the new ${fmtMoney(amount)} ${stage.toLowerCase()} deal for ${company}, closing ${close} and owned by ${owner}.${defaults.length ? ` ${defaults.join("; ")}.` : ""}`;
      }
    } else if (/\b(create|build|draft|make)\b/.test(lower) && /\b(sequence|campaign)\b/.test(lower)) {
      const requestedCount = Number(lower.match(/\b(\d{1,2})\s*[- ]step\b/)?.[1] || lower.match(/\b(\d{1,2})\s*touches\b/)?.[1] || 0);
      const counts = {
        Email: Number(lower.match(/\b(\d+)\s*emails?\b/)?.[1] || 0),
        Call: Number(lower.match(/\b(\d+)\s*calls?\b/)?.[1] || 0),
        LinkedIn: Number(lower.match(/\b(\d+)\s*linkedin\b/)?.[1] || 0),
        Task: Number(lower.match(/\b(\d+)\s*tasks?\b/)?.[1] || 0),
      };
      const channelOrder = /phone.?first/.test(lower) ? ["Call", "Email", "LinkedIn", "Task"] : ["Email", "Call", "LinkedIn", "Task"];
      let stepIndex = 0;
      let stepPlan = channelOrder.flatMap(channel => Array.from({ length: counts[channel] }, () => ({ channel, index: stepIndex++ })));
      const stepCount = Math.min(12, requestedCount || stepPlan.length || 5);
      if (!stepPlan.length) {
        const defaultChannels = /phone.?first/.test(lower) ? ["Call", "Email", "Email", "LinkedIn", "Email"] : ["Email", "Call", "Email", "LinkedIn", "Email"];
        stepPlan = Array.from({ length: stepCount }, (_, index) => ({ channel: defaultChannels[index % defaultChannels.length], index }));
      }
      if (stepPlan.length > stepCount) stepPlan = stepPlan.slice(0, stepCount);
      while (stepPlan.length < stepCount) stepPlan.push({ channel: "Email", index: stepPlan.length });
      const targetMatch = prompt.match(/\b(?:targeting|for)\s+(.+?)(?:\s+with\s+\d+\s*(?:emails?|calls?|linkedin|steps?)|(?=[.!?])|$)/i);
      const targetLabel = targetMatch?.[1]?.trim().replace(/[.?!]+$/, "") || "your target audience";
      const productMessage = assistantContext.valueProposition?.trim() || assistantContext.companyProduct?.trim();
      const stepPlanWithContent = stepPlan.map(({ channel, index }) => {
        const subject = index === 0 ? `A note for ${targetLabel}` : `Following up · ${targetLabel}`;
        const concise = ["concise", "brief", "short"].includes(effectiveWritingStyle);
        const body = [
          "Hi {{first_name}},",
          "",
          concise
            ? `A quick note about ${targetLabel}: ${productMessage || "[Add a relevant, verified value proposition.]"}`
            : index === 0 ? `I’m reaching out with an idea that may be relevant to ${targetLabel}.` : `I wanted to follow up with one more thought for ${targetLabel}.`,
          ...(concise ? [] : [productMessage || "[Add a specific, verified reason this is relevant to {{company}}.]", "Would it be useful to compare notes?"]),
          "",
          "Best,",
          "{{sender_name}}",
        ].filter(Boolean).join("\n");
        const callScript = [
          `Opening: Hi {{first_name}}, this is {{sender_name}}. Have I caught you with a minute?`,
          `Reason: ${productMessage ? `I’m reaching out about ${productMessage}` : `[Add a verified reason relevant to ${targetLabel} and {{company}}.]`}`,
          `Discovery: ${targetLabel.toLowerCase().includes("sales") ? "How is your team handling this part of the sales process today?" : "How is your team handling this today?"}`,
          "Next step: If useful, would a 15-minute conversation next week work?",
          "If unavailable: Ask for a better time; do not imply that a meeting is already booked.",
        ].join("\n");
        const linkedinValue = productMessage ? productMessage.replace(/\s+/g, " ").trim().slice(0, 96) : `the ${targetLabel} space`;
        const linkedinMessage = productMessage
          ? `Hi {{first_name}}, I help teams at {{company}} with ${linkedinValue}. Open to connecting?`
          : "Hi {{first_name}}, I’m reaching out to connect about your team’s priorities at {{company}}. Open to connecting?";
        return {
          channel,
          delay: index === 0 ? "Immediately" : `Wait ${index === 1 ? 2 : index === 2 ? 3 : 4} days`,
          instruction: channel === "Email" ? `Subject: ${subject}` : channel === "Call" ? "Call task · use the reviewed call script" : channel === "LinkedIn" ? "LinkedIn task · personalize after reviewing the prospect’s profile" : "Manual follow-up task",
          ...(channel === "Email" ? { subject, body } : {}),
          ...(channel === "Call" ? { callScript } : {}),
          ...(channel === "LinkedIn" ? { linkedinMessage } : {}),
        };
      });
      const sequenceName = `AI draft · ${targetLabel.slice(0, 48)}`;
      if (!data.sequences.some(sequence => sequence.name.toLowerCase() === sequenceName.toLowerCase())) {
        const sequence = { name: sequenceName, status: "Draft", people: 0, replies: 0, steps: stepPlanWithContent.length, owner: "Robert Berry", stepPlan: stepPlanWithContent, enrolledPeople: [], draft: true, source: "local" };
        const preview = stepPlanWithContent.map((step, index) => [`${index + 1}. ${step.channel} · ${step.delay}`, step.subject ? `Subject: ${step.subject}\n\n${step.body || ""}` : step.callScript || step.linkedinMessage || step.instruction].filter(Boolean).join("\n")).join("\n\n");
        reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "create-sequence", sequence, targetLabel, preview, label: "Create sequence draft · local workspace", summary: `${sequenceName} · ${stepPlanWithContent.map(step => step.channel).join(" → ")}`, status: "pending" };
        reply = `Review a ${stepPlanWithContent.length}-step local sequence draft for ${targetLabel}. It includes editable ${stepPlanWithContent.map(step => step.channel).join(" → ")} copy${productMessage ? " grounded in your saved product context" : " with clear placeholders where verified product and account details are needed"}. Adjust each step before applying; no contacts will be enrolled and nothing will be sent.`;
      } else reply = `A sequence draft named “${sequenceName}” already exists. Open Sequences to review it; no changes were made.`;
    } else if (/\b(?:extract|populate|save|write|update)\b/.test(lower) && /\b(?:call|conversation|recording)\b/.test(lower) && /\b(?:deal|opportunity|contact|person|company|account)\b/.test(lower) && /\bfield\b/.test(lower)) {
      const availableRecordings = data.recordings.filter(item => (matchedContact && item.person === matchedContact.name) || (matchedCompany && item.title.startsWith(`${matchedCompany.name} ·`)));
      const recording = availableRecordings.find(item => lower.includes(item.title.toLowerCase())) || (availableRecordings.length === 1 ? availableRecordings[0] : null);
      const sourceCompanyName = matchedCompany?.name || matchedContact?.company;
      const companyDeals = data.deals.filter(item => sourceCompanyName && item.company === sourceCompanyName);
      const recordType = /\b(?:contact|person)\b/.test(lower) ? "contact" : /\b(?:company|account)\b/.test(lower) ? "company" : "deal";
      const recordCollection = recordType === "contact" ? [...data.savedPeople, ...people] : recordType === "company" ? data.companies : data.deals;
      const recordName = recordType === "contact" ? matchedContact?.name : recordType === "company" ? matchedCompany?.name : (data.deals.find(item => lower.includes(item.name.toLowerCase())) || (companyDeals.length === 1 ? companyDeals[0] : null))?.name;
      const targetRecord = recordCollection.find(item => item.name === recordName);
      const fieldName = prompt.match(/\bfield(?:\s+named)?\s+["'“]([^"'”]+)["'”]/i)?.[1]?.trim();
      const fieldValue = recording?.summary.match(/\b(?:needs?|asked for|requested?)\s+(.+?)(?:\s+before\b|[.!?]|$)/i)?.[1]?.trim();
      if (!matchedContact && !matchedCompany) reply = `Name the contact or company from the saved call and the ${recordType} record to update.`;
      else if (!recording && availableRecordings.length > 1) reply = `I found ${availableRecordings.length} saved calls for ${matchedContact?.name || matchedCompany?.name}. Include the exact call title so I use the right source.`;
      else if (!recording) reply = `I couldn't find a saved call for ${matchedContact?.name || matchedCompany?.name} in this browser workspace.`;
      else if (!targetRecord) reply = recordType === "deal" ? `I found “${recording.title},” but couldn’t identify one specific deal${companyDeals.length > 1 ? `; ${sourceCompanyName} has ${companyDeals.length} deals` : ""}. Include the exact deal name.` : `I couldn't identify a saved ${recordType} record for ${matchedContact?.name || matchedCompany?.name}. Save the record first, then try again.`;
      else if (!fieldName) reply = `I found “${recording.title}” and “${targetRecord.name}.” Include the exact ${recordType} field name in quotes, for example: field “Buyer requirements”.`;
      else if (!fieldValue) reply = `The saved summary for “${recording.title}” doesn't contain a clear requested value to populate “${fieldName}.” I left the ${recordType} unchanged.`;
      else {
        const previousValue = String(targetRecord.customFields?.[fieldName] || "").trim();
        reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "extract-recording-record-field", recordType, recordName: targetRecord.name, recording: { title: recording.title, person: recording.person, summary: recording.summary }, fieldName, previousValue, value: fieldValue, label: `Review conversation field extraction · ${recordType} · local workspace`, summary: `${targetRecord.name} · ${fieldName}`, preview: `${recording.person} · ${recording.title}\nSource summary: ${recording.summary}\n\n${recordType[0].toUpperCase()}${recordType.slice(1)} field: ${fieldName}\n${previousValue || "(empty)"} → ${fieldValue}`, status: "pending" };
        reply = `Review the value extracted from ${recording.person}’s saved call summary before updating the ${recordType}. This local demo only extracts a clear “needs / asked for / requested” phrase from the saved summary.`;
        nextStepsTitle = "Source conversation";
        nextSteps = [{ title: recording.title, detail: `${recording.person} · ${recording.date} · ${recording.duration}`, module: "Conversations", targetType: "recording", targetTitle: recording.title, targetPerson: recording.person, priority: 0 }];
      }
    } else if (/\b(?:associate|link|attach)\b/.test(lower) && /\b(?:call|conversation|recording)\b/.test(lower) && /\bdeal\b/.test(lower)) {
      const availableRecordings = data.recordings.filter(item => (matchedContact && item.person === matchedContact.name) || (matchedCompany && item.title.startsWith(`${matchedCompany.name} ·`)));
      const recording = availableRecordings.find(item => lower.includes(item.title.toLowerCase())) || (availableRecordings.length === 1 ? availableRecordings[0] : null);
      const companyDeals = data.deals.filter(item => matchedCompany && item.company === matchedCompany.name);
      const targetDeal = data.deals.find(item => lower.includes(item.name.toLowerCase())) || (companyDeals.length === 1 ? companyDeals[0] : null);
      if (!matchedContact && !matchedCompany) reply = "Name the contact or company from the saved call, and the deal to associate it with.";
      else if (!recording && availableRecordings.length > 1) reply = `I found ${availableRecordings.length} saved conversations for ${matchedContact?.name || matchedCompany?.name}. Include the exact call title so I don't associate the wrong one.`;
      else if (!recording) reply = `I couldn't find a saved conversation for ${matchedContact?.name || matchedCompany?.name} in this browser workspace.`;
      else if (!targetDeal) reply = `I found “${recording.title},” but couldn’t identify one specific deal${companyDeals.length > 1 ? `; ${matchedCompany.name} has ${companyDeals.length} deals` : ""}. Include the exact deal name so I can prepare the association for review.`;
      else if (recording.associatedDeal === targetDeal.name) reply = `“${recording.title}” is already associated with “${targetDeal.name}”; no changes were made.`;
      else {
        reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "associate-recording-deal", recording: { title: recording.title, person: recording.person, summary: recording.summary }, previousDeal: recording.associatedDeal || "", dealName: targetDeal.name, label: "Associate conversation with deal · local workspace", summary: `${recording.title} → ${targetDeal.name}`, preview: `${recording.person}\n${recording.title}\nDeal: ${targetDeal.name}${recording.associatedDeal ? `\nCurrently associated with: ${recording.associatedDeal}` : "\nCurrently not associated with a deal"}`, status: "pending" };
        reply = `Review associating ${recording.person}’s saved conversation with “${targetDeal.name}”. Applying will update this local conversation record only.`;
      }
    } else if (/\b(?:summari[sz]e|recap|what did|what was discussed|what\b.*\b(?:need|request|ask|discuss|say|mention|agree|decide|want|objections?|concerns?|sentiment|trend|pattern|common)|who|why|how|which|key points|action items|transcript|recording|objections?|concerns?|next steps?|sentiment|attendees?|participants?|pain points?|common|recurring|trends?|patterns?|themes?|tell me about)\b/.test(lower) && /\b(?:calls?|conversations?|recordings?|transcripts?|meetings?)\b/.test(lower)) {
      const hasNamedRecord = Boolean(matchedContact || matchedCompany);
      const matchingRecordings = data.recordings.filter(recording => !hasNamedRecord
        || recording.person === matchedContact?.name
        || (matchedCompany && recording.title.startsWith(`${matchedCompany.name} ·`)));
      const recordings = matchingRecordings.slice(0, 5);
      if (!recordings.length) reply = hasNamedRecord
        ? `I couldn't find a saved call recording for ${matchedContact?.name || matchedCompany?.name} in this browser workspace.`
        : "There are no saved call recordings in this browser workspace yet.";
      else {
        const asksAboutNeeds = /\b(?:need|needs|request|requested|ask|asked|concern|objection|blocker|security|pain points?)\b/.test(lower);
        const asksAboutNextSteps = /\b(?:next step|action item|follow.?up|what should (?:i|we)|recommend)\b/.test(lower);
        const asksAboutNextStepCoverage = /\b(?:no|missing|without|lack(?:ing)?|unclear)\b.{0,35}\b(?:next steps?|action items?|follow.?ups?)\b|\b(?:how many|which|count|coverage)\b.{0,35}\b(?:next steps?|action items?|follow.?ups?)\b/.test(lower);
        const asksAboutSentiment = /\b(?:sentiment|tone|positive|negative)\b/.test(lower);
        const asksAboutObjections = /\b(?:objections?|concerns?|blockers?|risks?|pushback)\b/.test(lower);
        const asksAboutPatterns = /\b(?:common|recurring|across|trends?|patterns?|themes?)\b/.test(lower);
        const asksAboutAttendees = /\b(?:who|attendee|participant)\b/.test(lower) && /\b(?:attend|involved|join|call|meeting|conversation)\b/.test(lower);
        const askedTopic = lower.match(/\b(?:budget|pricing?|timeline|competitors?|decision makers?|stakeholders?|objections?|contract|integration|implementation)\b/)?.[0];
        const findExplicitNextStep = recording => recording.summary.split(/[.!?]/).map(sentence => sentence.trim()).find(sentence => /\b(?:follow.?up|next step|action item|send|share|provide|review|prepare|confirm|reconnect|deliver|planning to|plan to)\b/i.test(sentence));
        const takeaways = recordings.map(recording => {
          if (asksAboutAttendees) return `${recording.title}: the saved record names ${recording.person}; it doesn't list other participants.`;
          if (asksAboutObjections) {
            const explicitConcern = recording.summary.split(/[.!?]/).map(sentence => sentence.trim()).find(sentence => /\b(?:objection|concern|blocker|risk|pushback)\b/i.test(sentence));
            const recordedNeed = recording.summary.match(/\b(?:needs?|asked for|requested?)\s+([^.!?]+)/i)?.[1];
            return explicitConcern
              ? `${recording.person}: the saved summary records “${explicitConcern}.”`
              : `${recording.person}: no objection is explicitly recorded${recordedNeed ? `; the summary notes a request for ${recordedNeed}` : ""}.`;
          }
          if (asksAboutSentiment) return recording.sentiment
            ? `${recording.title} · ${recording.person}: the saved call sentiment is ${recording.sentiment}.`
            : `${recording.title} · ${recording.person}: no sentiment is recorded in the saved summary.`;
          if (asksAboutNeeds) {
            const need = recording.summary.match(/\b(?:needs?|asked for|requested?)\s+([^.!?]+)/i)?.[1];
            return need
              ? `${recording.person} needs ${need.replace(/\s+before\s+/i, " before ")}.`
              : `${recording.person}'s saved summary doesn't name a specific request. It says: ${recording.summary}`;
          }
          if (asksAboutNextSteps) {
            const nextStep = findExplicitNextStep(recording);
            return nextStep
              ? `${recording.person}: ${nextStep}.`
              : `${recording.person}'s saved summary doesn't specify a next step. It says: ${recording.summary}`;
          }
          if (askedTopic && !recording.summary.toLowerCase().includes(askedTopic.replace(/s$/, ""))) return `${recording.person}'s saved summary doesn't mention ${askedTopic}. It says: ${recording.summary}`;
          return `${recording.title} · ${recording.person} · ${recording.date} (${recording.duration}). ${recording.summary}${recording.sentiment ? ` Sentiment: ${recording.sentiment}.` : ""}`;
        });
        let aggregate = "";
        if (!hasNamedRecord && asksAboutObjections) {
          const explicitConcerns = recordings.filter(recording => /\b(?:objection|concern|blocker|risk|pushback)\b/i.test(recording.summary));
          aggregate = explicitConcerns.length
            ? `Across ${recordings.length} saved summaries, ${explicitConcerns.length} explicitly mention an objection or concern. `
            : `None of the ${recordings.length} saved summaries explicitly records an objection or concern. `;
        } else if (!hasNamedRecord && asksAboutSentiment) {
          const counts = [...new Set(recordings.map(recording => recording.sentiment || "Not recorded"))].map(sentiment => ({ label: sentiment, value: recordings.filter(recording => (recording.sentiment || "Not recorded") === sentiment).length, display: String(recordings.filter(recording => (recording.sentiment || "Not recorded") === sentiment).length) }));
          reportData = [{ title: "Recorded call sentiment", unit: "count", items: counts }];
          aggregate = `Across ${recordings.length} saved summaries, recorded sentiment labels are ${counts.map(item => `${item.label}: ${item.value}`).join(" · ")}. `;
        } else if (!hasNamedRecord && asksAboutPatterns) {
          const topicRules = [
            ["Prospecting workflow", /\bprospect(?:ing)?|workflow\b/i],
            ["Technical or security review", /\btechnical|security|integration|implementation\b/i],
            ["Stakeholder involvement", /\bleadership|stakeholder|decision.?maker|operations lead\b/i],
            ["Timing or follow-up", /\bnext week|timeline|follow.?up|schedule|before\b/i],
            ["Budget or pricing", /\bbudget|pricing|cost\b/i],
            ["Demand generation", /\bdemand generation\b/i],
          ];
          const topics = topicRules.map(([label, pattern]) => ({ label, value: recordings.filter(recording => pattern.test(recording.summary)).length })).filter(topic => topic.value > 0);
          const repeated = topics.filter(topic => topic.value >= 2);
          reportData = topics.length ? [{ title: "Topics found in saved call summaries", unit: "count", items: topics.map(topic => ({ ...topic, display: `${topic.value} of ${recordings.length} calls` })) }] : [];
          aggregate = repeated.length
            ? `Repeated topics across ${recordings.length} saved summaries: ${repeated.map(topic => `${topic.label} (${topic.value})`).join(" · ")}. `
            : `No topic appears in 2 or more of the ${recordings.length} saved summaries. The keyword groups found are ${topics.map(topic => `${topic.label} (${topic.value})`).join(" · ") || "none"}. `;
        } else if (!hasNamedRecord && asksAboutNextStepCoverage) {
          const withNextStep = recordings.filter(findExplicitNextStep);
          const withoutNextStep = recordings.length - withNextStep.length;
          const items = [
            { label: "Explicit next step recorded", value: withNextStep.length },
            { label: "No explicit next step found", value: withoutNextStep },
          ];
          reportData = [{ title: "Next-step coverage in saved call summaries", unit: "count", items: items.map(item => ({ ...item, display: `${item.value} of ${recordings.length} calls` })) }];
          aggregate = `An explicit follow-up or action appears in ${withNextStep.length} of ${recordings.length} saved summaries; ${withoutNextStep} summary${withoutNextStep === 1 ? " has" : "ies have"} no clear next step recorded. `;
        }
        reply = `${aggregate}${takeaways.join("\n\n")} These answers use saved local call summaries and transparent keyword groups only; they don't query transcripts or run live Apollo analysis.`;
        nextStepsTitle = recordings.length === 1 ? "Open call recording" : "Call recordings to review";
        nextSteps = recordings.map(recording => ({ title: recording.title, detail: `${recording.person} · ${recording.date} · ${recording.duration}`, module: "Conversations", targetType: "recording", targetTitle: recording.title, targetPerson: recording.person, priority: 0 }));
      }
    } else if (/\b(research|overview|summari[sz]e|what should i know|prioritiz|qualif)\b/.test(lower) && matchedContact) {
      const company = data.companies.find(item => item.name === matchedContact.company);
      const deal = data.deals.find(item => item.company === matchedContact.company && !closedDealStages.has(item.stage));
      const recentCall = data.calls.find(item => item.person === matchedContact.name);
      const notes = [
        `${matchedContact.name} is ${matchedContact.title || matchedContact.role || "a contact"} at ${matchedContact.company || "an unknown company"}.`,
        company && `Company record: ${company.industry}, ${company.employees} employees, based in ${company.location}.`,
        deal && `Open deal: ${fmtMoney(deal.amount)} in ${deal.stage}, expected close ${deal.close}.`,
        recentCall && `Call note: ${recentCall.note || recentCall.outcome}.`,
      ].filter(Boolean);
      const research = notes.join(" ");
      reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "save-ai-research", person: matchedContact, research, researchedAt: new Date().toISOString(), label: "Save AI research · local workspace", summary: `${matchedContact.name} · contact overview`, status: "pending" };
      reply = `${research} This summary uses only local workspace records; it does not include web research, intent signals, or new Apollo data. Review saving it to the contact's AI research field.`;
    } else if (/\b(research|overview|summari[sz]e|what should i know|prioritiz|qualif)\b/.test(lower) && (matchedCompany || /\b(compan(?:y|ies)|account|accounts)\b/.test(lower))) {
      const companyList = data.lists.find(list => list.type === "Companies" && list.name && lower.includes(list.name.toLowerCase()));
      if (companyList) {
        const memberNames = new Set((companyList.members || []).map(name => String(name).toLowerCase()));
        const companies = data.companies.filter(company => memberNames.has(company.name.toLowerCase()));
        if (!companies.length) reply = `I couldn't match saved accounts for “${companyList.name}.” Add accounts to that Companies list before researching it.`;
        else if (companies.length > 10) reply = `“${companyList.name}” has ${companies.length} local accounts. Narrow the list to 10 or fewer before saving overviews so you can review each note.`;
        else {
          const notes = companies.map(company => {
            const accountPeople = workspacePeople.filter(person => person.company === company.name);
            const deal = data.deals.find(item => item.company === company.name && !closedDealStages.has(item.stage));
            const research = `${company.name}: ${company.industry}, ${company.employees} employees, based in ${company.location}. ${accountPeople.length ? `Known workspace contacts: ${accountPeople.map(person => `${person.name} (${person.title || person.role})`).join(", ")}.` : "No linked workspace contacts."} ${deal ? `Open deal: ${fmtMoney(deal.amount)} in ${deal.stage}.` : "No open deal is recorded."}`;
            return { name: company.name, research };
          });
          reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "save-ai-research-batch", listName: companyList.name, notes, researchedAt: new Date().toISOString(), label: "Save account overviews · local workspace", summary: `${notes.length} accounts from ${companyList.name}`, preview: notes.map(note => note.research).join("\n\n"), status: "pending" };
          reply = `Review local account overviews for ${notes.length} companies in “${companyList.name}.” Notes use company, contact, and deal records in this workspace only; they do not include web research, intent signals, or new Apollo data.`;
        }
      } else {
      const match = data.companies.find(company => lower.includes(company.name.toLowerCase()));
      if (match) {
        const accountPeople = workspacePeople.filter(person => person.company === match.name);
        const deal = data.deals.find(item => item.company === match.name && !closedDealStages.has(item.stage));
        const research = `${match.name}: ${match.industry}, ${match.employees} employees, based in ${match.location}. ${accountPeople.length ? `Known workspace contacts: ${accountPeople.map(person => `${person.name} (${person.title || person.role})`).join(", ")}.` : "No linked workspace contacts."} ${deal ? `Open deal: ${fmtMoney(deal.amount)} in ${deal.stage}.` : "No open deal is recorded."}`;
        reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "save-ai-research", company: match, research, researchedAt: new Date().toISOString(), label: "Save AI research · local workspace", summary: `${match.name} · account overview`, status: "pending" };
        reply = `${research} This summary uses local workspace records only; it does not include web research or intent signals. Review saving it to the account's AI research field.`;
      } else reply = "Which company should I summarize? I can use company names in this workspace; external web research is not connected in this demo.";
      }
    } else if (/\b(improve|optimi[sz]e|analy[sz]e|performance|reply rate|best|compare|rank|top)\b/.test(lower) && /\b(sequences?|campaign|outreach)\b/.test(lower)) {
      const namedSequence = data.sequences.find(sequence => sequence.name && lower.includes(sequence.name.toLowerCase()));
      const targetSequence = namedSequence || data.sequences.find(sequence => sequence.status === "Active");
      const compareAll = !namedSequence && /\b(best|which|compare|rank|top|performance|analy[sz]e)\b/.test(lower);
      if (!targetSequence) reply = "There are no sequences to review yet. Ask me to create a sequence draft first.";
      else if (compareAll || (/\b(best|which|compare|rank|top)\b/.test(lower) && !lower.includes(targetSequence.name.toLowerCase()))) {
        const ranked = data.sequences.filter(sequence => sequenceHasSampleMetrics(sequence) && Number(sequence.people || 0) > 0).map(sequence => ({ sequence, rate: Number(sequence.replies || 0) / Number(sequence.people || 0) })).sort((a, b) => b.rate - a.rate);
        if (ranked.length) reportData = [{ title: "Sequence reply-to-enrollment", unit: "percent", items: ranked.map(({ sequence, rate }) => ({ label: sequence.name, value: rate * 100, display: `${Math.round(rate * 100)}% · ${sequence.replies}/${sequence.people} replies` })) }];
        reply = ranked.length ? `By reply-to-enrollment ratio in the sample data: ${ranked.map(({ sequence, rate }) => `${sequence.name} (${Math.round(rate * 100)}%, ${sequence.replies}/${sequence.people})`).join("; ")}. These are illustrative sample results, not live campaign analytics; local sequence plans do not send outreach. Open rates, delivery status, and attribution are unavailable.` : "There are no measured sequence performance results to compare. Local sequence plans do not send outreach.";
      }
      else {
        const hasSampleMetrics = sequenceHasSampleMetrics(targetSequence);
        const enrolled = sequencePlanEnrollmentCount(targetSequence);
        const replies = hasSampleMetrics ? Number(targetSequence.replies || 0) : null;
        const rate = hasSampleMetrics ? (enrolled ? `${Math.round(replies / enrolled * 100)}%` : "not available (no enrollments)") : "not available (local plan; no outreach sent)";
        const performanceSummary = hasSampleMetrics ? `${enrolled} sample enrollments and ${replies} sample replies (${rate}; illustrative only)` : `${enrolled} contacts in the local plan; campaign results are not available because it does not send outreach`;
        const plan = targetSequence.stepPlan || [];
        const emailIndex = plan.findIndex(step => step.channel === "Email");
        const productMessage = assistantContext.valueProposition?.trim() || assistantContext.companyProduct?.trim();
        if (emailIndex < 0) {
          reply = `${targetSequence.name} has ${performanceSummary}, but it has no email step to improve. I left the sequence unchanged.`;
          nextStepsTitle = "Review sequence steps";
          nextSteps = [{ title: "Open Sequences", detail: "Add or review a sequence email step before asking Luna to improve it.", module: "Sequences", targetType: "module", priority: 0 }];
        } else if (!productMessage) {
          reply = `${targetSequence.name} has ${performanceSummary}. I need your saved product context before drafting a grounded email change; I left the sequence unchanged.`;
          nextStepsTitle = "Ground the sequence draft";
          nextSteps = [{ title: "Add company and product context", detail: "Luna uses this context to draft relevant outreach without inventing a value proposition.", module: "Settings", targetType: "ai-context", priority: 0 }];
        } else {
          const style = effectiveWritingStyle || assistantContext.writingStyle || "";
          const greeting = /formal|professional/i.test(style) ? "Dear {{first_name}}," : "Hi {{first_name}},";
          const suggestedBody = [greeting, "", productMessage, "", "If this is relevant to your team, would a brief conversation be useful?", "", "Best,", "{{sender_name}}"].join("\n");
          const subject = "A practical idea for {{company}}";
          const updatedPlan = plan.map((step, index) => index !== emailIndex ? step : { ...step, subject, body: suggestedBody, instruction: `Subject: ${subject}` });
          reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "update-sequence-step", sequenceName: targetSequence.name, previousStepPlan: plan, stepPlan: updatedPlan, stepIndex: emailIndex, ...(hasSampleMetrics ? { performance: { value: `${rate} · sample`, detail: `${replies}/${enrolled} sample replies` } } : {}), label: "Compare first email · local sequence", summary: `${targetSequence.name} · first email · proposed rewrite`, status: "pending" };
          reply = `${targetSequence.name} has ${performanceSummary}. I drafted a value-led replacement for the first email using your saved product context. Compare the current and proposed copy, then edit the proposal if needed. This is a copy hypothesis, not a predicted performance lift. Local plans do not send outreach, and the sample has no step-level opens, clicks, bounces, or interested rates. Applying changes only this email step; other steps, enrollments, and status stay unchanged.`;
        }
      }
    } else if (!isAssistantSearchRequest && /\b(create|make)\b/.test(lower) && /\b(?:company|account)\s+lists?\b/.test(lower) && /\b(?:called|named)\b/.test(lower) && /\b(?:save|add|include)\b/.test(lower)) {
      const listNameMatch = prompt.match(/\b(?:called|named)\s+["'“]?(.+?)["'”]?(?=\s+(?:and\s+(?:save|add|include)|with|for)\b|[.!?]|$)/i);
      const listName = listNameMatch?.[1]?.trim().replace(/["'“”]+$/g, "");
      if (!matchedCompanies.length) reply = "Which companies should I save to the new list? Include names from this workspace.";
      else if (!listName) reply = "What should I name the new company list? Try: ‘Create a company list called Q1 SaaS and save Northstar Labs.’";
      else {
        const existingList = data.lists.find(list => list.type === "Companies" && list.name.toLowerCase() === listName.toLowerCase());
        const additions = matchedCompanies.filter(company => !(existingList?.members || []).includes(company.name));
        if (!additions.length && existingList) reply = `All ${matchedCompanies.length} selected companies are already in ${existingList.name}; I left it unchanged.`;
        else {
          const targetName = existingList?.name || listName;
          reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "save-companies-to-list", companies: additions, targetName, createList: !existingList, label: existingList ? "Save companies to list · local workspace" : "Create company list and save accounts · local workspace", summary: `${targetName} · ${additions.length} compan${additions.length === 1 ? "y" : "ies"}`, preview: additions.map(company => company.name).join(", "), status: "pending" };
          reply = existingList
            ? `Review adding ${additions.length} compan${additions.length === 1 ? "y" : "ies"} to the existing company list ${existingList.name}.`
            : `Review creating the company list ${listName} and saving ${additions.length} compan${additions.length === 1 ? "y" : "ies"} to it.`;
        }
      }
    } else if (!isAssistantSearchRequest && /\b(add|put|save|move)\b/.test(lower) && (data.lists.some(list => list.type === "Companies" && list.name && lower.includes(list.name.toLowerCase())) || /\b(?:company|account)\s+lists?\b/.test(lower))) {
      const targetList = data.lists.find(list => list.type === "Companies" && list.name && lower.includes(list.name.toLowerCase()));
      if (!matchedCompanies.length) reply = "Which companies should I add? Include company names from this workspace.";
      else if (!targetList) reply = `I found ${matchedCompanies.length} compan${matchedCompanies.length === 1 ? "y" : "ies"}. Which company list should I use? Include its exact name from the Lists workspace.`;
      else {
        const additions = matchedCompanies.filter(company => !(targetList.members || []).includes(company.name));
        if (!additions.length) reply = `All ${matchedCompanies.length} selected companies are already in ${targetList.name}; I left the list unchanged.`;
        else {
          reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "save-companies-to-list", companies: additions, targetName: targetList.name, createList: false, label: "Save companies to list · local workspace", summary: `${targetList.name} · ${additions.length} compan${additions.length === 1 ? "y" : "ies"}`, preview: additions.map(company => company.name).join(", "), status: "pending" };
          reply = `Review adding ${additions.length} compan${additions.length === 1 ? "y" : "ies"} to ${targetList.name}.`;
        }
      }
    } else if (!isAssistantSearchRequest && /\b(create|make)\b/.test(lower) && /\b(?:people\s+)?list\b/.test(lower) && /\b(?:called|named)\b/.test(lower) && /\b(?:save|add|include)\b/.test(lower)) {
      const listNameMatch = prompt.match(/\b(?:called|named)\s+["'“]?(.+?)["'”]?(?=\s+(?:and\s+(?:save|add|include)|with|for)\b|[.!?]|$)/i);
      const listName = listNameMatch?.[1]?.trim().replace(/["'“”]+$/g, "");
      if (!matchedContacts.length) reply = "Which contacts should I save to the new list? Include names from this workspace.";
      else if (!listName) reply = "What should I name the new People list? Try: ‘Create a list called Q1 SaaS and save Maya Patel.’";
      else {
        const existingList = data.lists.find(list => list.type === "People" && list.name.toLowerCase() === listName.toLowerCase());
        const additions = matchedContacts.filter(person => !(existingList?.members || []).includes(person.name));
        if (!additions.length && existingList) reply = `All ${matchedContacts.length} selected contacts are already in ${existingList.name}; I left it unchanged.`;
        else {
          const targetName = existingList?.name || listName;
          const previewNames = additions.map(person => person.name).join(", ");
          reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "save-people-to-list", people: additions, targetName, createList: !existingList, label: existingList ? "Save contacts to list · local workspace" : "Create list and save contacts · local workspace", summary: `${targetName} · ${additions.length} contact${additions.length === 1 ? "" : "s"}`, preview: previewNames, status: "pending" };
          reply = existingList
            ? `Review adding ${additions.length} contact${additions.length === 1 ? "" : "s"} to the existing People list ${existingList.name}.`
            : `Review creating the People list ${listName} and saving ${additions.length} contact${additions.length === 1 ? "" : "s"} to it.`;
        }
      }
    } else if (/\b(enroll|add|put|start)\b/.test(lower) && (/\b(sequence|sequences|outreach)\b/.test(lower) || data.sequences.some(sequence => lower.includes(sequence.name.toLowerCase())))) {
      const targetSequence = data.sequences.find(sequence => sequence.name && lower.includes(sequence.name.toLowerCase()));
      if (!matchedContacts.length) reply = "Which contacts should I enroll? Include names from this workspace.";
      else if (!targetSequence) reply = `I found ${matchedContacts.length} contact${matchedContacts.length === 1 ? "" : "s"}. Which sequence should I use? Include the exact sequence name from the Sequences workspace.`;
      else {
        const additions = matchedContacts.filter(person => !(targetSequence.enrolledPeople || []).includes(person.name));
        if (!additions.length) reply = `All ${matchedContacts.length} selected contacts are already enrolled in ${targetSequence.name}; I left it unchanged.`;
        else {
          reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "enroll-people-in-sequence", people: additions, targetName: targetSequence.name, label: "Add contacts to sequence plan · local workspace", summary: `${targetSequence.name} · ${additions.length} contact${additions.length === 1 ? "" : "s"}`, preview: additions.map(person => person.name).join(", "), status: "pending" };
          reply = `Review adding ${additions.length} contact${additions.length === 1 ? "" : "s"} to ${targetSequence.name}. This local action enrolls them in the sequence plan; no outreach will be sent.`;
        }
      }
    } else if (/\b(reschedule|move|postpone|push back)\b/.test(lower) && /\btasks?\b/.test(lower)) {
      const dueDate = assistantRequestedDate(lower);
      const mentionedPeople = matchedContacts.map(person => person.name);
      const candidates = data.tasks.filter(task => !task.done && (
        lower.includes(String(task.title || "").toLowerCase())
        || (mentionedPeople.includes(task.person) && /\b(all|their|tasks?|follow.?up)\b/.test(lower))
      ));
      if (!candidates.length) reply = "Which open task should I reschedule? Include its task title or the contact name from the Tasks workspace.";
      else if (!dueDate) reply = `I found ${candidates.length} open task${candidates.length === 1 ? "" : "s"}. What date should I move ${candidates.length === 1 ? "it" : "them"} to?`;
      else {
        const due = formatTaskDue(dueDate);
        reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "reschedule-tasks", tasks: candidates, dueDate, due, label: `Reschedule ${candidates.length === 1 ? "task" : "tasks"} · local workspace`, summary: `${candidates.length} task${candidates.length === 1 ? "" : "s"} · ${due}`, preview: `${candidates.map(task => task.title).join("\n")}\n\nNew due date: ${due}`, status: "pending" };
        reply = `Review moving ${candidates.length} open task${candidates.length === 1 ? "" : "s"} to ${due}.`;
      }
    } else if (/\b(rename|retitle|prioriti[sz]e|priority|assign|reassign|annotate)\b/.test(lower) && /\btasks?\b/.test(lower)) {
      const mentionedPeople = matchedContacts.map(person => person.name);
      const candidates = data.tasks.filter(task =>
        lower.includes(String(task.title || "").toLowerCase())
        || (mentionedPeople.includes(task.person) && /\b(all|their|tasks?|follow.?up)\b/.test(lower))
      );
      const changes = {};
      let changeSummary = "";
      const renameMatch = prompt.match(/\b(?:rename|retitle)\b.+?\bto\s+["'“]?(.+?)["'”]?\s*$/i);
      const priority = lower.match(/\b(high|medium|normal|low)\s+priority\b|\bpriority\s+(high|medium|normal|low)\b/)?.slice(1).find(Boolean);
      const assignMatch = prompt.match(/\b(?:assign|reassign)\b.+?\bto\s+([\p{L}][\p{L} .'’-]*?)\s*$/iu);
      const noteMatch = prompt.match(/\b(?:with note|note:|annotate(?: it)? with)\s*[:\-]?\s*(.+)$/i);
      if (renameMatch) { changes.title = renameMatch[1].trim().replace(/[.!?]+$/, ""); changeSummary = `rename to “${changes.title}”`; }
      else if (priority) { changes.priority = priority.toLowerCase(); changeSummary = `priority ${changes.priority}`; }
      else if (assignMatch) { changes.assignedTo = assignMatch[1].trim().replace(/[.!?]+$/, ""); changeSummary = `assignment to ${changes.assignedTo}`; }
      else if (noteMatch) { changes.notes = noteMatch[1].trim().replace(/^['"“]|['"”]$/g, ""); changeSummary = "add a note"; }
      if (!candidates.length) reply = mentionedPeople.length
        ? `I couldn't find an open task for ${mentionedPeople.join(", ")}. Include the exact task title shown in Tasks.`
        : "Which task should I update? Include its title from the Tasks workspace.";
      else if (renameMatch && candidates.length > 1) reply = "I found multiple tasks. Name one exact task title to rename it.";
      else if (!Object.keys(changes).length) reply = "What change should I make? Try a new title, a high/medium/low priority, an assignee, or a note.";
      else {
        const preview = `${candidates.map(task => task.title).join("\n")}\n\n${changeSummary}${changes.notes ? `: ${changes.notes}` : ""}`;
        reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "edit-tasks", tasks: candidates, changes, changeSummary, label: `Update ${candidates.length === 1 ? "task" : "tasks"} · local workspace`, summary: `${candidates.length} task${candidates.length === 1 ? "" : "s"} · ${changeSummary}`, preview, status: "pending" };
        reply = `Review ${changeSummary} for ${candidates.length} task${candidates.length === 1 ? "" : "s"}.`;
      }
    } else if (/\b(complete|finish|skip|mark done|mark complete)\b/.test(lower) && /\btasks?\b/.test(lower)) {
      const taskStatus = /\bskip\b/.test(lower) ? "Skipped" : "Completed";
      const mentionedPeople = matchedContacts.map(person => person.name);
      const candidates = data.tasks.filter(task => !task.done && (
        lower.includes(String(task.title || "").toLowerCase())
        || (mentionedPeople.includes(task.person) && /\b(all|their|tasks?|follow.?up)\b/.test(lower))
      ));
      const noteMatch = prompt.match(/\b(?:with note|note)\s*[:\-]?\s*(.+)$/i);
      const note = noteMatch?.[1]?.trim().replace(/^['"“]|['"”]$/g, "") || "";
      if (!candidates.length) reply = mentionedPeople.length
        ? `I couldn't find an open task for ${mentionedPeople.join(", ")}. Ask for the exact task title shown in Tasks.`
        : "Which open task should I complete? Include its task title from the Tasks workspace.";
      else {
        reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "complete-tasks", tasks: candidates, taskStatus, note, label: `${taskStatus === "Skipped" ? "Skip" : "Complete"} ${candidates.length === 1 ? "task" : "tasks"} · local workspace`, summary: `${candidates.length} open task${candidates.length === 1 ? "" : "s"} · ${taskStatus.toLowerCase()}${note ? " · note" : ""}`, preview: `${candidates.map(task => task.title).join("\n")}${note ? `\n\nNote: ${note}` : ""}`, status: "pending" };
        reply = `Review marking ${candidates.length} open task${candidates.length === 1 ? "" : "s"} ${taskStatus === "Skipped" ? "skipped" : "complete"}${note ? " with your note" : ""}.`;
      }
    } else if (!isAssistantSearchRequest && /\b(add|put|save|move)\b/.test(lower) && (/\blists?\b/.test(lower) || data.lists.some(list => list.type === "People" && list.name && lower.includes(list.name.toLowerCase())))) {
      const targetList = data.lists.find(list => list.type === "People" && list.name && lower.includes(list.name.toLowerCase()));
      if (!matchedContacts.length) reply = "Which contacts should I add? Include names from this workspace.";
      else if (!targetList) reply = `I found ${matchedContacts.length} contact${matchedContacts.length === 1 ? "" : "s"}. Which People list should I add them to? Use the list's exact name from the Lists workspace.`;
      else {
        const currentList = data.lists.find(list => list.name === targetList.name);
        const additions = matchedContacts.filter(person => !(currentList?.members || []).includes(person.name));
        if (!additions.length) reply = `All ${matchedContacts.length} selected contacts are already in ${targetList.name}; I left the list unchanged.`;
        else {
          reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "save-people-to-list", people: additions, targetName: targetList.name, createList: false, label: "Save contacts to list · local workspace", summary: `${targetList.name} · ${additions.length} contact${additions.length === 1 ? "" : "s"}`, preview: additions.map(person => person.name).join(", "), status: "pending" };
          reply = `Review adding ${additions.length} contact${additions.length === 1 ? "" : "s"} to ${targetList.name}. If applied, each new contact will be saved in this browser workspace and matching local workflows will run.`;
        }
      }
    } else if (/\b(create|add|make)\b/.test(lower) && /\btasks?\b/.test(lower)) {
      if (!matchedContacts.length) reply = "Which contacts should I assign tasks to? Include names from this workspace.";
      else if (isConversationTaskRequest) {
        const useCallLogs = /\bcall log\b/.test(lower);
        const sources = matchedContacts.map(person => {
          const recording = useCallLogs ? null : data.recordings.find(item => item.person === person.name);
          const call = useCallLogs ? data.calls.find(item => item.person === person.name && lower.includes(item.time.toLowerCase())) || data.calls.find(item => item.person === person.name) : null;
          return { person, recording, call };
        });
        const available = sources.filter(source => source.recording || source.call);
        if (!available.length) reply = useCallLogs
          ? `I couldn't find a saved call log for ${matchedContacts.map(person => person.name).join(" and ")}. I need a saved call note before I can suggest a grounded follow-up task.`
          : `I couldn't find saved call summaries for ${matchedContacts.map(person => person.name).join(" and ")}. I need conversation notes before I can suggest a grounded follow-up task.`;
        else {
          const dueDate = assistantRequestedDate(lower) || localDateValue();
          const due = formatTaskDue(dueDate);
          const tasks = available.map(({ person, recording, call }) => {
            const sourceText = recording?.summary || call.note;
            const actionable = sourceText.split(/[.!?]/).map(sentence => sentence.trim()).find(sentence => /\b(?:follow up|send|share|provide|schedule|review|prepare|confirm|reach out|reconnect|book|deliver)\b/i.test(sentence));
            const need = sourceText.match(/\bneeds?\s+(.+?)(?:\s+before\b|[.!?]|$)/i)?.[1]?.trim();
            const planning = sourceText.match(/\bplanning to\s+(.+?)(?:[.!?]|$)/i)?.[1]?.trim();
            const title = actionable || (need ? `Send ${need} to ${person.name}` : planning ? `Follow up on ${planning}` : `Follow up with ${person.name}`);
            const sourceTitle = recording?.title || `Call log · ${call.time}`;
            return { title, person: person.name, due, dueDate, type: "Follow-up", done: false, notes: `From ${sourceTitle}: ${sourceText}` };
          });
          const sourceRecordings = available.filter(item => item.recording).map(({ recording }) => ({ title: recording.title, person: recording.person, summary: recording.summary }));
          const sourceCalls = available.filter(item => item.call).map(({ call }) => ({ person: call.person, time: call.time, outcome: call.outcome, note: call.note }));
          reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "create-follow-up-tasks", tasks, ...(sourceRecordings.length ? { sourceRecordings } : {}), ...(sourceCalls.length ? { sourceCalls } : {}), due, label: `Create ${tasks.length === 1 ? "task from call takeaway" : "tasks from call takeaways"} · local workspace`, summary: `${tasks.length} call takeaway${tasks.length === 1 ? "" : "s"} · due ${due.toLowerCase()}`, preview: tasks.map(task => `${task.title} · ${task.person} · ${task.due}\n${task.notes}`).join("\n\n"), status: "pending" };
          nextStepsTitle = sourceRecordings.length ? (sourceRecordings.length === 1 ? "Source call recording" : "Source call recordings") : "Source call log";
          nextSteps = sourceRecordings.length
            ? available.filter(item => item.recording).map(({ recording }) => ({ title: recording.title, detail: `${recording.person} · ${recording.date} · ${recording.duration}`, module: "Conversations", targetType: "recording", targetTitle: recording.title, targetPerson: recording.person, priority: 0 }))
            : sourceCalls.map(call => ({ title: `Call with ${call.person}`, detail: `${call.outcome} · ${call.time}`, module: "Calls", priority: 0 }));
          reply = useCallLogs
            ? `Review ${tasks.length} follow-up task${tasks.length === 1 ? "" : "s"} suggested from saved call log notes. These are local records, not a new transcript or live Apollo analysis.`
            : `Review ${tasks.length} follow-up task${tasks.length === 1 ? "" : "s"} suggested from saved call summaries. These notes are local records, not a new transcription or live Apollo analysis.`;
        }
      }
      else {
        const dueDate = assistantRequestedDate(lower) || localDateValue();
        const due = formatTaskDue(dueDate);
        const tasks = matchedContacts.map(person => ({ title: `Follow up with ${person.name}`, person: person.name, due, dueDate, type: "Follow-up", done: false }));
        reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "create-follow-up-tasks", tasks, due, label: `Create ${tasks.length === 1 ? "follow-up task" : "follow-up tasks"} · local workspace`, summary: `${tasks.length} contact${tasks.length === 1 ? "" : "s"} · due ${due.toLowerCase()}`, preview: tasks.map(task => task.title).join("\n"), status: "pending" };
        reply = `Review creating ${tasks.length} follow-up task${tasks.length === 1 ? "" : "s"}, due ${due.toLowerCase()}.`;
      }
    } else if (!isPerformanceReportRequest && ((!isTaskQueueSearch && /\b(find|search|show|who|prospect|contact|people|discover|qualify|identify|match)\b/.test(lower)) || (searchingCompanies && /\b(build|target|prioritize)\b/.test(lower)))) {
      const isFreeformProspectingQuery = isAssistantSearchRequest && !matchedContact && !matchedCompany && !/\b(?:list|sequence)\b/.test(lower);
      if (/\b(ideal customer profile|icp|best.fit|rank|score|prioriti[sz]e)\b/.test(lower) || isFreeformProspectingQuery) {
        const contextText = `${assistantContext.idealCustomerProfile || ""} ${memory.targetAudience || ""} ${lower} ${activeAssistantChat?.chatInstructions || ""}`;
        const sampleCityNames = [...new Set([...workspacePeople, ...data.companies].map(record => String(record.location || "").split(",")[0].trim()).filter(Boolean))];
        const promptTerritory = memory.territory || sampleCityNames.find(city => lower.includes(city.toLowerCase()))
          || (/\b(?:united states|u\.s\.|usa)\b/.test(lower) ? "United States" : /\b(?:united kingdom|uk)\b/.test(lower) ? "UK" : "");
        const contextWords = [...new Set(contextText.toLowerCase().match(/[a-z0-9]{3,}/g) || [])]
          .filter(word => !["and", "the", "for", "with", "that", "this", "from", "our", "their", "your", "who", "are", "have", "has", "can", "will", "into", "over", "under", "company", "companies", "customer", "customers", "product", "products", "service", "services", "ideal", "profile", "find", "people", "prospects", "matches", "match", "best", "fit", "rank", "ranked", "score", "scoring", "qualify", "qualifying", "my", "icp"].includes(word));
        if (!contextWords.length) reply = "I can rank sample records when the ICP includes a role or industry. Add those criteria in Admin settings → AI Context, or describe them in your request.";
        else {
          const candidates = searchingCompanies ? data.companies : workspacePeople;
          const evaluated = candidates.map(record => {
            const company = searchingCompanies ? record : data.companies.find(item => item.name === record.company);
            const linkedPeople = searchingCompanies ? workspacePeople.filter(person => person.company === record.name) : [];
            const roleText = searchingCompanies ? linkedPeople.map(person => `${person.title || ""} ${person.role || ""}`).join(" ") : `${record.title || ""} ${record.role || ""}`;
            const scoreTarget = searchingCompanies
              ? { ...record, company: record.name, title: roleText }
              : record;
            const fit = scoreLocalProspectFit(scoreTarget, contextText, promptTerritory, data.companies);
            return { record, score: fit.score, reasons: fit.reasons, coverage: fit.coverage };
          });
          const ranked = evaluated.filter(item => item.score !== null && item.score > 0)
            .sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name)).slice(0, 5);
          const hasIcpCriteria = evaluated.some(item => Number(item.coverage?.expected) > 0);
          const recordsWithCoverage = evaluated.filter(item => Number(item.coverage?.available) > 0).length;
          if (ranked.length) reportData = [{ title: "Local ICP fit estimate", unit: "percent", items: ranked.map(({ record, score, coverage }) => ({ label: record.name, value: score, display: `${score}% fit · ${coverage.percent}% data coverage` })) }];
          reply = ranked.length
            ? `Top local ICP matches: ${ranked.map(({ record, score, reasons, coverage }) => `${record.name} · ${score}% fit · ${coverage.percent}% data coverage (${coverage.available}/${coverage.expected} criteria) · ${reasons.length ? reasons.join("; ") : "no matching available criteria"}${searchingCompanies ? ` · ${record.industry || "industry unavailable"} · ${record.employees || "employee count unavailable"} employees · ${record.location || "location unavailable"}` : ` · ${record.title || record.role || "title unavailable"} at ${record.company || "company unavailable"}`}`).join("; ")}. Scores use the same rubric as the Lead discovery agent; absent fields are excluded from each score and reduce its coverage. These are local estimates, not Apollo AI scoring, web research, or live qualification.`
            : !hasIcpCriteria
              ? "I don't have target criteria to rank yet. Tell me the roles and industries you want, or add them under Admin settings → AI Context."
              : !recordsWithCoverage
                ? "The sample records don't contain the fields needed for this ICP, so I can't score them reliably. Add supported role or industry criteria, or connect Apollo for live qualification and research."
                : "No local sample records matched the requested ICP fields. Try changing the target roles, industry, size, or territory; live Apollo qualification and web research need an Apollo connection.";
          if (searchingCompanies && ranked.length) {
            nextStepsTitle = "Accounts to review";
            nextSteps = ranked.map(({ record, score, reasons, coverage }, priority) => ({
              title: record.name,
              detail: `${score}% fit · ${coverage.percent}% data coverage · ${reasons.join(" · ")} · ${record.industry || "industry unavailable"} · ${record.employees || "employee count unavailable"} employees · ${record.location || "location unavailable"}`,
              module: "Companies",
              targetType: "company",
              targetTitle: record.name,
              priority,
            }));
          }
          if (ranked.length && /\b(save|add|include)\b/.test(lower)) {
            const targetListType = searchingCompanies ? "Companies" : "People";
            const targetList = data.lists.find(list => list.type === targetListType && list.name && lower.includes(list.name.toLowerCase()));
            const listNameMatch = prompt.match(/\b(?:called|named)\s+["'“]?(.+?)["'”]?(?=\s+(?:and\s+)?(?:save|add|include)\b|[.!?]|$)/i);
            const requestedNewListName = listNameMatch?.[1]?.trim().replace(/["'“”]+$/g, "");
            const destinationName = targetList?.name || requestedNewListName;
            const matches = ranked.map(item => item.record);
            if (!destinationName) reply += ` Name an existing ${targetListType === "Companies" ? "Companies" : "People"} list, or say “create a list called …,” and I can prepare these top ${matches.length} matches for review.`;
            else {
              const existingMembers = new Set((targetList?.members || []).map(name => String(name).toLowerCase()));
              const additions = matches.filter(record => !existingMembers.has(record.name.toLowerCase()));
              if (!additions.length) reply += ` All ${matches.length} ranked matches are already in ${destinationName}; I left it unchanged.`;
              else {
                reviewAction = searchingCompanies
                  ? { id: `review-${Date.now()}`, type: "local-write", operation: "save-companies-to-list", companies: additions, targetName: destinationName, createList: !targetList, label: targetList ? "Save ranked accounts to list · local workspace" : "Create ranked account list · local workspace", summary: `${destinationName} · ${additions.length} account${additions.length === 1 ? "" : "s"}`, preview: additions.map(company => company.name).join(", "), status: "pending" }
                  : { id: `review-${Date.now()}`, type: "local-write", operation: "save-people-to-list", people: additions, targetName: destinationName, createList: !targetList, label: targetList ? "Save ranked contacts to list · local workspace" : "Create ranked People list · local workspace", summary: `${destinationName} · ${additions.length} contact${additions.length === 1 ? "" : "s"}`, preview: additions.map(person => person.name).join(", "), status: "pending" };
                reply += ` Review adding ${additions.length} of the top ${matches.length} ranked ${searchingCompanies ? "accounts" : "contacts"} to ${destinationName}.`;
              }
            }
          }
        }
      } else {
      const targetListType = searchingCompanies ? "Companies" : "People";
      const targetList = data.lists.find(list => list.type === targetListType && list.name && lower.includes(list.name.toLowerCase()));
      const listNameMatch = prompt.match(/\b(?:called|named)\s+["'“]?(.+?)["'”]?(?=\s+(?:and\s+)?(?:save|add|include)\b|[.!?]|$)/i);
      const requestedNewListName = listNameMatch?.[1]?.trim().replace(/["'“”]+$/g, "");
      const searchPrompt = lower.replace(targetList?.name.toLowerCase() || "", "").replace(requestedNewListName?.toLowerCase() || "", "");
      const ignoredSearchTerms = new Set(["find", "search", "summarize", "summary", "prospects", "prospect", "contacts", "contact", "people", "company", "companies", "account", "accounts", "organization", "organizations", "business", "businesses", "selected", "relevant", "workspace", "records", "local", "show", "who", "with", "from", "the", "for", "and", "these", "them", "my", "in", "at", "on", "to", "near", "around", "based", "targeting", "target", "mid", "market", "hiring", "hired", "me", "please", "save", "add", "include", "create", "make", "new", "list", "lists", "called", "named", "matches", "match", "top"]);
      const queryTerms = (searchPrompt.match(/[a-z0-9]+/g) || []).filter(term => term.length > 2 && !ignoredSearchTerms.has(term));
      const relatedTerms = [["saas", "software"], ["tech", "technology", "software"], ["cybersecurity", "cyber", "security"], ["fintech", "financial", "finance"], ["leader", "leaders", "vp", "chief", "director", "head"], ["sales", "revenue"], ["marketing", "demand", "growth"]];
      const expandedTerms = new Set(queryTerms);
      relatedTerms.forEach(group => { if (group.some(term => queryTerms.includes(term))) group.forEach(term => expandedTerms.add(term)); });
      const rankedMatches = searchingCompanies ? data.companies.map(company => {
        const text = [company.name, company.domain, company.industry, company.location, company.description, company.technologies, company.status].filter(Boolean).join(" ").toLowerCase();
        const recordWords = new Set(text.match(/[a-z0-9]+/g) || []);
        const matched = [...expandedTerms].filter(term => recordWords.has(term));
        return { record: company, matched, score: matched.length };
      }) : workspacePeople.map(person => {
        const company = data.companies.find(item => item.name === person.company);
        const text = [person.name, person.title, person.role, person.company, person.location, person.email, company?.industry, company?.description].filter(Boolean).join(" ").toLowerCase();
        const recordWords = new Set(text.match(/[a-z0-9]+/g) || []);
        const matched = [...expandedTerms].filter(term => recordWords.has(term));
        return { record: person, matched, score: matched.length };
      }).filter(item => item.score > 0);
      const matches = rankedMatches.filter(item => item.score > 0 || (!expandedTerms.size && searchingCompanies)).sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name)).slice(0, 5);
      const liveSearchStarted = !searchingCompanies && /\b(find|search|show|who|prospect|contact|people)\b/.test(lower) && onSearchPeople?.(prompt);
      if (liveSearchStarted) {
        reply = `Opening People Search and running a live Apollo query for “${prompt}”.`;
      } else if (searchingCompanies) {
        reply = matches.length
          ? `Top local company matches: ${matches.map(({ record, matched }) => `${record.name} · ${record.industry} · ${record.employees} employees · ${record.location}${matched.length ? ` (matched ${matched.slice(0, 3).join(", ")})` : ""}`).join("; ")}. These sample records do not include live hiring, funding, intent, or web research.`
          : "I couldn't find a matching company in the local sample records. This demo does not have live company search, hiring signals, or web research; connect Apollo to run those searches.";
        if (matches.length) {
          nextStepsTitle = "Companies to review";
          nextSteps = matches.map(({ record, matched }, priority) => ({
            title: record.name,
            detail: `${record.industry} · ${record.employees} employees · ${record.location}${matched.length ? ` · matched ${matched.slice(0, 3).join(", ")}` : ""}`,
            module: "Companies",
            targetType: "company",
            targetTitle: record.name,
            priority,
          }));
        }
      } else reply = matches.length ? `Top local matches: ${matches.map(({ record, matched }) => `${record.name} · ${record.title || record.role || "Title unavailable"} at ${record.company || "Company unavailable"} (matched ${matched.slice(0, 3).join(", ")})`).join("; ")}. Results are ranked by simple keyword overlap and use local records only; they are not Apollo AI qualification or web research.` : "I couldn't find a match in the contacts in this browser workspace. Use Find people to run a live Apollo search if an API key is configured.";
      if (!liveSearchStarted && matches.length && /\b(save|add|include)\b/.test(lower) && (targetList || requestedNewListName)) {
        const destinationName = targetList?.name || requestedNewListName;
        const additions = matches.map(item => item.record).filter(record => !(targetList?.members || []).includes(record.name));
        if (!additions.length) reply += ` All ${matches.length} matched ${searchingCompanies ? "companies" : "contacts"} are already in ${destinationName}.`;
        else {
          const action = searchingCompanies
            ? { id: `review-${Date.now()}`, type: "local-write", operation: "save-companies-to-list", companies: additions, targetName: destinationName, createList: !targetList, label: targetList ? "Save companies to list · local workspace" : "Create company list from search · local workspace", summary: `${destinationName} · ${additions.length} compan${additions.length === 1 ? "y" : "ies"}`, preview: additions.map(company => company.name).join(", "), status: "pending" }
            : { id: `review-${Date.now()}`, type: "local-write", operation: "save-people-to-list", people: additions, targetName: destinationName, createList: !targetList, label: targetList ? "Save contacts to list · local workspace" : "Create People list from search · local workspace", summary: `${destinationName} · ${additions.length} contact${additions.length === 1 ? "" : "s"}`, preview: additions.map(person => person.name).join(", "), status: "pending" };
          reviewAction = action;
          reply += ` Review saving these ${additions.length} matched ${searchingCompanies ? "companies" : "contacts"} to ${targetList ? "the existing" : "a new"} ${searchingCompanies ? "Companies" : "People"} list “${destinationName}”.`;
        }
      }
      }
    } else if (/deal|pipeline|revenue|forecast/.test(lower)) {
      const openDeals = data.deals.filter(deal => !closedDealStages.has(deal.stage));
      const total = openDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
      const stageItems = stages.filter(stage => !closedDealStages.has(stage)).map(stage => ({ label: stage, value: openDeals.filter(deal => deal.stage === stage).reduce((sum, deal) => sum + Number(deal.amount || 0), 0), display: fmtMoney(openDeals.filter(deal => deal.stage === stage).reduce((sum, deal) => sum + Number(deal.amount || 0), 0)) }));
      const stagesSummary = stageItems.map(item => `${item.label}: ${item.display}`).join(" · ");
      reportData = [{ title: "Open pipeline by stage", unit: "currency", items: stageItems }];
      reply = `The local pipeline has ${openDeals.length} open deals worth ${fmtMoney(total)}. ${stagesSummary || "There are no open deals."}`;
    } else if (isTaskQueueSearch || /task|follow.?up|what should/.test(lower)) {
      const today = localDateValue();
      if (isTaskQueueSearch) {
        const requestedPriority = lower.match(/\b(high|medium|normal|low)\s+priority\b|\bpriority\s+(high|medium|normal|low)\b/)?.slice(1).find(Boolean);
        const requestedStatus = /\b(?:completed|complete|finished|done)\b/.test(lower) ? "completed" : /\bskipped\b/.test(lower) ? "skipped" : /\b(?:all|every)\b/.test(lower) ? "all" : "open";
        const requestedType = [...new Set(data.tasks.map(task => String(task.type || "").toLowerCase()).filter(Boolean))].find(type => lower.includes(type));
        const requestedAssignee = [...new Set(data.tasks.map(task => task.assignedTo).filter(Boolean))].find(name => lower.includes(name.toLowerCase()));
        const requestedSequence = data.sequences.find(sequence => sequence.name && lower.includes(sequence.name.toLowerCase()));
        const requestedTask = data.tasks.find(task => task.title && lower.includes(task.title.toLowerCase()));
        const hasDeadlineFilter = /\b(overdue|late|today|upcoming)\b/.test(lower);
        const filteredTasks = data.tasks.filter(task => {
          const dueDate = task.dueDate || (task.due === "Today" ? today : "");
          return (requestedStatus === "all" || (requestedStatus === "completed" && task.done && task.taskStatus !== "Skipped") || (requestedStatus === "skipped" && task.done && task.taskStatus === "Skipped") || (requestedStatus === "open" && !task.done))
            && (!requestedPriority || String(task.priority || "").toLowerCase() === requestedPriority)
            && (!requestedType || String(task.type || "").toLowerCase() === requestedType)
            && (!requestedAssignee || task.assignedTo === requestedAssignee)
            && (!requestedSequence || String(task.sequence || "").toLowerCase() === requestedSequence.name.toLowerCase())
            && (!requestedTask || task.title === requestedTask.title)
            && (!matchedContact || task.person === matchedContact.name)
            && (!hasDeadlineFilter || (lower.includes("overdue") || lower.includes("late") ? Boolean(dueDate && dueDate < today && !task.done) : lower.includes("today") ? dueDate === today && !task.done : !dueDate || dueDate > today))
            && (!requestedTask && !matchedContact && !requestedType && !requestedPriority && !requestedAssignee && !requestedSequence && !hasDeadlineFilter || Boolean(requestedTask) || Boolean(matchedContact) || Boolean(requestedType) || Boolean(requestedPriority) || Boolean(requestedAssignee) || Boolean(requestedSequence) || hasDeadlineFilter);
        });
        const qualifier = [requestedStatus !== "all" ? requestedStatus : "", requestedPriority ? `${requestedPriority}-priority` : "", requestedType ? `${requestedType} type` : "", requestedAssignee ? `assigned to ${requestedAssignee}` : "", requestedSequence ? `from ${requestedSequence.name}` : "", matchedContact?.name || "", requestedTask?.title || "", hasDeadlineFilter ? (lower.includes("overdue") || lower.includes("late") ? "overdue" : lower.includes("today") ? "due today" : "upcoming") : ""].filter(Boolean).join(" · ");
        if (!filteredTasks.length) reply = `No ${qualifier || "matching"} tasks were found in this browser workspace. The local task records may not include every field available in Apollo.`;
        else {
          const selectedTasks = filteredTasks.slice(0, 10);
          nextStepsTitle = `${filteredTasks.length} ${qualifier || "matching"} task${filteredTasks.length === 1 ? "" : "s"}`;
          nextSteps = selectedTasks.map(task => ({ title: task.title, detail: [task.person, task.dueDate ? formatTaskDue(task.dueDate) : task.due, task.done ? task.taskStatus || "Completed" : "Open", task.priority ? `${task.priority} priority` : "", task.assignedTo ? `Assigned to ${task.assignedTo}` : "", task.type || "", task.sequence || "", task.notes || ""].filter(Boolean).join(" · "), module: "Tasks", targetType: "task", targetTitle: task.title, targetPerson: task.person, priority: 0 }));
          reply = `I found ${filteredTasks.length} ${qualifier || "matching"} task${filteredTasks.length === 1 ? "" : "s"} in this browser workspace. Select a result to open its full task record${filteredTasks.length > selectedTasks.length ? `; showing the first ${selectedTasks.length}` : ""}.`;
        }
      } else {
      const openTasks = data.tasks.filter(task => !task.done);
      const dueTasks = openTasks.filter(task => task.due === "Today" || (task.dueDate && task.dueDate <= today));
      const unread = data.emails.filter(email => (email.folder || "Inbox") === "Inbox" && email.unread);
      const upcoming = data.meetings.filter(meeting => !meeting.past && meeting.status !== "No-show");
      const unansweredCalls = data.calls.filter(call => /no answer|voicemail|busy|failed/i.test(call.outcome || ""));
      const insights = data.recordings.filter(item => /follow.?up|needs? .*before|next step|send .*information/i.test(item.summary || ""));
      nextSteps = [
        ...dueTasks.map(task => ({ title: task.title, detail: `${task.person} · ${task.dueDate && task.dueDate < today ? "Overdue" : task.due || "Due today"}`, module: "Tasks", targetType: "task", targetTitle: task.title, targetPerson: task.person, priority: task.dueDate && task.dueDate < today ? 0 : 1 })),
        ...unread.map(email => ({ title: `Reply to ${email.from}`, detail: `${email.subject} · ${email.preview}`, module: "Emails", targetType: "email", targetSubject: email.subject, targetFrom: email.from, priority: 2 })),
        ...upcoming.slice(0, 3).map(meeting => ({ title: `Prepare for ${meeting.title}`, detail: `${meeting.person} · ${meeting.time}`, module: "Meetings", targetType: "meeting", targetTitle: meeting.title, targetPerson: meeting.person, priority: 3 })),
        ...unansweredCalls.map(call => ({ title: `Retry call with ${call.person}`, detail: `${call.company || "Contact"} · ${call.outcome}${call.note ? ` · ${call.note}` : ""}`, module: "Calls", targetType: "call", targetPerson: call.person, targetTime: call.time, priority: 4 })),
        ...insights.filter(item => !upcoming.some(meeting => meeting.person === item.person)).map(item => ({ title: `Review ${item.person}'s call follow-up`, detail: item.summary, module: "Conversations", targetType: "recording", targetTitle: item.title, targetPerson: item.person, priority: 5 })),
        ...openTasks.filter(task => !dueTasks.includes(task)).map(task => ({ title: task.title, detail: `${task.person} · ${task.due || "Upcoming"}`, module: "Tasks", targetType: "task", targetTitle: task.title, targetPerson: task.person, priority: 6 })),
      ].sort((a, b) => a.priority - b.priority).slice(0, 6);
      reply = nextSteps.length
        ? `Here are the next follow-ups I can identify from this browser workspace, ordered by due date and engagement signals. ${dueTasks.length} task${dueTasks.length === 1 ? " is" : "s are"} due or overdue; ${unread.length} inbox message${unread.length === 1 ? " is" : "s are"} unread; ${upcoming.length} meeting${upcoming.length === 1 ? " is" : "s are"} upcoming. These are sample local records, not a live Apollo priority score.`
        : "I don't see overdue or due-today tasks, unread inbox messages, unanswered calls, or upcoming meetings in this browser workspace.";
      }
    } else if (/\b(?:prepare|prep|brief|research)\b/.test(lower) && /\b(?:meeting|calendar)\b/.test(lower)) {
      const upcomingMeetings = data.meetings.filter(meeting => !meeting.past && meeting.status !== "No-show");
      const selectedMeetings = upcomingMeetings.filter(meeting => !matchedContact && !matchedCompany
        || meeting.person === matchedContact?.name
        || (matchedCompany && meeting.title.startsWith(`${matchedCompany.name} ·`))
        || (matchedContact && meeting.title.startsWith(`${matchedContact.company} ·`)));
      const meetingsToPrepare = (matchedContact || matchedCompany ? selectedMeetings : upcomingMeetings).slice(0, matchedContact || matchedCompany ? 1 : 4);
      if (!meetingsToPrepare.length) reply = matchedContact || matchedCompany
        ? `I couldn't find an upcoming meeting for ${matchedContact?.name || matchedCompany?.name} in this browser workspace.`
        : "There are no upcoming meetings in this browser workspace to prepare for.";
      else {
        const meetingBriefs = meetingsToPrepare.map(meeting => {
          const person = workspacePeople.find(item => item.name === meeting.person) || data.savedPeople.find(item => item.name === meeting.person);
          const companyName = person?.company || matchedCompany?.name || meeting.title.split(" · ")[0];
          const company = data.companies.find(item => item.name === companyName);
          const deal = data.deals.find(item => item.company === companyName && !closedDealStages.has(item.stage));
          const accountContacts = workspacePeople.filter(item => item.company === companyName && item.name !== meeting.person).slice(0, 3);
          const openTasks = data.tasks.filter(task => task.person === meeting.person && !task.done).slice(0, 3);
          const messages = data.emails.filter(email => email.from === meeting.person || email.subject.toLowerCase().includes(companyName.toLowerCase())).slice(0, 2);
          const priorCalls = data.recordings.filter(recording => recording.person === meeting.person).slice(0, 2);
          const facts = [
            `${meeting.title} with ${meeting.person} · ${meeting.time}${meeting.duration ? ` · ${meeting.duration}` : ""}.`,
            person && `Contact: ${person.title || person.role || "title unavailable"}${person.email ? ` · ${person.email}` : ""}.`,
            company && `Account: ${company.industry}, ${company.employees} employees, based in ${company.location}.`,
            accountContacts.length && `Other known contacts: ${accountContacts.map(item => `${item.name} (${item.title || item.role || "role unavailable"})`).join(", ")}.`,
            deal && `Open deal: ${deal.name} · ${fmtMoney(deal.amount)} · ${deal.stage} · expected close ${deal.close}.`,
            openTasks.length && `Open tasks: ${openTasks.map(task => `${task.title} (${task.due || task.dueDate || "no due date"})`).join("; ")}.`,
            messages.length && `Recent email context: ${messages.map(email => `${email.subject} — ${email.preview}`).join("; ")}.`,
            priorCalls.length && `Previous call insight: ${priorCalls.map(recording => `${recording.date}: ${recording.summary}`).join("; ")}.`,
          ].filter(Boolean);
          return { meeting, brief: facts.join(" ") };
        });
        reply = `${meetingBriefs.map(item => item.brief).join("\n\n")} These prep notes use saved records in this browser only. They don't include external web research or live Apollo-generated insights.`;
        nextStepsTitle = meetingsToPrepare.length === 1 ? "Open meeting" : "Meetings to prepare for";
        nextSteps = meetingBriefs.map(({ meeting }) => ({ title: meeting.title, detail: `${meeting.person} · ${meeting.time}`, module: "Meetings", targetType: "meeting", targetTitle: meeting.title, targetPerson: meeting.person, priority: 0 }));
      }
    } else if (/meeting|calendar/.test(lower)) {
      const upcoming = data.meetings.filter(meeting => !meeting.past);
      reply = /\b(booked from|attributed|outbound this month|conversion|source)\b/.test(lower)
        ? "The local meeting records do not include source attribution or a complete date range, so I can’t reliably calculate outbound-sourced meetings for a period."
        : upcoming.length ? `There are ${upcoming.length} upcoming meetings in the local workspace: ${upcoming.slice(0, 4).map(meeting => `${meeting.title} with ${meeting.person} · ${meeting.time}`).join("; ")}.` : "There are no upcoming meetings in the local workspace.";
    } else if (/\b(deliverability|spam|blocked|open rate|open rates|click rate|sentiment|team's average|team average|rep performance|by rep|by representative)\b/.test(lower) && !(/\bsentiment\b/.test(lower) && /\b(?:calls?|conversations?|recordings?|meetings?)\b/.test(lower))) {
      if (/\b(?:rep performance|by rep|by representative|by owner|performance by owner|team average|team's average)\b/.test(lower)) {
        const owners = [...new Set([
          ...data.deals.map(deal => deal.owner),
          ...data.tasks.map(task => task.assignedTo),
          ...data.sequences.map(sequence => sequence.owner),
        ].filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const pipelineByOwner = owners.map(owner => {
          const owned = data.deals.filter(deal => deal.owner === owner && !closedDealStages.has(deal.stage));
          const value = owned.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
          return { label: owner, value, display: `${fmtMoney(value)} · ${owned.length} open deal${owned.length === 1 ? "" : "s"}` };
        });
        const taskByOwner = owners.map(owner => {
          const assigned = data.tasks.filter(task => task.assignedTo === owner);
          const completed = assigned.filter(task => task.done && task.taskStatus !== "Skipped").length;
          return { label: owner, value: assigned.length ? completed / assigned.length * 100 : 0, display: assigned.length ? `${Math.round(completed / assigned.length * 100)}% · ${completed}/${assigned.length} completed` : "No assigned tasks recorded" };
        }).filter(item => item.display !== "No assigned tasks recorded");
        const assignedTaskCount = data.tasks.filter(task => task.assignedTo).length;
        const sequenceByOwner = owners.map(owner => {
          const owned = data.sequences.filter(sequence => sequence.owner === owner && sequenceHasSampleMetrics(sequence));
          const enrolled = owned.reduce((sum, sequence) => sum + Number(sequence.people || 0), 0);
          const replies = owned.reduce((sum, sequence) => sum + Number(sequence.replies || 0), 0);
          return { label: owner, value: enrolled ? replies / enrolled * 100 : 0, display: enrolled ? `${Math.round(replies / enrolled * 100)}% · ${replies}/${enrolled} sample replies` : "No sample results recorded" };
        }).filter(item => item.display !== "No sample results recorded");
        const topPipelineOwner = [...pipelineByOwner].sort((a, b) => b.value - a.value)[0];
        reportData = [
          ...(pipelineByOwner.length ? [{ title: "Open pipeline by owner", unit: "currency", items: pipelineByOwner }] : []),
          ...(taskByOwner.length ? [{ title: "Task completion by assignee", unit: "percent", items: taskByOwner }] : []),
          ...(sequenceByOwner.length ? [{ title: "Sample sequence replies by owner", unit: "percent", items: sequenceByOwner }] : []),
        ];
        reply = owners.length
          ? `Local owner snapshot: ${owners.length} owners appear in deal, task, or sequence records${topPipelineOwner ? `. ${topPipelineOwner.label} has the largest open pipeline at ${fmtMoney(topPipelineOwner.value)}` : ""}. I’ve separated open deal value, task completion where assignees are recorded, and illustrative sample sequence ratios. ${assignedTaskCount ? `${assignedTaskCount} tasks have an assignee.` : "No task assignees are recorded."} Sample sequence results are not live Apollo team analytics; mailbox placement, opens, clicks, and a reporting time range are unavailable.`
          : "This workspace has no deal, task, or sequence owner records to compare yet.";
      } else reply = "Those metrics aren’t present in this local workspace. I can summarize sample sequence enrollments and replies, but not mailbox placement, open/click rates, or spam blocks.";
    } else if (/email|inbox|reply/.test(lower)) {
      const inbox = data.emails.filter(email => (email.folder || "Inbox") === "Inbox");
      const unread = inbox.filter(email => email.unread);
      const drafts = data.emails.filter(email => email.folder === "Drafts");
      reply = `The local inbox has ${inbox.length} messages, ${unread.length} unread, and ${drafts.length} draft${drafts.length === 1 ? "" : "s"}. ${unread.slice(0, 3).map(email => `${email.from}: ${email.subject}`).join("; ") || "No unread messages."} Email is not connected for sending.`;
    } else if (/sequence|outreach/.test(lower)) {
      const activeSequences = data.sequences.filter(sequence => sequence.status === "Active");
      reply = `There are ${activeSequences.length} active local sequences. ${activeSequences.map(sequence => sequenceHasSampleMetrics(sequence) ? `${sequence.name} (${sequence.people || 0} sample enrollments, ${sequence.replies || 0} sample replies)` : `${sequence.name} (${(sequence.enrolledPeople || []).length} contacts in the local plan; no outreach sent)`).join("; ") || "No sequences are active."} Local sequence steps are plans; they do not send outreach.`;
      const items = activeSequences.filter(sequenceHasSampleMetrics).map(sequence => {
        const peopleCount = Number(sequence.people || 0);
        const repliesCount = Number(sequence.replies || 0);
        return { label: sequence.name, value: peopleCount ? repliesCount / peopleCount * 100 : 0, display: peopleCount ? `${Math.round(repliesCount / peopleCount * 100)}% · ${repliesCount}/${peopleCount} sample replies` : "No sample enrollments" };
      });
      if (items.length) reportData = [{ title: "Active sample sequence reply rate", unit: "percent", items }];
    } else if (/analytics|report|performance|metrics|dashboard/.test(lower)) {
      const openDeals = data.deals.filter(deal => !closedDealStages.has(deal.stage));
      const pipeline = openDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
      const sampleSequences = data.sequences.filter(sequenceHasSampleMetrics);
      const enrolled = sampleSequences.reduce((sum, sequence) => sum + Number(sequence.people || 0), 0);
      const replies = sampleSequences.reduce((sum, sequence) => sum + Number(sequence.replies || 0), 0);
      const replyRate = enrolled ? `${Math.round(replies / enrolled * 100)}%` : "not available (no enrollments)";
      const openTasks = data.tasks.filter(task => !task.done).length;
      reply = `From this browser workspace: ${workspacePeople.length} contact records, ${data.companies.length} companies, ${openDeals.length} open deals worth ${fmtMoney(pipeline)}, ${openTasks} open tasks, and ${data.meetings.filter(meeting => !meeting.past).length} upcoming meetings. ${sampleSequences.length ? `Illustrative sequence examples show ${replies} sample replies from ${enrolled} sample enrollments (${replyRate}); these are not campaign results.` : "No sequence performance data is available; local plans do not send outreach."} Other figures are current local totals, not live Apollo analytics or a time series.`;
      const pipelineItems = stages.filter(stage => !closedDealStages.has(stage)).map(stage => {
        const value = openDeals.filter(deal => deal.stage === stage).reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
        return { label: stage, value, display: fmtMoney(value) };
      });
      const sequenceItems = sampleSequences.filter(sequence => Number(sequence.people || 0) > 0).map(sequence => ({
        label: sequence.name,
        value: Number(sequence.replies || 0) / Number(sequence.people || 1) * 100,
        display: `${Math.round(Number(sequence.replies || 0) / Number(sequence.people || 1) * 100)}% · ${Number(sequence.replies || 0)}/${Number(sequence.people || 0)} sample replies`,
      }));
      reportData = [
        { title: "Open pipeline by stage", unit: "currency", items: pipelineItems },
        ...(sequenceItems.length ? [{ title: "Sample sequence reply rate", unit: "percent", items: sequenceItems }] : []),
      ];
    } else if (/\b(list|lists)\b/.test(lower)) {
      const memberCount = data.lists.reduce((sum, list) => sum + (list.members || []).length, 0);
      reply = data.lists.length ? `There are ${data.lists.length} local lists with ${memberCount} saved memberships: ${data.lists.slice(0, 6).map(list => `${list.name} (${(list.members || []).length || Number(list.count || 0)} contacts)`).join("; ")}. List records are stored in this browser.` : "There are no lists in this browser workspace yet. Open Lists to create one.";
    } else if (/\bworkflow|automation\b/.test(lower)) {
      const activeWorkflows = data.workflows.filter(workflow => workflow.status === "Active");
      const runs = data.workflows.reduce((sum, workflow) => sum + Number(workflow.runs || 0), 0);
      reply = `There are ${activeWorkflows.length} active local workflows and ${runs} recorded runs. ${activeWorkflows.map(workflow => `${workflow.name} (${workflow.trigger} → ${workflowSteps(workflow).map(step => step.action).join(" → ")})`).join("; ") || "No workflows are active."} These automations update browser-local tasks, lists, or sequence enrollment; they do not send outreach or sync external systems.`;
    } else if (/\bcall|calls|dialer\b/.test(lower)) {
      const connected = data.calls.filter(call => call.outcome === "Connected").length;
      const unanswered = data.calls.filter(call => call.outcome !== "Connected").length;
      reply = `There are ${data.calls.length} call logs in this browser workspace: ${connected} connected and ${unanswered} with another outcome. ${data.calls.slice(0, 4).map(call => `${call.person} · ${call.outcome}${call.note ? ` · ${call.note}` : ""}`).join("; ") || "No calls have been logged."} This does not place calls.`;
    } else if (/\b(context|icp|positioning|value proposition|what do we sell|what does our company)\b/.test(lower)) {
      const summary = [["Company and product", assistantContext.companyProduct], ["Ideal customer profile", assistantContext.idealCustomerProfile], ["Value proposition", assistantContext.valueProposition], ["Writing style", assistantContext.writingStyle], ["Claims to avoid", assistantContext.claimsToAvoid]].filter(([, value]) => value?.trim()).map(([label, value]) => `${label}: ${value.trim()}`);
      reply = summary.length ? `Your saved AI context: ${summary.join(" · ")}. This context is stored only in this browser.` : "No AI context is saved yet. Open Admin settings → AI Context to add your product, ideal customer, value proposition, writing style, and claims to avoid.";
    } else if (/company|account/.test(lower)) {
      const matches = data.companies.filter(company => !matchedContact || company.name === matchedContact.company).slice(0, 5);
      reply = `There are ${data.companies.length} company records in this browser. ${matches.map(company => `${company.name} · ${company.industry} · ${company.employees} employees`).join("; ") || "No company records yet."}`;
    }
    if (reviewAction && ["create-email-draft", "create-email-drafts", "create-sequence", "update-sequence-step"].includes(reviewAction.operation)) {
      const draftContent = reviewAction.operation === "create-email-draft"
        ? `${reviewAction.email?.subject || ""}\n${reviewAction.email?.body || ""}`
        : reviewAction.operation === "create-email-drafts"
          ? (reviewAction.emails || []).map(email => `${email.subject || ""}\n${email.body || ""}`).join("\n")
          : (reviewAction.operation === "update-sequence-step"
            ? [reviewAction.stepPlan?.[reviewAction.stepIndex] || {}]
            : reviewAction.stepPlan || reviewAction.sequence?.stepPlan || [])
            .map(step => [step.subject, step.body, step.instruction, step.callScript, step.linkedinMessage].filter(Boolean).join("\n")).join("\n");
      const claimConflicts = findClaimConflicts(draftContent, assistantContext.claimsToAvoid);
      if (claimConflicts.length) {
        reply = `I held this draft because it contains wording covered by your saved Claims to avoid: ${claimConflicts.join(", ")}. Update the product context or claims guidance in Admin settings → AI Context, then try again. This local check catches exact phrases and common numeric or guarantee wording; it cannot assess broader meaning.`;
        reviewAction = null;
      }
    }
    setAssistantMessages(current => [...current, { role: "user", text: prompt }, { role: "assistant", text: reply, ...(reportData ? { reportData } : {}), ...(nextSteps ? { nextSteps } : {}), ...(nextStepsTitle ? { nextStepsTitle } : {}), ...(creditAction ? { creditAction } : {}), ...(reviewAction ? { id: `review-message-${reviewAction.id}`, reviewAction } : {}) }]); setAssistantInput("");
  };
  const openSuggestedFollowUp = step => {
    if (step.targetType === "ai-context") { setSettingsTab("AI Context"); onNavigate("Settings"); return; }
    if (step.targetType === "module") { onNavigate(step.module); return; }
    const record = step.targetType === "task"
      ? data.tasks.find(task => task.title === step.targetTitle && task.person === step.targetPerson)
      : step.targetType === "email"
        ? data.emails.find(email => email.subject === step.targetSubject && email.from === step.targetFrom)
        : step.targetType === "meeting"
          ? data.meetings.find(meeting => meeting.title === step.targetTitle && meeting.person === step.targetPerson)
          : step.targetType === "call"
            ? data.calls.find(call => call.person === step.targetPerson && call.time === step.targetTime)
            : step.targetType === "recording"
              ? data.recordings.find(item => item.title === step.targetTitle && item.person === step.targetPerson)
              : step.targetType === "company"
                ? data.companies.find(company => company.name === step.targetTitle)
                : null;
    if (!record) { notify("That follow-up record is no longer available in this workspace."); return; }
    if (module === step.module) setSelected(record);
    else { pendingFollowUpRef.current = record; onNavigate(step.module); }
  };
  const approveAssistantCreditAction = action => {
    if (!apolloConfigured) {
      setAssistantMessages(current => [...current, { role: "assistant", text: "Apollo enrichment is not connected, so no credits were spent. Configure the server-side API key and retry." }]);
      return;
    }
    const started = onEnrichPerson?.(action.person, { autoApprove: true });
    if (!started) {
      setAssistantMessages(current => [...current, { role: "assistant", text: "Apollo enrichment could not start. No credits were spent." }]);
      return;
    }
    setAssistantConversation(current => ({ ...current, chats: current.chats.map(chat => chat.id !== current.activeId ? chat : {
      ...chat,
      creditUsed: Number(chat.creditUsed || 0) + Number(action.estimatedMaxCredits || 9),
      messages: chat.messages.map(message => message.creditAction?.id === action.id ? { ...message, creditAction: { ...message.creditAction, status: "approved" } } : message),
      updatedAt: new Date().toISOString(),
    }) }));
    setAssistantMessages(current => [...current, { role: "assistant", text: `Approved. Started email enrichment for ${action.person.name}; up to ${action.estimatedMaxCredits || 9} credits are counted against this chat's allowance. The actual charge may be lower.` }]);
  };
  const filtered = (items, fields) => {
    const needle = query.trim().toLowerCase();
    const phoneNeedle = needle.replace(/\D/g, "");
    let results = (items || []).filter(item => fields.some(field => {
      const value = String(item[field] || "");
      return value.toLowerCase().includes(needle) || (field === "phone" && phoneNeedle.length >= 5 && value.replace(/\D/g, "").includes(phoneNeedle));
    }));
    if (filterValue === "Active") results = results.filter(item => {
      if (typeof item.done === "boolean") return !item.done;
      if (item.stage) return !closedDealStages.has(item.stage);
      if (module === "Companies") return item.status !== "New";
      if (item.status) return item.status === "Active";
      if (item.folder) return item.folder === "Inbox";
      return true;
    });
    if (filterValue === "Needs attention") results = results.filter(item => ["Unverified", "Unavailable", "New", "Paused", "No answer"].includes(item.status) || (item.due === "Today" && !item.done) || item.unread || item.sentiment === "Negative");
    if (filterValue === "Completed") results = results.filter(item => item.done || closedDealStages.has(item.stage));
    if (sortOrder !== "Recently updated") {
      const nameOf = item => String(item.name || item.title || item.person || item.from || item.company || "").toLowerCase();
      results = [...results].sort((left, right) => {
        if (sortOrder === "Name A–Z") return nameOf(left).localeCompare(nameOf(right));
        if (sortOrder === "Name Z–A") return nameOf(right).localeCompare(nameOf(left));
        if (sortOrder === "Highest value") return Number(right.amount || right.count || 0) - Number(left.amount || left.count || 0);
        return 0;
      });
    }
    return results;
  };
  const setTaskCompletion = (task, done) => {
    setData(current => {
      const currentTask = current.tasks.find(item => item.title === task.title && item.person === task.person);
      if (!currentTask || currentTask.done === done) return current;
      const next = { ...current, tasks: current.tasks.map(item => item.title === task.title && item.person === task.person ? { ...item, done } : item) };
      return done ? applyWorkflowEvent(next, "Task completed", [{ contact: task.person, task: task.title }]) : next;
    });
  };
  const removeListMember = (list, member) => {
    const currentList = data.lists.find(item => item.name === list.name && item.type === list.type);
    if (!currentList) return;
    const members = uniqueListMembers(currentList).filter(name => name.toLowerCase() !== member.toLowerCase());
    if (members.length === uniqueListMembers(currentList).length) return;
    const updatedList = { ...currentList, members, count: members.length, updated: "Just now" };
    setData(current => ({ ...current, lists: current.lists.map(item => item.name === list.name && item.type === list.type ? { ...item, members: uniqueListMembers(item).filter(name => name.toLowerCase() !== member.toLowerCase()), count: uniqueListMembers(item).filter(name => name.toLowerCase() !== member.toLowerCase()).length, updated: "Just now" } : item) }));
    setSelected(current => current?.name === list.name ? updatedList : current);
    notify(`${member} removed from ${list.name}`);
  };
  const setDealStage = (dealName, stage) => {
    setData(current => {
      const deal = current.deals.find(item => item.name === dealName);
      if (!deal || deal.stage === stage) return current;
      const next = { ...current, deals: current.deals.map(item => item.name === dealName ? { ...item, stage } : item) };
      return applyWorkflowEvent(next, "Deal stage changed", [{ contact: deal.company, company: deal.company, deal: deal.name, stage }]);
    });
  };
  const workspacePeople = [...new Map([...people, ...data.savedPeople].map(person => [person.name.toLowerCase(), person])).values()];
  const editingEmailDraft = data.emails.find(email => email.id === emailDraftEditing);
  const composeEmailRecipientIssue = editingEmailDraft?.recipientNeedsReview
    && String(formName).trim().toLowerCase() === String(editingEmailDraft.to || "").trim().toLowerCase()
    ? editingEmailDraft.recipientReviewReason || "review"
    : emailAddressReviewReason(formName);
  const assistantContextRecord = data.assistantContext || seed.assistantContext;
  const assistantProducts = getAssistantProducts(assistantContextRecord);
  const activeAssistantContextId = assistantContextRecord.activeProductId || assistantProducts[0].id;
  const assistantContext = assistantProducts.find(product => product.id === activeAssistantContextId) || assistantProducts[0];
  const assistantContextReady = Boolean(assistantContext.companyProduct?.trim());
  const selectAssistantContext = id => setData(current => {
    const stored = current.assistantContext || seed.assistantContext;
    const products = getAssistantProducts(stored);
    return { ...current, assistantContext: storeAssistantProducts(stored, products, id) };
  });
  const updateAssistantContextField = (key, value) => setData(current => {
    const stored = current.assistantContext || seed.assistantContext;
    const products = getAssistantProducts(stored).map(product => product.id === activeAssistantContextId ? { ...product, [key]: value } : product);
    return { ...current, assistantContext: storeAssistantProducts(stored, products, activeAssistantContextId) };
  });
  const updateAssistantMemoryField = (key, value) => setData(current => ({
    ...current,
    assistantMemory: { ...seed.assistantMemory, ...(current.assistantMemory || {}), [key]: value },
  }));
  const connectApolloKey = async event => {
    event.preventDefault();
    if (!apolloKeyDraft.trim() || apolloConnectionBusy) return;
    setApolloConnectionBusy(true);
    setApolloConnectionError("");
    try {
      const response = await fetch("/api/apollo/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: apolloKeyDraft.trim() }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.configured) throw new Error(result.message || "Apollo could not validate this API key.");
      setApolloKeyDraft("");
      onApolloConnectionChange?.(result);
      notify("Apollo connected · key held in local server memory");
    } catch (error) {
      setApolloConnectionError(error.message || "Could not connect to Apollo.");
    } finally {
      setApolloConnectionBusy(false);
    }
  };
  const disconnectApolloKey = async () => {
    if (apolloConnectionBusy) return;
    setApolloConnectionBusy(true);
    setApolloConnectionError("");
    try {
      const response = await fetch("/api/apollo/disconnect", { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Could not disconnect Apollo.");
      onApolloConnectionChange?.(result);
      notify(result.configured ? "Session key removed · environment key remains active" : "Apollo disconnected · demo mode restored");
    } catch (error) {
      setApolloConnectionError(error.message || "Could not disconnect Apollo.");
    } finally {
      setApolloConnectionBusy(false);
    }
  };
  const addAssistantProduct = () => setData(current => {
    const stored = current.assistantContext || seed.assistantContext;
    const products = getAssistantProducts(stored);
    const id = `product-${Date.now()}`;
    const product = { id, name: "New product/service", companyProduct: "", idealCustomerProfile: "", valueProposition: "", writingStyle: assistantContext.writingStyle || "", claimsToAvoid: assistantContext.claimsToAvoid || "" };
    return { ...current, assistantContext: storeAssistantProducts(stored, [...products, product], id) };
  });
  const removeAssistantProduct = () => setData(current => {
    const stored = current.assistantContext || seed.assistantContext;
    const products = getAssistantProducts(stored);
    if (products.length <= 1) return current;
    const remaining = products.filter(product => product.id !== activeAssistantContextId);
    return { ...current, assistantContext: storeAssistantProducts(stored, remaining, remaining[0].id) };
  });
  const updateAssistantAgent = (type, key, value) => setData(current => ({
    ...current,
    assistantAgents: (current.assistantAgents || seed.assistantAgents).map(agent => {
      if (agent.type !== type) return agent;
      const updated = { ...agent, [key]: value };
      if (key === "enabled") updated.nextRunAt = value ? nextAgentRun(updated).toISOString() : null;
      if (["frequency", "dayOfWeek", "runTime"].includes(key) && updated.enabled) updated.nextRunAt = nextAgentRun(updated).toISOString();
      return updated;
    }),
  }));
  const runAssistantAgent = (type, scheduled = false, configureSchedule = false) => {
    const agent = (data.assistantAgents || seed.assistantAgents).find(item => item.type === type);
    if (!agent) return;
    if (apolloConfigured) {
      const runPrompts = {
        "lead-discovery": "Run lead discovery now. Find and score up to 10 new prospects against my ideal customer profile. Use Apollo data and available web research; show the evidence behind each match and ask me to review the results before saving or enrolling anyone.",
        "sequence-creation": "Create an outbound sequence draft for my target audience using my selected product context and saved preferences. Propose a useful multichannel cadence and personalized copy. Show me the complete draft for review; do not activate it, enroll contacts, or send outreach.",
        "sequence-optimization": "Review my active sequences using the performance signals available in Apollo, including opens, replies, bounces, and spam signals where available. Diagnose the clearest opportunity and propose one change at a time with current and proposed copy for review. Do not apply the change until I approve it.",
      };
      const scheduleFrequency = agent.frequency === "Weekly"
        ? `weekly on ${agent.dayOfWeek || "Monday"}`
        : agent.frequency === "Monthly" ? "monthly on the first day of the month" : "daily";
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "my local timezone";
      const schedulePrompt = `Configure the ${agent.name} agent in my Apollo account with a ${scheduleFrequency.toLowerCase()} schedule at ${agent.runTime || "09:00"} (${timezone}) and a credit approval limit of ${Number(agent.creditLimit) || 0} credits per run. Use my selected AI context. Show me the exact settings you plan to save and ask me before activating the agent. Do not run it now, create a sequence, or change any other settings. If Apollo Assistant cannot configure this agent or schedule, tell me what is required; do not claim that anything was saved unless Apollo confirms it.`;
      const product = assistantProducts.find(item => item.id === activeAssistantContextId) || assistantProducts[0];
      const memory = data.assistantMemory || seed.assistantMemory;
      const context = [
        product?.companyProduct && `Company/product: ${product.companyProduct}`,
        product?.idealCustomerProfile && `Ideal customer profile: ${product.idealCustomerProfile}`,
        product?.valueProposition && `Value proposition: ${product.valueProposition}`,
        product?.writingStyle && `Writing style: ${product.writingStyle}`,
        product?.claimsToAvoid && `Claims to avoid: ${product.claimsToAvoid}`,
        memory.targetAudience && `Saved target audience: ${memory.targetAudience}`,
        memory.territory && `Saved territory: ${memory.territory}`,
        memory.writingStyle && `Saved writing style: ${memory.writingStyle}`,
        memory.customInstructions && `Saved preferences: ${memory.customInstructions}`,
      ].filter(Boolean);
      const instruction = `${configureSchedule ? schedulePrompt : runPrompts[type]}${context.length ? `\n\nUse this saved context:\n${context.join("\n")}` : ""}`;
      const id = `chat-agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const chat = {
        id,
        title: `${agent.name} · ${new Date().toLocaleDateString()}`,
        updatedAt: new Date().toISOString(),
        agentType: type,
        creditLimit: activeAssistantChat?.creditLimit ?? null,
        creditLimitCustom: Boolean(activeAssistantChat?.creditLimitCustom),
        creditUsed: 0,
        messages: [
          { role: "user", text: configureSchedule ? `Configure the ${agent.name} schedule` : `Run ${agent.name} now` },
          { role: "assistant", id: `apollo-action-${id}`, text: configureSchedule ? "Review these schedule settings before asking Apollo Assistant to configure the agent." : "Review this agent request before sending it to Apollo Assistant.", apolloAction: { id: `apollo-task-${id}`, taskId: null, instruction, status: "pending", ...(configureSchedule ? {} : { agentType: type }), agentOperation: configureSchedule ? "configure-schedule" : "run-now" } },
        ],
      };
      setAssistantConversation(current => ({ activeId: id, chats: [chat, ...current.chats].slice(0, 20) }));
      setAssistantView("Chat");
      return;
    }
    const contacts = [...new Map([...people, ...data.savedPeople].map(person => [person.name.toLowerCase(), person])).values()];
    const memory = data.assistantMemory || seed.assistantMemory;
    let result = "";
    let reviewAction = null;
    let reportData = null;
    if (type === "lead-discovery") {
      const prospectingContext = [assistantContext.idealCustomerProfile || "", memory.targetAudience || ""].filter(Boolean).join(" ");
      const ranked = contacts.map(person => ({ person, ...scoreLocalProspectFit(person, prospectingContext, memory.territory, data.companies) }))
        .filter(item => item.score !== null)
        .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name))
        .slice(0, 5);
      if (ranked.length) reportData = [{ title: "Sample ICP fit · local heuristic", unit: "percent", items: ranked.map(({ person, score, coverage }) => ({ label: person.name, value: score, display: `${score}% fit · ${coverage.percent}% data coverage` })) }];
      result = ranked.length
        ? `Lead discovery scored ${contacts.length} local contacts against “${[assistantContext.idealCustomerProfile, memory.targetAudience, memory.territory].filter(Boolean).join(" · ") || "your saved ICP"}”. Strongest sample matches: ${ranked.map(({ person, score, reasons, coverage }) => `${person.name} · ${person.title || "Title unavailable"} at ${person.company || "Company unavailable"} (${score}% fit; ${coverage.percent}% data coverage, ${coverage.available}/${coverage.expected} criteria${reasons.length ? `; ${reasons.join(", ")}` : "; no matched available criteria"})`).join("; ")}. Absent fields are excluded from each score and reduce its coverage. This is a transparent local heuristic, not Apollo’s AI scoring or live research.`
        : "I couldn't score this sample against usable ICP criteria. Add a target role or industry to AI Context; add company-size or territory preferences if those matter. Apollo’s live prospect scoring and web research need an Apollo connection.";
      if (ranked.length) {
        const listName = `Lead discovery · ${localDateValue()}`;
        const existingList = data.lists.find(list => list.type === "People" && list.name.toLowerCase() === listName.toLowerCase());
        const additions = ranked.map(item => item.person).filter(person => !(existingList?.members || []).includes(person.name));
        if (additions.length) {
          reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "save-people-to-list", people: additions, targetName: listName, createList: !existingList, label: existingList ? "Save leads to list · local workspace" : "Create lead list · local workspace", summary: `${listName} · ${additions.length} contact${additions.length === 1 ? "" : "s"}`, preview: additions.map(person => person.name).join(", "), status: "pending" };
          result += ` Review saving these ${additions.length} matches to a local list.`;
        }
      }
    } else if (type === "sequence-creation") {
      const audience = memory.targetAudience || assistantContext.idealCustomerProfile || "your target audience";
      const productMessage = assistantContext.valueProposition?.trim() || assistantContext.companyProduct?.trim();
      const style = findWritingStyle(memory.writingStyle) || findWritingStyle(memory.customInstructions) || findWritingStyle(assistantContext.writingStyle) || "friendly";
      const sequenceName = `AI draft · ${audience.slice(0, 42)}`;
      const subject = `A note for {{company}}`;
      const body = [style === "formal" || style === "professional" ? "Dear {{first_name}}," : "Hi {{first_name}},", "", productMessage || `I’m reaching out with an idea that may be relevant to ${audience}.`, "", "Would a brief conversation be useful?", "", "Best,", "{{sender_name}}"].join("\n");
      const stepPlan = [
        { channel: "Email", delay: "Immediately", instruction: `Subject: ${subject}`, subject, body },
        { channel: "Call", delay: "Wait 2 days", instruction: "Manual call task to understand current priorities" },
        { channel: "Email", delay: "Wait 3 days", instruction: "Share a relevant proof point or resource" },
        { channel: "Task", delay: "Wait 5 days", instruction: "Review account activity before the next touch" },
        { channel: "Email", delay: "Wait 7 days", instruction: "Send a concise final check-in" },
      ];
      const sequence = { name: sequenceName, status: "Draft", people: 0, replies: 0, steps: stepPlan.length, owner: "Robert Berry", stepPlan, enrolledPeople: [], draft: true, source: "local" };
      const claimConflicts = findClaimConflicts(stepPlan.map(step => [step.subject, step.body, step.instruction].filter(Boolean).join("\n")).join("\n"), assistantContext.claimsToAvoid);
      if (claimConflicts.length) result = `I did not prepare the five-step sequence for ${audience} because its copy contains wording covered by your Claims to avoid: ${claimConflicts.join(", ")}. Update AI Context and run the agent again. No contacts were enrolled and no outreach was sent.`;
      else result = `Sequence creation prepared a five-step campaign for ${audience}${assistantContext.companyProduct ? ` using ${assistantContext.companyProduct.trim().replace(/[.?!]+$/, "")}` : ""}. The first step is a ${style} email, followed by a call task, a proof-point email, a review task, and a final check-in. This uses saved context and does not enroll contacts or send anything.`;
      if (!claimConflicts.length && data.sequences.some(item => item.name.toLowerCase() === sequenceName.toLowerCase())) result += ` A draft named “${sequenceName}” already exists, so I left it unchanged.`;
      else if (!claimConflicts.length) {
        const preview = stepPlan.map((step, index) => [`${index + 1}. ${step.channel} · ${step.delay}`, step.subject ? `Subject: ${step.subject}` : step.instruction, step.body || ""].filter(Boolean).join("\n")).join("\n\n");
        reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "create-sequence", sequence, targetLabel: audience, preview, label: "Create sequence draft · local workspace", summary: `${sequenceName} · ${stepPlan.length} steps`, status: "pending" };
        result += " Review the sequence draft before saving it.";
      }
    } else {
      const ranked = data.sequences.filter(sequence => sequence.status === "Active" && sequenceHasSampleMetrics(sequence) && Number(sequence.people || 0) > 0)
        .map(sequence => ({ sequence, rate: Number(sequence.replies || 0) / Number(sequence.people || 0) }))
        .sort((a, b) => a.rate - b.rate);
      const weakest = ranked[0];
      result = weakest
        ? `Sequence optimization reviewed ${ranked.length} active local sequence${ranked.length === 1 ? "" : "s"}. For “${weakest.sequence.name}”, the sample reply-to-enrollment ratio is ${Math.round(weakest.rate * 100)}% (${weakest.sequence.replies}/${weakest.sequence.people}). Recommendation: review the opening email for audience-specific relevance, then change only that first touch and compare results after more replies. Opens, clicks, bounces, and spam signals are not present in this demo.`
        : "Sequence optimization needs an active sequence with enrollment and reply totals. The current local workspace does not contain enough data to recommend a change.";
      if (weakest) {
        const sequence = weakest.sequence;
        const previousStepPlan = sequence.stepPlan || [];
        const emailIndex = previousStepPlan.findIndex(step => step.channel === "Email");
        const productMessage = assistantContext.valueProposition?.trim() || assistantContext.companyProduct?.trim();
        if (emailIndex >= 0 && productMessage) {
          const writingStyle = findWritingStyle(memory.writingStyle) || findWritingStyle(memory.customInstructions) || findWritingStyle(assistantContext.writingStyle) || "friendly";
          const subject = "A practical idea for {{company}}";
          const body = [writingStyle === "formal" || writingStyle === "professional" ? "Dear {{first_name}}," : "Hi {{first_name}},", "", productMessage, "", "If this is relevant, would a brief conversation be useful?", "", "Best,", "{{sender_name}}"].join("\n");
          const claimConflicts = findClaimConflicts(`${subject}\n${body}`, assistantContext.claimsToAvoid);
          if (claimConflicts.length) result += ` I did not draft a replacement because it contains wording covered by your Claims to avoid: ${claimConflicts.join(", ")}. Update AI Context and run the agent again.`;
          else {
            const stepPlan = previousStepPlan.map((step, index) => index === emailIndex ? { ...step, subject, body, instruction: `Subject: ${subject}` } : step);
            reviewAction = { id: `review-${Date.now()}`, type: "local-write", operation: "update-sequence-step", sequenceName: sequence.name, previousStepPlan, stepPlan, preview: `Subject: ${subject}\n\n${body}`, label: "Improve first email · local sequence", summary: `${sequence.name} · first email`, status: "pending" };
            result += " I drafted a context-based replacement for the first email. Review it before applying; other sequence steps remain unchanged.";
          }
        } else result += " Add product messaging in AI Context before asking me to draft a replacement email.";
      }
    }
    const id = `chat-agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const chat = { id, title: `${agent.name} · ${new Date().toLocaleDateString()}`, updatedAt: new Date().toISOString(), agentType: type, messages: [{ role: "assistant", text: result, ...(reportData ? { reportData } : {}), ...(reviewAction ? { id: `review-message-${reviewAction.id}`, reviewAction } : {}) }] };
    setAssistantConversation(current => ({ activeId: id, chats: [chat, ...current.chats].slice(0, 20) }));
    setData(current => ({ ...current, assistantAgents: (current.assistantAgents || seed.assistantAgents).map(item => item.type === type ? { ...item, lastRunAt: new Date().toISOString(), nextRunAt: item.enabled ? nextAgentRun(item).toISOString() : null, lastResult: result, lastRunType: scheduled ? "Scheduled" : "Manual" } : item) }));
    setAssistantView("Chat");
  };
  const openAssistantAgentResult = agent => {
    const chat = [...assistantConversation.chats]
      .filter(item => item.agentType === agent.type)
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))[0];
    if (!chat) return;
    setAssistantConversation(current => ({ ...current, activeId: chat.id }));
    setAssistantView("Chat");
  };
  useEffect(() => {
    if (apolloConfigured) return undefined;
    const runDueAgent = () => {
      const now = Date.now();
      const due = (data.assistantAgents || []).find(agent => agent.enabled && agent.nextRunAt && Date.parse(agent.nextRunAt) <= now);
      if (due) runAssistantAgent(due.type, true);
    };
    runDueAgent();
    const timer = window.setInterval(runDueAgent, 15000);
    return () => window.clearInterval(timer);
  }, [assistantContext, apolloConfigured, data.assistantAgents, data.savedPeople, data.sequences]);
  const hasEmailAddress = value => /^[^\s@]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(String(value || "").trim());
  const hasUsableEmail = person => hasEmailAddress(person.email) && !isPlaceholderEmail(person.email);
  const personFindings = workspacePeople.map(person => {
    const missing = [];
    if (isPlaceholderEmail(person.email)) missing.push("Sample email");
    else if (!hasEmailAddress(person.email)) missing.push("Email");
    if (!contactPhoneHref(person.phone)) missing.push("Phone");
    if (!normalizeLinkedInUrl(person.linkedinUrl)) missing.push("LinkedIn");
    if (!person.company || person.company === "Company unavailable") missing.push("Company");
    if (!person.location || person.location === "Location unavailable") missing.push("Location");
    if (hasEmailAddress(person.email) && !isPlaceholderEmail(person.email) && !["Verified", "Email available"].includes(person.status)) missing.push("Verify email");
    return { name: person.name, company: person.company || "Company unavailable", missing };
  }).filter(person => person.missing.length);
  const usableEmailCount = workspacePeople.filter(hasUsableEmail).length;
  const sampleEmailCount = workspacePeople.filter(person => isPlaceholderEmail(person.email)).length;
  const emailCoverage = workspacePeople.length ? Math.round(usableEmailCount / workspacePeople.length * 100) : 0;
  const dataCheckSignature = JSON.stringify(workspacePeople.map(({ id, name, email, phone, linkedinUrl, company, location, status }) => ({ id, name, email, phone, linkedinUrl, company, location, status })));
  const makeColumns = (headers, rows, key) => {
    const rowId = row => workspaceSelectionKey(row, module);
    const isCompanyTable = module === "Companies";
    const isSequenceTable = module === "Sequences";
    const isContactTable = module === "People" || module === "Data enrichment";
    const isCallTable = module === "Calls";
    const isMeetingTable = module === "Meetings";
    const isWorkflowTable = module === "Workflows";
    const visibleIds = rows.map(rowId);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedRows.includes(id));
    return <div className={`wm-table-scroll${isCompanyTable ? " wm-company-table-wrap" : isSequenceTable ? " wm-sequence-table-wrap" : isContactTable ? " wm-contact-table-wrap" : isCallTable ? " wm-call-table-wrap" : isMeetingTable ? " wm-meeting-table-wrap" : isWorkflowTable ? " wm-workflow-table-wrap" : ""}`}><table className={`wm-table${isCompanyTable ? " wm-company-table" : isSequenceTable ? " wm-sequence-table" : isContactTable ? " wm-contact-table" : isCallTable ? " wm-call-table" : isMeetingTable ? " wm-meeting-table" : isWorkflowTable ? " wm-workflow-table" : ""}`}><thead><tr><th className="wm-check-col"><input type="checkbox" aria-label="Select all visible rows" checked={allSelected} ref={element => { if (element) element.indeterminate = !allSelected && visibleIds.some(id => selectedRows.includes(id)); }} onChange={event => setSelectedRows(current => event.target.checked ? [...new Set([...current, ...visibleIds])] : current.filter(id => !visibleIds.includes(id)))} onClick={event => event.stopPropagation()} /></th>{headers.map((header, index) => <th scope="col" key={`${header}-${index}`}>{header}</th>)}<th></th></tr></thead><tbody>{rows.map((row, index) => { const id = rowId(row); const label = [row[key] || row.name || row.title || row.person || "record", ...(["Calls", "Meetings"].includes(module) ? [row.time] : [])].filter(Boolean).join(" · "); return <tr key={row.id || id || index} tabIndex={0} className={selectedRows.includes(id) ? "is-selected" : ""} aria-label={`Open ${label} details`} onKeyDown={event => { if (event.target === event.currentTarget && ["Enter", " "].includes(event.key)) { event.preventDefault(); setSelected(row); } }} onClick={() => setSelected(row)}><td><input type="checkbox" aria-label={`Select ${label}`} checked={selectedRows.includes(id)} onChange={event => setSelectedRows(current => event.target.checked ? [...current, id] : current.filter(selectedId => selectedId !== id))} onClick={event => event.stopPropagation()} /></td>{row._cells.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}<td><button className="wm-more" onClick={event => { event.stopPropagation(); setSelected(row); }} aria-label={`More actions for ${row[key] || "record"}`}><MoreHorizontal size={17} /></button></td></tr>;})}</tbody></table>{rows.length === 0 ? renderEmptyState() : <div className="wm-table-footer"><span role="status">{rows.length} record{rows.length === 1 ? "" : "s"}{selectedRows.length ? ` · ${selectedRows.filter(id => visibleIds.includes(id)).length} selected` : ""}</span>{selectedRows.length > 0 && <button type="button" className="wm-text-action" onClick={() => setSelectedRows([])}>Clear selection</button>}<small>Press Enter on a row to open details</small></div>}</div>;
  };

  const renderHome = () => {
    const completed = onboardingStatus(data);
    const completionCount = completed.filter(Boolean).length;
    const checklist = [
      { title: "Find people and companies that match your ideal customer profile", description: "Save a contact to start building your pipeline", action: "Save a prospect", module: "People", primary: true },
      { title: "Save a mobile number to reach people by phone", description: "Use Luna to request a prospect number lookup", action: "Find numbers", module: "Assistant", prompt: "Find a work or mobile phone number for one of my saved prospects. Ask me to choose the contact if needed, do not invent results, and ask me before any credit-consuming lookup." },
      { title: "Create a list to keep your prospects organized", description: "Group the people you want to reach", action: "Create a list", module: "Lists", onAction: () => { preserveDialogOnModuleChange.current = true; startCreateList("People"); onNavigate("Lists"); } },
      { title: "Save target companies to find the right people inside them", description: "Build an account list around your ideal customers", action: "Save a company", module: "Companies" },
      { title: "Create an outreach sequence for your prospects", description: "Ask Luna to draft a reviewed, multichannel sequence", action: "Create a sequence", module: "Assistant", prompt: "Draft a 5-step multichannel sequence for SaaS sales leaders. Use my saved product context, leave clear placeholders for unknown details, and do not enroll anyone or send outreach." },
      { title: "Improve an active sequence", description: "Review performance and ask Luna for one focused improvement", action: "Review sequences", module: "Assistant", prompt: "Improve one active sequence using its saved results. Suggest one grounded edit to its first outreach message and ask me before applying it." },
    ];
    return <div className="wm-onboarding-home">
      <header className="wm-onboarding-heading"><h1>Get started with Apollo</h1><p>{apolloConfigured ? "Build your prospect pipeline and prepare outreach. Available features and credit use depend on your Apollo account." : "Find sample prospects and prepare outreach with Luna. Connect Apollo to search live data."}</p><div className="wm-onboarding-progress" role="progressbar" aria-label="Onboarding progress" aria-valuemin={0} aria-valuemax={6} aria-valuenow={completionCount}><span style={{ width: `${completionCount / 6 * 100}%` }}/></div></header>
      <section className="wm-onboarding-card"><header><h2>Start reaching the right prospects</h2><button type="button" aria-expanded={onboardingExpanded} aria-label={`Onboarding checklist ${onboardingExpanded ? "expanded" : "collapsed"}`} className="wm-onboarding-count" onClick={() => setOnboardingExpanded(value => !value)}>{completionCount} of 6 completed {onboardingExpanded ? <ChevronDown size={14}/> : <ChevronDown size={14} className="wm-onboarding-chevron-collapsed"/>}</button></header>{onboardingExpanded && <><div className="wm-onboarding-steps">{checklist.map((item,index)=><article className="wm-onboarding-step" key={item.action}><span className={`wm-onboarding-check ${completed[index] ? "complete" : ""}`} aria-label={completed[index] ? "Complete" : "Not complete"}>{completed[index] && <Check size={13}/>}</span><div><p>{item.title}</p><small>{item.description}</small></div><button type="button" className={item.primary?"wm-onboarding-primary":"wm-outline"} onClick={()=>item.onAction ? item.onAction() : item.prompt ? openAssistantWithPrompt(item.prompt) : onNavigate(item.module)}>{item.action}</button></article>)}</div><small className="wm-onboarding-demo-note">{apolloConfigured ? "Apollo-connected workspace · Review each action before running it." : "Demo workspace · Luna actions use sample records and stay local unless you run an approved Apollo Assistant task."}</small></>}</section>
      <div className="wm-home-grid wm-today-grid"><section className="wm-panel"><div className="wm-section-heading"><h2>Next follow-ups</h2><button className="wm-text-action" onClick={() => onNavigate("Tasks")}>View all tasks</button></div>{data.tasks.filter(task => !task.done).slice(0, 3).map(task => <button className="wm-focus-row" key={task.title} onClick={() => openRelatedRecord(task, "Tasks")}><Clock3 size={17}/><span><strong>{task.title}</strong><small>{task.person} · {task.due}</small></span><ChevronRight size={14}/></button>)}{!data.tasks.some(task => !task.done) && <p>No open follow-ups. You’re up to date.</p>}</section><section className="wm-panel"><div className="wm-section-heading"><h2>Upcoming meetings</h2><button className="wm-text-action" onClick={() => onNavigate("Meetings")}>View all meetings</button></div>{data.meetings.filter(meeting => !meeting.past).slice(0, 3).map(meeting => <button className="wm-focus-row" key={meeting.title} onClick={() => openRelatedRecord(meeting, "Meetings")}><CalendarDays size={17}/><span><strong>{meeting.title}</strong><small>{meeting.person} · {meeting.time}</small></span><ChevronRight size={14}/></button>)}{!data.meetings.some(meeting => !meeting.past) && <p>No upcoming meetings scheduled.</p>}</section></div>
    </div>;
  };

  const searchApolloCompanies = async (event, page = 1, lookalikeIds = apolloCompanyLookalikeIds) => {
    event?.preventDefault?.();
    if (!apolloConfigured || apolloCompanyLoading) return;
    const criteria = {
      companyName: apolloCompanyName.trim(),
      keywords: apolloCompanyKeywords.trim(),
      locations: apolloCompanyLocation.trim(),
      industries: apolloCompanyIndustry.trim(),
      companySizeRanges: apolloCompanySize.trim(),
      ...apolloCompanyAdvanced,
      lookalikeOrganizationIds: lookalikeIds,
    };
    if (!Object.values(criteria).some(value => Array.isArray(value) ? value.length > 0 : Boolean(value))) {
      setApolloCompanyError("Add a company name, keyword, industry, location, or employee range before searching.");
      return;
    }
    setApolloCompanyLoading(true);
    setApolloCompanyError("");
    if (page === 1) { setApolloCompanyResults(null); setApolloCompanyTotal(0); setApolloCompanyHasMore(false); setApolloCompanyLookalikeIds(lookalikeIds); setSelectedRows([]); }
    try {
      const response = await fetch("/api/apollo/companies/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria, page, perPage: 25 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Apollo company search failed.");
      const organizations = (payload.organizations || []).map(org => {
        const city = org.city || org.organization_city || "";
        const state = org.state || org.organization_state || "";
        const country = org.country || org.organization_country || "";
        const location = [city, state, country].filter(Boolean).join(", ") || org.raw_address || org.organization_location || "Location unavailable";
        return {
          id: org.organization_id || org.id,
          apolloOrganizationId: org.organization_id || org.id,
          source: "apollo",
          name: org.name || org.organization_name || "Company name unavailable",
          domain: org.primary_domain || org.website_url || org.domain || "",
          industry: org.industry || org.organization_industry || (Array.isArray(org.industries) ? org.industries.map(item => typeof item === "string" ? item : item?.name).filter(Boolean).join(", ") : "Industry unavailable") || "Industry unavailable",
          employees: org.estimated_num_employees ?? org.num_employees ?? "—",
          location,
          status: "Apollo prospect",
          people: 0,
          website: org.website_url || "",
          linkedinUrl: org.linkedin_url || "",
          shortDescription: org.short_description || org.description || "",
        };
      });
      setApolloCompanyResults(organizations);
      setApolloCompanyPage(Number(payload.page) || page);
      setApolloCompanyTotal(Number(payload.total) || organizations.length);
      setApolloCompanyHasMore(Boolean(payload.hasMore));
      setTab("All companies");
    } catch (error) {
      setApolloCompanyError(error instanceof Error ? error.message : "Apollo company search failed.");
      if (page === 1) setApolloCompanyResults([]);
    } finally {
      setApolloCompanyLoading(false);
    }
  };

  const askLunaToFindCompanies = () => {
    const advancedLabels = {
      excludedKeywords: "Exclude keywords", companyDomains: "Include domains", excludedDomains: "Exclude domains",
      technologies: "Technologies", revenueMinimum: "Revenue minimum", revenueMaximum: "Revenue maximum",
      activeJobTitles: "Active job titles", activeJobLocations: "Active job locations", activeJobsMinimum: "Active jobs minimum",
      activeJobsMaximum: "Active jobs maximum", jobPostedAfter: "Jobs posted after", jobPostedBefore: "Jobs posted before",
      fundingMinimum: "Funding minimum", fundingMaximum: "Funding maximum", fundingDateAfter: "Funding date after",
      fundingDateBefore: "Funding date before", headcountGrowthMinimum: "Headcount growth minimum", headcountGrowthMaximum: "Headcount growth maximum",
    };
    const filters = [
      ["Company name", apolloCompanyName], ["Keywords", apolloCompanyKeywords], ["Headquarters", apolloCompanyLocation],
      ["Industry", apolloCompanyIndustry], ["Employee range", apolloCompanySize],
      ...Object.entries(apolloCompanyAdvanced).map(([key, value]) => [advancedLabels[key] || key, value]),
    ].filter(([, value]) => String(value ?? "").trim());
    const criteria = filters.map(([label, value]) => `${label}: ${String(value).trim()}`).join("; ");
    const prompt = criteria
      ? `Find and rank companies matching these filters: ${criteria}. In connected mode, use Apollo company data. In the local demo, rank only sample companies and label them clearly. Show fit and data coverage, then ask before saving companies or creating a list.`
      : `Find companies matching my saved ideal customer profile. Ask me for company filters if my ICP is not specific enough. In connected mode, use Apollo company data; in the local demo, rank only sample companies and label them clearly. Ask before saving companies or creating a list.`;
    openAssistantWithPrompt(prompt);
  };
  const runApolloCompanyEnrichment = async () => {
    if (!apolloCompanyEnrichmentReview?.length || apolloCompanyEnrichmentLoading) return;
    setApolloCompanyEnrichmentLoading(true);
    setApolloCompanyEnrichmentError("");
    try {
      const companiesToEnrich = apolloCompanyEnrichmentReview;
      const response = await fetch("/api/apollo/companies/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies: companiesToEnrich.map(company => {
          const rawDomain = company.domain || company.website || "";
          const domain = String(rawDomain).trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0];
          return { ...(domain ? { domain } : {}), ...(company.linkedinUrl ? { linkedin_url: company.linkedinUrl } : {}), ...(company.website ? { website: company.website } : {}), name: company.name };
        }) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Apollo company enrichment failed.");
      const returned = (payload.organizations || []).map(item => item.organization || item).filter(organization => organization && typeof organization === "object" && (organization.id || organization.name || organization.primary_domain || organization.industry || organization.estimated_num_employees));
      const enriched = returned.map((organization, index) => {
        const organizationName = String(organization.name || organization.organization_name || "").toLowerCase();
        const organizationDomain = String(organization.primary_domain || organization.domain || "").toLowerCase().replace(/^www\./, "");
        const original = companiesToEnrich.find(company => (organizationName && company.name.toLowerCase() === organizationName) || (organizationDomain && String(company.domain || "").toLowerCase().replace(/^www\./, "") === organizationDomain)) || companiesToEnrich[index];
        const technologies = (organization.technology_names || organization.current_technologies?.map(item => item.name) || []).filter(Boolean).join(", ");
        const revenue = organization.annual_revenue_printed || (Number(organization.annual_revenue) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(organization.annual_revenue) : "");
        const totalFunding = organization.total_funding_printed || (Number(organization.total_funding) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(organization.total_funding) : "");
        const latestFunding = (organization.funding_events || []).find(event => event?.date || event?.type || event?.amount);
        return {
          ...original,
          apolloOrganizationId: organization.id || original.apolloOrganizationId,
          name: organization.name || original.name,
          domain: organization.primary_domain || original.domain,
          industry: organization.industry || original.industry,
          employees: organization.estimated_num_employees ?? original.employees,
          location: organization.raw_address || [organization.city, organization.state, organization.country].filter(Boolean).join(", ") || original.location,
          website: organization.website_url || original.website,
          linkedinUrl: organization.linkedin_url || original.linkedinUrl,
          shortDescription: organization.short_description || organization.seo_description || original.shortDescription,
          annualRevenue: revenue || original.annualRevenue || "",
          totalFunding: totalFunding || original.totalFunding || "",
          latestFundingStage: organization.latest_funding_stage || latestFunding?.type || original.latestFundingStage || "",
          latestFundingDate: organization.latest_funding_round_date || latestFunding?.date || original.latestFundingDate || "",
          foundedYear: organization.founded_year || original.foundedYear || "",
          corporatePhone: organization.primary_phone?.number || organization.phone || original.corporatePhone || "",
          technologyNames: technologies || original.technologyNames || "",
          parentCompany: organization.ultimate_parent_organization?.name || organization.owned_by_organization?.name || original.parentCompany || "",
          subsidiaryCount: organization.num_suborganizations ?? original.subsidiaryCount ?? "",
          enrichedAt: new Date().toISOString(),
        };
      });
      setApolloCompanyResults(current => (current || []).map(company => enriched.find(item => item.apolloOrganizationId === company.apolloOrganizationId || item.name.toLowerCase() === company.name.toLowerCase() || (item.domain && item.domain.toLowerCase() === company.domain?.toLowerCase())) || company));
      setData(current => ({
        ...current,
        companies: current.companies.map(company => {
          const match = enriched.find(item => item.apolloOrganizationId === company.apolloOrganizationId || item.name.toLowerCase() === company.name.toLowerCase() || (item.domain && item.domain.toLowerCase() === company.domain?.toLowerCase()));
          return match ? { ...company, ...match, status: company.status } : company;
        }),
      }));
      const count = enriched.length;
      notify(`Apollo returned enrichment for ${count} ${count === 1 ? "company" : "companies"} · up to ${count} credits`);
      setApolloCompanyEnrichmentReview(null);
      setSelectedRows([]);
    } catch (error) {
      setApolloCompanyEnrichmentError(error instanceof Error ? error.message : "Apollo company enrichment failed.");
    } finally {
      setApolloCompanyEnrichmentLoading(false);
    }
  };
  const renderCompanies = () => {
    const source = (apolloCompanyResults ?? data.companies ?? companies).filter(company => tab === "Target accounts" ? company.status === "Target" : tab === "In progress" ? company.status === "Working" : true);
    const fromApollo = apolloCompanyResults !== null;
    const selectedApolloCompanies = fromApollo ? source.filter(company => selectedRows.includes(company.name) && company.apolloOrganizationId) : [];
    const rows = filtered(source, ["name", "domain", "industry", "location", "aiResearch", "shortDescription"]).map(company => {
      const saved = fromApollo && data.companies.some(item => item.name?.toLowerCase() === company.name.toLowerCase() || (company.domain && item.domain?.toLowerCase() === company.domain.toLowerCase()));
      const companyDetails = [company.domain || "Account record", companySourceLabel(company), company.enrichedAt ? "Apollo enrichment" : company.aiResearch ? "AI research saved" : ""].filter(Boolean).join(" · ");
      const row = { ...company, _cells: [<span className="wm-record-name"><i className="wm-company-avatar"><Building2 size={16}/></i><span><strong>{company.name}</strong><small>{companyDetails}</small></span></span>, company.industry, company.employees, company.location, <Pill tone="blue">{fromApollo ? company.enrichedAt ? "Apollo enriched" : "Apollo prospect" : company.status}</Pill>, <span className="wm-company-row-actions">{fromApollo && <button className="wm-text-action" aria-pressed={saved} onClick={event => { event.stopPropagation(); if (saved) { notify(`${company.name} is already saved in this browser`); return; } const record = { ...company, status: "Target" }; setData(current => ({ ...current, companies: [record, ...current.companies.filter(item => item.name !== company.name)] })); notify(`${company.name} saved to this browser workspace`); }}>{saved ? "Saved locally" : "Save locally"}</button>}<button className="wm-text-action" onClick={event => { event.stopPropagation(); onFindCompanyPeople?.(company); }}>Find people</button></span>] };
      return row;
    });
    return <><div className="wm-tabs">{["All companies", "Target accounts", "In progress"].map(item => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</div><SectionHeading title="Companies" detail="Explore and organize your target accounts" secondaryAction="Import CSV" onSecondaryAction={() => companyCsvInputRef.current?.click()} action="Add company" onAction={quickAdd} /><input ref={companyCsvInputRef} type="file" accept=".csv,text/csv" hidden aria-label="Import companies from CSV" onChange={importCompaniesCsv} />
      <div className="wm-discovery-actions"><button type="button" className="wm-outline" onClick={askLunaToFindCompanies}><Sparkles size={14}/>Find companies with Luna</button><small>Search saved accounts below, or use Apollo’s directory filters.</small></div>
      <details className="wm-company-directory" open={companySearchExpanded} onToggle={event => setCompanySearchExpanded(event.currentTarget.open)}><summary><Search size={14}/>Apollo directory filters<ChevronDown size={14}/></summary><form className="wm-company-search" onSubmit={event => searchApolloCompanies(event, 1, [])}>
        <div className="wm-company-search-heading"><div><strong>Find companies in Apollo</strong><small>Searches organizations not yet saved as Apollo accounts.</small></div><span>{apolloConfigured ? "1 credit per page" : "Apollo connection required"}</span></div>
        <div className="wm-company-search-fields"><label>Company name<input value={apolloCompanyName} onChange={event => setApolloCompanyName(event.target.value)} placeholder="e.g. Acme" /></label><label>Keywords<input value={apolloCompanyKeywords} onChange={event => setApolloCompanyKeywords(event.target.value)} placeholder="e.g. SaaS, cybersecurity" /></label><label>Headquarters<input value={apolloCompanyLocation} onChange={event => setApolloCompanyLocation(event.target.value)} placeholder="City, state, or country" /></label><label>Industry<input value={apolloCompanyIndustry} onChange={event => setApolloCompanyIndustry(event.target.value)} placeholder="Apollo industry name" /></label><label>Employee range<input value={apolloCompanySize} onChange={event => setApolloCompanySize(event.target.value)} placeholder="e.g. 51-200" /></label><button className="wm-primary" disabled={!apolloConfigured || apolloCompanyLoading}><Search size={14}/>{apolloCompanyLoading ? "Searching…" : "Search Apollo · 1 credit"}</button></div>
        <details className="wm-company-advanced"><summary>Advanced filters</summary><div className="wm-company-search-fields"><label>Exclude keywords<input value={apolloCompanyAdvanced.excludedKeywords || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, excludedKeywords: event.target.value }))} placeholder="e.g. staffing, recruiting" /></label><label>Include domains<input value={apolloCompanyAdvanced.companyDomains || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, companyDomains: event.target.value }))} placeholder="example.com" /></label><label>Exclude domains<input value={apolloCompanyAdvanced.excludedDomains || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, excludedDomains: event.target.value }))} placeholder="existing-customer.com" /></label><label>Technologies<input value={apolloCompanyAdvanced.technologies || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, technologies: event.target.value }))} placeholder="salesforce, hubspot" /></label><label>Revenue minimum<input type="number" min="0" step="1" value={apolloCompanyAdvanced.revenueMinimum || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, revenueMinimum: event.target.value }))} placeholder="USD" /></label><label>Revenue maximum<input type="number" min="0" step="1" value={apolloCompanyAdvanced.revenueMaximum || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, revenueMaximum: event.target.value }))} placeholder="USD" /></label><label>Active job titles<input value={apolloCompanyAdvanced.activeJobTitles || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, activeJobTitles: event.target.value }))} placeholder="sales manager, data analyst" /></label><label>Job locations<input value={apolloCompanyAdvanced.activeJobLocations || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, activeJobLocations: event.target.value }))} placeholder="Austin, Toronto" /></label><label>Active jobs minimum<input type="number" min="0" step="1" value={apolloCompanyAdvanced.activeJobsMinimum || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, activeJobsMinimum: event.target.value }))} /></label><label>Active jobs maximum<input type="number" min="0" step="1" value={apolloCompanyAdvanced.activeJobsMaximum || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, activeJobsMaximum: event.target.value }))} /></label><label>Jobs posted after<input type="date" value={apolloCompanyAdvanced.jobPostedAfter || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, jobPostedAfter: event.target.value }))} /></label><label>Jobs posted before<input type="date" value={apolloCompanyAdvanced.jobPostedBefore || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, jobPostedBefore: event.target.value }))} /></label><label>Most recent funding minimum<input type="number" min="0" step="1" value={apolloCompanyAdvanced.latestFundingMinimum || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, latestFundingMinimum: event.target.value }))} placeholder="USD" /></label><label>Most recent funding maximum<input type="number" min="0" step="1" value={apolloCompanyAdvanced.latestFundingMaximum || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, latestFundingMaximum: event.target.value }))} placeholder="USD" /></label><label>Total funding minimum<input type="number" min="0" step="1" value={apolloCompanyAdvanced.totalFundingMinimum || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, totalFundingMinimum: event.target.value }))} placeholder="USD" /></label><label>Total funding maximum<input type="number" min="0" step="1" value={apolloCompanyAdvanced.totalFundingMaximum || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, totalFundingMaximum: event.target.value }))} placeholder="USD" /></label><label>Most recent funding date from<input type="date" value={apolloCompanyAdvanced.latestFundingDateAfter || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, latestFundingDateAfter: event.target.value }))} /></label><label>Most recent funding date to<input type="date" value={apolloCompanyAdvanced.latestFundingDateBefore || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, latestFundingDateBefore: event.target.value }))} /></label><label>Headcount growth period<select value={apolloCompanyAdvanced.headcountGrowthPeriod || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, headcountGrowthPeriod: event.target.value }))}><option value="">Choose period</option><option value="6">6 months</option><option value="12">12 months</option><option value="24">24 months</option></select></label><label>Headcount growth minimum %<input type="number" step="1" value={apolloCompanyAdvanced.headcountGrowthMinimum || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, headcountGrowthMinimum: event.target.value }))} placeholder="Can be negative" /></label><label>Headcount growth maximum %<input type="number" step="1" value={apolloCompanyAdvanced.headcountGrowthMaximum || ""} onChange={event => setApolloCompanyAdvanced(current => ({ ...current, headcountGrowthMaximum: event.target.value }))} /></label></div><small className="wm-company-search-note">Enter comma-separated lists. Apollo industry names must match Apollo's supported names. Headcount growth requires a time period and at least one bound.</small></details>
        <small className="wm-company-search-note">Apollo Organization Search costs 1 credit per page. Searches never run automatically. Search results are not added to your Apollo account; use Save locally to add a browser workspace record.</small>
        {!apolloConfigured && <small className="wm-company-search-note">Set the server-side Apollo API key to enable this search. Your key is never sent to the browser.</small>}
        {apolloCompanyError && <div className="wm-company-search-error" role="alert">{apolloCompanyError}</div>}
        {fromApollo && <div className="wm-company-search-results"><span>{apolloCompanyTotal.toLocaleString()} Apollo results · page {apolloCompanyPage}{apolloCompanyLookalikeIds.length ? ` · similar to ${apolloCompanyLookalikeIds.length} selected company${apolloCompanyLookalikeIds.length === 1 ? "" : "ies"}` : ""}</span><div><button type="button" className="wm-text-action" disabled={apolloCompanyPage <= 1 || apolloCompanyLoading} onClick={event => searchApolloCompanies(event, apolloCompanyPage - 1)}>Previous · 1 credit</button><button type="button" className="wm-text-action" disabled={!apolloCompanyHasMore || apolloCompanyLoading} onClick={event => searchApolloCompanies(event, apolloCompanyPage + 1)}>Next · 1 credit</button>{selectedApolloCompanies.length > 0 && <button type="button" className="wm-text-action" onClick={() => { const existing = new Set(data.companies.flatMap(company => [company.name?.toLowerCase(), company.domain?.toLowerCase()].filter(Boolean))); const additions = selectedApolloCompanies.filter(company => { const keys = [company.name?.toLowerCase(), company.domain?.toLowerCase()].filter(Boolean); if (keys.some(key => existing.has(key))) return false; keys.forEach(key => existing.add(key)); return true; }); if (!additions.length) { notify("All selected companies are already saved in this browser"); setSelectedRows([]); return; } setData(current => ({ ...current, companies: [...additions.map(company => ({ ...company, status: "Target" })), ...current.companies] })); notify(`${additions.length} company${additions.length === 1 ? "" : "ies"} saved to this browser workspace`); setSelectedRows([]); }}>Save {selectedApolloCompanies.length} locally</button>}{selectedRows.length > 0 && <button type="button" className="wm-text-action" disabled={apolloCompanyLoading || selectedRows.length > 5 || !source.filter(company => selectedRows.includes(company.name) && company.apolloOrganizationId).length} onClick={event => { const seedIds = source.filter(company => selectedRows.includes(company.name) && company.apolloOrganizationId).map(company => company.apolloOrganizationId).slice(0, 5); if (!seedIds.length) return; searchApolloCompanies(event, 1, seedIds); }}>{selectedRows.length > 5 ? "Select up to 5 for lookalikes" : "Find similar companies · 1 credit"}</button>}{selectedApolloCompanies.length > 0 && <button type="button" className="wm-text-action" disabled={apolloCompanyEnrichmentLoading || selectedApolloCompanies.length > 10} onClick={() => { setApolloCompanyEnrichmentError(""); setApolloCompanyEnrichmentReview(selectedApolloCompanies.slice(0, 10)); }}>{selectedApolloCompanies.length > 10 ? "Select up to 10 to enrich" : `Review enrichment · up to ${selectedApolloCompanies.length} credits`}</button>}<button type="button" className="wm-text-action" onClick={() => { setApolloCompanyResults(null); setApolloCompanyLookalikeIds([]); setSelectedRows([]); }}>Clear results</button></div></div>}
        {apolloCompanyEnrichmentReview && <section className="wm-company-enrich-review" aria-label="Review company enrichment"><div><strong>Enrich {apolloCompanyEnrichmentReview.length} {apolloCompanyEnrichmentReview.length === 1 ? "company" : "companies"} in Apollo?</strong><small>1 credit per organization · up to {apolloCompanyEnrichmentReview.length} credits. This fetches current company data; it does not update Apollo accounts. Matching saved records in this browser will be refreshed.</small></div><p>{apolloCompanyEnrichmentReview.map(company => company.name).join(" · ")}</p>{apolloCompanyEnrichmentError && <div className="wm-company-search-error" role="alert">{apolloCompanyEnrichmentError}</div>}<div className="wm-company-enrich-actions"><button type="button" className="wm-outline" disabled={apolloCompanyEnrichmentLoading} onClick={() => setApolloCompanyEnrichmentReview(null)}>Cancel</button><button type="button" className="wm-primary" disabled={apolloCompanyEnrichmentLoading} onClick={runApolloCompanyEnrichment}><Database size={14}/>{apolloCompanyEnrichmentLoading ? "Enriching…" : `Enrich · max ${apolloCompanyEnrichmentReview.length} credits`}</button></div></section>}
      </form></details>
      {selectedRows.length > 0 && <div className="wm-bulk-actions"><span>{selectedRows.length} account{selectedRows.length === 1 ? "" : "s"} selected</span><button type="button" className="wm-outline" onClick={() => { const selected = source.filter(company => selectedRows.includes(company.name)); const references = selected.map(company => `${company.name}${company.domain ? ` (${company.domain})` : ""}`); openAssistantWithPrompt(`Research these selected companies using Apollo account data and available web research: ${references.join(", ")}. Summarize recent funding, hiring, and growth signals, distinguish verified facts from estimates, and ask before saving research to any records.`); }}><Sparkles size={14}/>Research with AI</button>{!fromApollo && <button type="button" className="wm-outline" onClick={() => { setFormName(""); setFormDetail(data.lists.find(list => list.type === "Companies")?.name || ""); setDialog("add-to-list"); }}>Add to company list</button>}</div>}
      {makeColumns(["Company", "Industry", "Employees", "Location", "Status", ""], rows, "name")}</>;
  };
  const renderPeopleTable = () => {
    const attentionNames = new Set(personFindings.map(person => person.name));
    const source = workspacePeople.map(person => ({ ...person, title: person.title || person.role || "Title unavailable", email: person.email || "", phone: person.phone || "", linkedinUrl: person.linkedinUrl || "", location: person.location || "Location unavailable", status: person.status || "Saved" })).filter(person => tab === "Verified" ? ["Verified", "Email available"].includes(person.status) : tab === "Needs attention" ? attentionNames.has(person.name) : true);
    const rows = filtered(source, ["name", "title", "company", "email", "phone", "linkedinUrl", "location", "aiResearch"]).map(person => {
      const saved = data.savedPeople.some(item => item.id === person.id || item.name === person.name);
      const record = { ...person, id: person.id || `local:${person.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` };
      const canEnrich = person.source === "apollo" && person.canEnrich && !person.email && !person.enrichmentAttempted;
      const emailAction = canEnrich && <button type="button" className="wm-text-action" aria-label={`${apolloConfigured ? "Find email for" : "Connect Apollo to find email for"} ${person.name}`} onClick={event => { event.stopPropagation(); if (!apolloConfigured) { onNavigate("Settings"); return; } if (!onEnrichPerson?.(person)) notify("Apollo enrichment could not start. Check the connection in Admin Settings."); }}>{apolloConfigured ? "Find email" : "Connect Apollo"}</button>;
      const emailLabel = person.email || (person.enrichmentAttempted ? "No email found" : "Email unavailable");
      const phoneHref = contactPhoneHref(person.phone);
      const linkedInHref = normalizeLinkedInUrl(person.linkedinUrl);
      return { ...record, _cells: [<span className="wm-record-name"><i className="wm-person-avatar">{person.name.split(" ").map(s=>s[0]).join("")}</i><span><strong>{person.name}</strong><small>{person.title || person.role || "Title unavailable"}{person.aiResearch ? " · AI research saved" : ""}</small><Pill tone={activitySourceTone(person)}>{activitySourceLabel(person)}</Pill></span></span>, <strong>{person.company}</strong>, person.location, <span className="wm-contact-email">{emailLabel}</span>, phoneHref ? <a className="wm-contact-channel" href={phoneHref} onClick={event => event.stopPropagation()}>{person.phone}</a> : <span className="wm-contact-channel">{person.phone || "Unavailable"}</span>, linkedInHref ? <a className="wm-contact-channel" href={linkedInHref} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>Open profile</a> : <span className="wm-contact-channel">{person.linkedinUrl ? "Check URL" : "Unavailable"}</span>, <Pill tone={person.status === "Verified" || person.status === "Email available" ? "green" : "gold"}>{person.status}</Pill>, <span className="wm-contact-row-actions">{emailAction}<button type="button" className="wm-text-action" aria-pressed={saved} onClick={event => { event.stopPropagation(); setData(current => ({ ...current, savedPeople: saved ? current.savedPeople.filter(item => item.id !== person.id && item.name !== person.name) : [record, ...current.savedPeople] })); notify(saved ? `${person.name} removed from saved people` : `${person.name} saved to your workspace`); }}>{saved ? "Saved" : "Save"}</button></span>] };
    });
    const selectedContacts = source.filter(person => selectedRows.includes(person.name));
    return <><div className="wm-tabs">{["All records", "Verified", "Needs attention"].map(item => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</div><SectionHeading title="People" detail="Search contacts and manage your prospect pipeline" action="Add to list" onAction={() => { setFormName(""); setFormDetail(data.lists.find(list => list.type === "People")?.name || ""); setDialog("add-to-list"); }} />{selectedContacts.length > 0 && <div className="wm-bulk-actions"><span>{selectedContacts.length} contact{selectedContacts.length === 1 ? "" : "s"} selected</span><button type="button" className="wm-outline" onClick={() => { const references = selectedContacts.map(contactReference); openAssistantWithPrompt(`Research these selected contacts using Apollo account data and available web research: ${references.join(", ")}. Summarize their current role, likely priorities, and relevant recent signals; cite the evidence and ask before saving research notes.`); }}><Sparkles size={14}/>Research with AI</button></div>}{makeColumns(["Person", "Company", "Location", "Email", "Phone", "LinkedIn", "Status", ""], rows, "name")}</>;
  };
  const renderLists = () => <><SectionHeading title="Lists" detail="Keep people and companies organized for outreach" secondaryAction="Create company list" onSecondaryAction={() => startCreateList("Companies")} action="Create people list" onAction={() => startCreateList("People")} /><div className="wm-list-grid">{filtered(data.lists, ["name", "type", "description"]).map(list => <button className="wm-list-card" key={list.name} onClick={() => setSelected(list)}><span className="wm-list-icon">{list.type === "Companies" ? <Building2 size={18}/> : <Users size={18}/>}</span><strong>{list.name}</strong><Pill tone={listSourceTone(list)}>{listSourceLabel(list)}</Pill><small>{list.description}</small><span className="wm-list-meta">{list.count} {list.type === "Companies" ? list.count === 1 ? "company" : "companies" : list.count === 1 ? "person" : "people"} · Updated {list.updated}</span></button>)}</div>{!filtered(data.lists, ["name", "type", "description"]).length && renderEmptyState()}</>;
  const renderEnrichment = () => {
    const audit = data.enrichmentAudit;
    const checkedAt = audit?.checkedAt ? new Date(audit.checkedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not run";
    const auditIsCurrent = audit?.rulesVersion === 3 && audit.sourceSignature === dataCheckSignature;
    const runDataCheck = () => {
      const checkedAt = new Date().toISOString();
      const findings = personFindings;
      setData(current => ({ ...current, enrichmentAudit: { checkedAt, checkedCount: workspacePeople.length, findings, rulesVersion: 3, sourceSignature: dataCheckSignature } }));
      notify(`Checked ${workspacePeople.length} local contacts · ${findings.length} need attention`);
    };
    return <><SectionHeading title="Data enrichment" detail="Review missing and unverified contact data in your workspace"/><div className="wm-metrics-grid"><Metric icon={Database} label="Records checked" value={auditIsCurrent ? audit.checkedCount : "—"} change={auditIsCurrent ? `Last run ${checkedAt}` : audit ? "Saved check is out of date · run again" : "Run a local data check"}/><Metric icon={Check} label="Email coverage" value={`${emailCoverage}%`} change={`${usableEmailCount} of ${workspacePeople.length} have a non-sample email${sampleEmailCount ? ` · ${sampleEmailCount} sample` : ""}`}/><Metric icon={Zap} label="Needs attention" value={personFindings.length} change="Contacts with missing or unverified fields"/><Metric icon={Activity} label="Last check" value={auditIsCurrent ? checkedAt : audit ? "Out of date" : checkedAt} change={auditIsCurrent ? "Local browser audit" : audit ? "Run a fresh local audit" : "Local browser audit"}/></div><section className="wm-panel wm-enrich-panel"><div><span className="wm-large-icon"><Database size={22}/></span><div><h3>Check contact data</h3><p>Review workspace contacts for missing, sample, or unverified email, phone, LinkedIn, company, and location fields. Email coverage excludes reserved .example addresses. This local check reports gaps; it does not invent or update contact data.</p></div></div><button className="wm-primary" onClick={runDataCheck}><Zap size={15}/>{audit ? "Run check again" : "Run data check"}</button>{auditIsCurrent ? <div className="wm-enrichment-results"><strong>Latest check · {audit.findings.length} records need attention</strong>{audit.findings.length?audit.findings.slice(0,6).map(person=><div key={person.name}><span>{person.name}<small>{person.company}</small></span><Pill tone="gold">{person.missing.join(" · ")}</Pill></div>):<small>All checked contacts have a non-sample email, phone, LinkedIn URL, company, and location.</small>}</div> : audit ? <div className="wm-enrichment-results"><strong>Check is out of date</strong><small>The saved results predate the current checks or the contact data changed. Run the check again to refresh them.</small></div> : null}</section>{renderPeopleTable()}</>;
  };
  const renderSequences = () => <><SectionHeading title="Sequences" detail="Automate thoughtful, multichannel prospect follow-up" action="Create sequence" onAction={quickAdd} />{makeColumns(["Sequence", "Status", "People", "Replies", "Steps", "Owner", "Action"], filtered(data.sequences, ["name", "owner", "status"]).map(item => ({...item, _cells:[<span className="wm-record-name"><i className="wm-seq-icon"><Workflow size={16}/></i><span><strong>{item.name}</strong><Pill tone={item.source === "sample" ? "gold" : item.source === "apollo" ? "green" : "blue"}>{sequenceSourceLabel(item)}</Pill></span></span>,<Pill tone={item.status === "Active" ? "green" : "gold"}>{item.status}</Pill>,sequenceHasPerformanceMetrics(item) ? item.people : (item.enrolledPeople || []).length,sequenceHasPerformanceMetrics(item) ? item.replies : "—",`${item.steps} steps`,item.owner,<button className="wm-text-action" onClick={event=>{event.stopPropagation();setData(current=>({...current,sequences:current.sequences.map(sequence=>sequence.name===item.name?{...sequence,status:sequence.status==="Active"?"Paused":"Active"}:sequence)}));}}>{item.status==="Active"?"Pause":"Activate"}</button>]})), "name")}</>;
  const renderTasks = () => {
    const today = localDateValue();
    const visibleTasks = recordsInWorkspaceTab(data.tasks, "Tasks", tab, today);
    return <><div className="wm-tabs">{["All", "Overdue", "Due today", "Upcoming", "Completed"].map(item=><button className={tab===item?"active":""} onClick={()=>setTab(item)} key={item}>{item}</button>)}</div><SectionHeading title="Tasks" detail="Stay on top of follow-ups and daily priorities" action="Add task" onAction={quickAdd}/><div className="wm-task-list">{filtered(visibleTasks,["title","person","type","assignedTo","priority","notes","taskStatus"]).map((task,index)=>{const dueDate=task.dueDate||(task.due==="Today"?today:null);const overdue=!task.done&&dueDate&&dueDate<today;const taskMeta=[task.type,task.person,task.assignedTo?`Assigned to ${task.assignedTo}`:"",task.priority?`${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority`:"",task.taskStatus==="Skipped"?"Skipped":"",task.notes?`Note: ${task.notes}`:"",task.completionNote?`Completion note: ${task.completionNote}`:""].filter(Boolean).join(" · ");return <div className={`wm-task-row ${task.done?"done":""}`} key={`${task.title}-${index}`}><button className="wm-checkbox" role="checkbox" aria-checked={task.done} aria-label={`Complete ${task.title}`} onClick={()=>setTaskCompletion(task,!task.done)}>{task.done&&<Check size={12}/>}</button><div><strong>{task.title}</strong><small>{taskMeta}</small><Pill tone={activitySourceTone(task)}>{activitySourceLabel(task)}</Pill></div><Pill tone={overdue||task.due==="Today"?"gold":""}>{overdue?`Overdue · ${task.due}`:task.due}</Pill><button className="wm-more" aria-label={`Task actions for ${task.title}`} onClick={()=>setSelected(task)}><MoreHorizontal size={16}/></button></div>})}</div>{!filtered(visibleTasks,["title","person","type","assignedTo","priority","notes","taskStatus"]).length && renderEmptyState()}</>;
  };
  const renderDeals = () => <><SectionHeading title="Deals" detail="Track opportunities from qualification through close" action="Create deal" onAction={quickAdd}/><div className="wm-deal-board">{stages.map(stage=>{const items=filtered(data.deals.filter(deal=>deal.stage===stage),["name","company","owner","stage"]);return <section className="wm-deal-column" key={stage}><header><span>{stage}</span><Pill>{items.length}</Pill><strong>{fmtMoney(items.reduce((sum,d)=>sum+d.amount,0))}</strong></header>{items.map(deal=><div className="wm-deal-card" key={deal.name} role="button" tabIndex={0} onClick={()=>setSelected(deal)} onKeyDown={event=>event.key==="Enter"&&setSelected(deal)}><strong>{deal.name}</strong><Pill tone={activitySourceTone(deal)}>{activitySourceLabel(deal)}</Pill><small>{deal.company} · Close {deal.close}</small><span>{fmtMoney(deal.amount)} <i>{deal.owner}</i></span><select aria-label={`Move ${deal.name} to stage`} value={deal.stage} onClick={event=>event.stopPropagation()} onChange={event=>setDealStage(deal.name,event.target.value)}>{stages.map(name=><option key={name}>{name}</option>)}</select></div>)}</section>;})}</div></>;
  const renderMeetings = () => <><div className="wm-tabs">{["Upcoming", "Past", "All meetings"].map(item=><button className={tab===item?"active":""} onClick={()=>setTab(item)} key={item}>{item}</button>)}</div><SectionHeading title="Meetings" detail="Prepare for conversations and keep next steps moving" action="Schedule meeting" onAction={quickAdd}/>{makeColumns(["Meeting", "Contact", "When", "Duration", "Type", ""], filtered(data.meetings.filter(item=>tab==="Past"?item.past:tab==="Upcoming"?!item.past:true),["title","person","time"]).map(item=>({...item,_cells:[<span className="wm-record-name"><i className="wm-meeting-icon"><CalendarDays size={16}/></i><span><strong>{item.title}</strong><Pill tone={activitySourceTone(item)}>{activitySourceLabel(item)}</Pill></span></span>,item.person,item.time,item.duration,item.type,<button className="wm-text-action" onClick={event=>{event.stopPropagation();setSelected(item)}}>Details</button>]})),"title")}</>;
  const renderEmails = () => <><div className="wm-tabs">{["All mail", "Inbox", "Sent", "Drafts"].map(item=><button className={tab===item?"active":""} onClick={()=>setTab(item)} key={item}>{item}</button>)}</div><SectionHeading title="Emails" detail="Manage prospect conversations from one workspace" action="Compose" onAction={()=>{setEmailDraftEditing(null);setFormName("");setFormDetail("");setFormBody("");setDialog("compose");}}/><p className="wm-source-disclaimer">Sample conversations are illustrative. Local drafts stay in this browser and are not sent.</p><div className="wm-email-list">{filtered(data.emails.filter(email=>tab==="All mail"?true:(email.folder||"Inbox")===(tab==="All mail"?"Inbox":tab)),["from","to","recipient","subject","preview"]).map((email,index)=><button className={`wm-email-row ${email.unread?"unread":""}`} key={email.id || `${email.subject}-${index}`} onClick={()=>{setData(current=>({...current,emails:current.emails.map(item=>item.id===email.id?{...item,unread:false}:item)}));setSelected({...email,unread:false});}}><span className="wm-email-dot">{email.unread&&<i/>}</span><i className="wm-person-avatar">{((email.folder==="Drafts"?email.recipient||email.to:email.from)||"?").split(/[\s@.]+/).filter(Boolean).map(s=>s[0]).join("").slice(0,2).toUpperCase()}</i><span className="wm-email-content"><strong>{email.folder==="Drafts"?(email.recipient?`Draft · ${email.recipient}`:email.to?`Draft · To ${email.to}`:"Draft · recipient not set"):email.from}</strong><b>{email.subject}</b><small>{email.recipientNeedsReview ? `Review recipient · ${email.preview}` : email.preview}</small><Pill tone={activitySourceTone(email)}>{emailSourceLabel(email)}</Pill></span><small className="wm-email-time">{email.time}</small></button>)}</div>{!filtered(data.emails.filter(email => tab === "All mail" || (email.folder || "Inbox") === tab), ["from", "to", "recipient", "subject", "preview"]).length && renderEmptyState()}</>;
  const renderCalls = () => <><SectionHeading title="Calls" detail="Review call activity and plan your next conversation" action="Log a call" onAction={()=>{setFormName("");setFormDetail("Connected");setFormBody("");setDialog("log-call");}}/><p className="wm-source-disclaimer">Sample call logs are fictional. Calls you log here are stored locally; this app does not place calls.</p>{makeColumns(["Contact", "Company", "Time", "Duration", "Outcome", "Note"],filtered(data.calls,["person","company","outcome","note"]).map(call=>({...call,_cells:[<span className="wm-record-name"><i className="wm-person-avatar">{call.person.split(" ").map(s=>s[0]).join("")}</i><span><strong>{call.person}</strong><Pill tone={activitySourceTone(call)}>{activitySourceLabel(call)}</Pill></span></span>,call.company,call.time,call.duration,<Pill tone={call.outcome==="Connected"?"green":"gold"}>{call.outcome}</Pill>,call.note]})),"person")}</>;
  const renderConversations = () => {
    const recordings = filtered(data.recordings, ["title", "person", "summary"]);
    const topics = [
      ["Prospecting and pipeline", /outbound|prospect|pipeline|lead generation/i],
      ["Product and integrations", /platform|integration|technical|feature/i],
      ["Buying timeline", /quarter|timeline|month|evaluat|review/i],
      ["Security", /security|compliance|privacy/i],
      ["Follow-up commitments", /send|follow.up|next step|agreed|share/i],
      ["Onboarding", /onboard|implementation|implementing/i],
    ].map(([name, pattern]) => ({ name, matches: recordings.filter(item => pattern.test(item.summary || "")) })).filter(topic => topic.matches.length);
    const summaryCards = <div className="wm-conversation-summaries">{recordings.map(item => <article className="wm-panel" key={workspaceRecordKey(item)}><header><span><strong>{item.title}</strong><small>{item.person} · {item.date} · {item.duration}</small></span><span className="wm-conversation-tags"><Pill tone={activitySourceTone(item)}>{activitySourceLabel(item)}</Pill><Pill tone={item.sentiment === "Positive" ? "green" : ""}>{item.sentiment || "No sentiment recorded"}</Pill></span></header><p>{item.summary || "No summary is saved for this conversation."}</p><button className="wm-text-action" onClick={() => setSelected(item)}>Open conversation <ChevronRight size={13}/></button></article>)}</div>;
    return <><div className="wm-tabs">{["Recordings", "Call insights", "Topics"].map(item => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</div><SectionHeading title="Conversations" detail="Review call recordings, summaries, and follow-up signals" secondaryAction="Review with Luna" onSecondaryAction={() => openAssistantWithPrompt("Review the saved call summaries in my workspace. Summarize stated needs, commitments, and open questions. Cite each saved conversation and ask before creating follow-up tasks.")}/><p className="wm-source-disclaimer">Sample recordings and summaries are illustrative notes, not live calls or transcripts.</p>
    {tab === "Call insights" ? <><div className="wm-metrics-grid wm-conversation-metrics"><Metric icon={Phone} label="Saved conversations" value={recordings.length} change="Current matching recordings"/><Metric icon={Target} label="Positive sentiment" value={recordings.filter(item => item.sentiment === "Positive").length} change="From the saved sentiment field"/><Metric icon={ContactRound} label="Contacts represented" value={new Set(recordings.map(item => item.person)).size} change="Unique contacts in these records"/></div>{recordings.length ? summaryCards : renderEmptyState()}</> : tab === "Topics" ? <><p className="wm-topic-explanation">Topics are grouped by keywords in saved summaries. Open a conversation to review the source.</p><div className="wm-topic-grid">{topics.map(topic => <section className="wm-panel" key={topic.name}><h3>{topic.name}<Pill>{topic.matches.length}</Pill></h3>{topic.matches.map(item => <button className="wm-focus-row" key={workspaceRecordKey(item)} onClick={() => setSelected(item)}><ContactRound size={16}/><span><strong>{item.title}</strong><small>{item.person}</small></span><ChevronRight size={14}/></button>)}</section>)}</div>{!topics.length && renderEmptyState()}</> : <><div className="wm-conversation-recordings-desktop">{makeColumns(["Conversation", "Contact", "Date", "Duration", "Sentiment", "AI summary"], recordings.map(item => ({ ...item, _cells: [<span className="wm-record-name"><i className="wm-play-icon">▶</i><span><strong>{item.title}</strong><Pill tone={activitySourceTone(item)}>{activitySourceLabel(item)}</Pill></span></span>, item.person, item.date, item.duration, <Pill tone={item.sentiment === "Positive" ? "green" : ""}>{item.sentiment}</Pill>, <button className="wm-text-action" onClick={event => { event.stopPropagation(); setSelected(item); }}>Read summary</button>] })), "title")}</div><div className="wm-conversation-recordings-mobile">{summaryCards}</div></>}</>;
  };
  const renderAnalytics = () => {
    const sampleSequences = data.sequences.filter(item => item.source === "sample");
    const totalEnrolled = sampleSequences.reduce((sum,item)=>sum+Number(item.people||0),0);
    const totalReplies = sampleSequences.reduce((sum,item)=>sum+Number(item.replies||0),0);
    const replyRate = totalEnrolled ? Math.round(totalReplies/totalEnrolled*1000)/10 : 0;
    const measuredCalls = data.calls.filter(isMeasuredWorkspaceRecord);
    const sampleCalls = data.calls.filter(call => call.source === "sample");
    const connectedCalls = measuredCalls.filter(call=>call.outcome==="Connected").length;
    const measuredDeals = data.deals.filter(isMeasuredWorkspaceRecord);
    const sampleDeals = data.deals.filter(deal => deal.source === "sample");
    const openDeals = measuredDeals.filter(deal=>!closedDealStages.has(deal.stage));
    const openPipeline = openDeals.reduce((sum,deal)=>sum+Number(deal.amount||0),0);
    const samplePeople = workspacePeople.filter(person => person.source === "sample").length;
    const measuredPeople = workspacePeople.filter(isMeasuredWorkspaceRecord).length;
    const activity = [
      ["Contacts saved", data.savedPeople.filter(isMeasuredWorkspaceRecord).length],
      ["Inbox messages", data.emails.filter(email=>isMeasuredWorkspaceRecord(email)&&(email.folder||"Inbox")==="Inbox").length],
      ["Calls logged", measuredCalls.length],
      ["Tasks completed", data.tasks.filter(task=>isMeasuredWorkspaceRecord(task)&&task.done).length],
      ["Meetings scheduled", data.meetings.filter(isMeasuredWorkspaceRecord).length],
    ];
    const maxActivity = Math.max(1,...activity.map(([,count])=>count));
    const topSampleSequences = [...sampleSequences].sort((a,b)=>(Number(b.replies||0)/Math.max(1,Number(b.people||0)))-(Number(a.replies||0)/Math.max(1,Number(a.people||0))));
    return <><SectionHeading title="Analytics" detail="Workspace counts and performance from your local records" secondaryAction="Analyze with Luna" onSecondaryAction={()=>openAssistantWithPrompt("Analyze my workspace performance. Use the saved pipeline, task, call, and sequence records. Explain what the available data supports and recommend three useful next actions for review.")}/><div className="wm-metrics-grid"><Metric icon={Users} label="Contact records" value={workspacePeople.length} change={`${samplePeople} sample · ${measuredPeople} local, imported, or Apollo`}/><Metric icon={Mail} label="Sample sequence reply rate" value={sampleSequences.length ? `${replyRate}%` : "—"} change={sampleSequences.length ? `${totalReplies} sample replies / ${totalEnrolled} sample enrollments` : "No measured campaign results"}/><Metric icon={Phone} label="Calls connected" value={measuredCalls.length ? connectedCalls : "—"} change={`${measuredCalls.length} non-sample call logs · ${sampleCalls.length} sample`}/><Metric icon={Target} label="Open pipeline" value={measuredDeals.length ? fmtMoney(openPipeline) : "—"} change={`${openDeals.length} non-sample open deals · ${sampleDeals.length} sample deals`}/></div><div className="wm-home-grid"><section className="wm-panel"><SectionHeading title="Workspace activity" detail="Local, imported, and Apollo records · sample data excluded"/><div className="wm-activity-list">{activity.map(([label,count])=><div key={label}><span>{label}</span><div><i style={{width:`${count/maxActivity*100}%`}}/></div><strong>{count}</strong></div>)}</div></section><section className="wm-panel"><SectionHeading title="Sample sequence results" detail="Illustrative data · not live campaign performance"/>{topSampleSequences.length ? topSampleSequences.map((item,index)=><div className="wm-rank-row" key={item.name}><b>{index+1}</b><span>{item.name}<small>{item.people} sample enrollments · {item.replies} sample replies</small></span><strong>{Math.round(Number(item.replies||0)/Math.max(1,Number(item.people||0))*100)}%</strong></div>) : <p className="wm-topic-explanation">No sequence performance data is available. Local sequence plans do not send outreach or generate replies.</p>}</section></div></>;
  };
  const renderWorkflows = () => <><SectionHeading title="Workflows" detail="Run local follow-up actions when sales activity happens" action="Create workflow" onAction={quickAdd}/>{makeColumns(["Workflow", "Trigger", "Status", "Runs", "Action"],filtered(data.workflows||[],["name","trigger","status"]).map(item=>({...item,_cells:[<span className="wm-record-name"><i className="wm-seq-icon"><Zap size={16}/></i><span><strong>{item.name}</strong><Pill tone={activitySourceTone(item)}>{activitySourceLabel(item)}</Pill></span></span>,item.trigger,<Pill tone={item.status==="Active"?"green":"gold"}>{item.status}</Pill>,<span className="wm-workflow-run-count">{item.source==="sample"?<><span>{item.runs} sample</span>{item.localRuns>0&&<small>{item.localRuns} local</small>}</>:item.runs}</span>,<button className="wm-text-action" onClick={event=>{event.stopPropagation();setData(current=>({...current,workflows:(current.workflows||[]).map(workflow=>workflow.name===item.name?{...workflow,status:workflow.status==="Active"?"Paused":"Active"}:workflow)}));notify(`${item.name} ${item.status==="Active"?"paused":"activated"}`);}}>{item.status==="Active"?"Pause":"Activate"}</button>]})),"name")}</>;
  const assistantFeaturedPrompts = apolloConfigured
    ? ["Find people matching my ICP", "Send a one-off email to Maya Patel", "Create a 5-step phone-first sequence for SaaS sales leaders", "Analyze email and sequence performance this quarter"]
    : ["Find sales leaders in SaaS", "Prepare for my upcoming meetings", "Reply to Maya Patel’s email saying Thursday works for me.", "Summarize my pipeline"];
  const assistantVisiblePrompts = [...assistantFeaturedPrompts, ...assistantPromptSuggestions.filter(prompt => !assistantFeaturedPrompts.includes(prompt))];
  const renderAssistantAgents = () => <div className="wm-agent-page"><div className="wm-agent-overview"><div><span className="wm-eyebrow">Scheduled work</span><h3>Let agents prepare the next step</h3><p>Choose a job, review its run settings, then inspect recommendations in a dedicated assistant conversation.</p></div><span className="wm-agent-demo-badge">{apolloConfigured ? "Apollo Assistant" : "Local demo"}</span></div><div className="wm-agent-grid">{(data.assistantAgents || seed.assistantAgents).map(agent => <article className="wm-agent-card" key={agent.type}><header><span className="wm-agent-icon"><Sparkles size={16}/></span><div><h4>{agent.name}</h4><p>{agent.description}</p></div><label className="wm-agent-toggle" title={agent.enabled ? "Pause agent" : "Activate agent"}><input type="checkbox" checked={Boolean(agent.enabled)} disabled={apolloConfigured} onChange={event=>updateAssistantAgent(agent.type,"enabled",event.target.checked)}/><span/></label></header><div className="wm-agent-settings"><label>Run frequency<select value={agent.frequency || "Weekly"} onChange={event=>updateAssistantAgent(agent.type,"frequency",event.target.value)}>{["Daily","Weekly","Monthly"].map(item=><option key={item}>{item}</option>)}</select></label>{agent.frequency === "Weekly" && <label>Day<select value={agent.dayOfWeek || "Monday"} onChange={event=>updateAssistantAgent(agent.type,"dayOfWeek",event.target.value)}>{["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(item=><option key={item}>{item}</option>)}</select></label>}<label>Run time<input type="time" value={agent.runTime || "09:00"} onChange={event=>updateAssistantAgent(agent.type,"runTime",event.target.value)}/></label><label>Credit limit per run<input type="number" min="0" max="10000" step="1" value={agent.creditLimit ?? 0} onChange={event=>updateAssistantAgent(agent.type,"creditLimit",Math.max(0,Number(event.target.value)||0))}/></label></div><div className="wm-agent-next-run"><span>{apolloConfigured ? "Schedule managed in Apollo" : agent.enabled ? `Next run · ${new Date(agent.nextRunAt || nextAgentRun(agent)).toLocaleString(undefined,{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}` : "Paused · no upcoming run"}</span><span>{agent.lastRunAt ? `Last run · ${new Date(agent.lastRunAt).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}` : "Not run yet"}</span></div>{agent.lastRunAt && <button type="button" className="wm-agent-result-link" onClick={()=>openAssistantAgentResult(agent)}><Sparkles size={13}/><span>View latest run result</span><small>{agent.lastRunType || "Agent run"}</small></button>}<footer><button className="wm-primary" onClick={()=>runAssistantAgent(agent.type)}><Zap size={14}/> {apolloConfigured ? "Review & run in Apollo" : "Run now"}</button>{apolloConfigured && <button className="wm-outline" onClick={()=>runAssistantAgent(agent.type,false,true)}>Configure schedule with Apollo Assistant</button>}<small>{apolloConfigured ? "Credit use varies by task; review before submitting. Schedule changes require confirmation in the assistant chat." : agent.creditLimit > 0 ? `Ask before estimated use exceeds ${agent.creditLimit} credits.` : "No credit allowance set."}</small></footer></article>)}</div><small className="wm-agent-disclaimer">{apolloConfigured ? "Manual runs and schedule requests are sent to Apollo Assistant only after approval. Confirm any proposed schedule change in the assistant chat; this preview cannot verify Apollo account settings." : "Schedules are saved in this browser and run while this workspace app is open, with one catch-up run when reopened. Apollo background services and credit checks are not connected; runs use local sample records only."}</small></div>;
  const renderSettings = () => {
    const panels = {
      General: [["Workspace profile", "Company profile and workspace defaults are not editable in this demo.", "Unavailable in demo"], ["Notifications", "Choose whether unread emails and due-today tasks appear in Activity.", notificationsEnabled ? "Turn off notifications" : "Turn on notifications"], ["User preferences", "Language, time format, and default page are not configured here.", "Unavailable in demo"]],
      Team: [["Team members", "Invitations and team membership are not connected in this demo.", "Unavailable in demo"], ["Roles and permissions", "Role-based record permissions are not configured here.", "Unavailable in demo"]],
      Email: [["Mailbox connection", "Sending and reply tracking are demo-only.", "Demo only"], ["Deliverability", "Mailbox and domain health are not connected here.", "Not connected"]],
      Integrations: [["CRM connection", "CRM sync is not connected in this demo.", "Not connected"], ["Apollo API", "People Search, Organization Search, organization enrichment, email enrichment, and Assistant use the server-side API proxy", apolloConfigured ? "API key set · access checked on use" : "Demo mode"]],
      Data: [["Data privacy", "Records and preferences stay in this browser.", "Local browser"], ["Export data", "Download a JSON copy of local workspace records.", "Export workspace"]],
    };
    const contextFields = [["name", "Context name", "Name this product or service"], ["companyProduct", "Company and product", "What do you sell, who do you help, and what problem do you solve?"], ["idealCustomerProfile", "Ideal customer profile", "Industries, company size, roles, locations, and buying signals"], ["valueProposition", "Value proposition", "The outcomes and differentiators your team can credibly promise"], ["writingStyle", "Writing style", "For example: concise, direct, friendly, consultative"], ["claimsToAvoid", "Claims to avoid", "Unverified numbers, unsupported guarantees, or restricted topics"]];
    return <><SectionHeading title="Admin settings" detail="Manage workspace preferences and connections"/><div className="wm-tabs">{[...Object.keys(panels), "AI Context"].map(item=><button className={settingsTab===item?"active":""} onClick={()=>setSettingsTab(item)} key={item}>{item}</button>)}</div>{settingsTab === "AI Context" ? <section className="wm-context-panel"><div className="wm-context-heading"><div><h3>Give the assistant useful business context</h3><p>Create a context for each product or service. The assistant uses the selected context for prospect matching and outreach drafts.</p></div><span>Auto-saved locally</span></div><div className="wm-context-toolbar"><label><span>Product or service</span><select value={activeAssistantContextId} onChange={event=>selectAssistantContext(event.target.value)}>{assistantProducts.map(product=><option key={product.id} value={product.id}>{product.name}</option>)}</select></label><button className="wm-outline" onClick={addAssistantProduct}><Plus size={13}/> Add product/service</button>{assistantProducts.length>1&&<button className="wm-text-action" onClick={removeAssistantProduct}>Remove context</button>}</div><div className="wm-context-fields">{contextFields.map(([key, label, placeholder])=><label className="wm-context-field" key={key}><span>{label}</span>{key === "name" ? <input value={assistantContext.name || ""} placeholder={placeholder} onChange={event=>updateAssistantContextField(key,event.target.value)}/> : <textarea rows={key === "idealCustomerProfile" || key === "companyProduct" ? 4 : 3} value={assistantContext[key] || ""} placeholder={placeholder} onChange={event=>updateAssistantContextField(key,event.target.value)}/>} {key === "companyProduct" && <small className="wm-context-field-help" role="status">{assistantContextReady ? "Ready for outreach drafts. Changes save automatically in this browser." : "Required for outreach drafts. Include what you sell, who you help, and the problem you solve. Changes save automatically in this browser."}</small>}</label>)}</div><section className="wm-memory-section"><div><h4>Personal memory</h4><p>These preferences carry across conversations. Instructions in the current chat or request take priority. {apolloConfigured ? "Saved preferences are included when you approve a request sent to Apollo." : "Local drafts apply recognized tone and length preferences; freeform notes are saved but are not interpreted by an AI model."}</p></div><div className="wm-memory-fields"><label><span>Writing style</span><input value={(data.assistantMemory || seed.assistantMemory).writingStyle || ""} placeholder="Concise, warm, direct" onChange={event=>updateAssistantMemoryField("writingStyle",event.target.value)}/></label><label><span>Territory</span><input value={(data.assistantMemory || seed.assistantMemory).territory || ""} placeholder="Western US, UK, or named regions" onChange={event=>updateAssistantMemoryField("territory",event.target.value)}/></label><label><span>Target audience</span><input value={(data.assistantMemory || seed.assistantMemory).targetAudience || ""} placeholder="Roles, industries, or company types" onChange={event=>updateAssistantMemoryField("targetAudience",event.target.value)}/></label><label><span>Additional preferences</span><textarea rows={2} value={(data.assistantMemory || seed.assistantMemory).customInstructions || ""} placeholder="Other preferences to remember across chats" onChange={event=>updateAssistantMemoryField("customInstructions",event.target.value)}/></label></div></section><small className="wm-context-disclaimer">{apolloConfigured ? "Context is stored in this browser. When you approve a connected Apollo Assistant request, the selected profile and saved preferences are sent to Apollo." : "This demo saves context locally. It does not send the information to Apollo or an AI model."}</small></section> : <div className="wm-settings-grid">{(settingsTab === "Integrations" ? panels[settingsTab].filter(([name]) => name !== "Apollo API") : panels[settingsTab]).map(([name,description,action])=><article className="wm-setting-card" key={name}><div><h3>{name}</h3><p>{description}</p></div>{name === "Notifications" || name === "Export data" ? <button type="button" className="wm-outline" onClick={()=>{if(name==="Notifications"){setNotificationsEnabled(!notificationsEnabled);notify(`Notifications ${notificationsEnabled?"paused":"enabled"} in this browser`);}else exportWorkspace();}}>{action}</button> : <span className="wm-setting-status" role="status">{action}</span>}</article>)}{settingsTab === "Integrations" && <article className="wm-setting-card wm-apollo-connection-card"><div><h3>Apollo account</h3><p>Connect People Search, company search, enrichment, and Apollo Assistant using your own API key.</p></div>{apolloConfigured ? <div className="wm-apollo-connection-state"><span className="wm-connection-badge">Apollo connected</span><p>{apolloConnectionSource === "session" ? "The key is held in local server memory only and will clear when the preview server stops." : "The key is loaded from the local server environment."} Apollo health confirms the key is valid; feature access is checked per endpoint. API-key requests act as the workspace’s earliest active admin, which may differ from the signed-in browser user.</p>{apolloConnectionSource === "session" && <button type="button" className="wm-outline" disabled={apolloConnectionBusy} onClick={disconnectApolloKey}>{apolloConnectionBusy ? "Disconnecting…" : "Disconnect Apollo"}</button>}</div> : <form className="wm-apollo-connect-form" onSubmit={connectApolloKey}><label>API key<input type="password" autoComplete="off" spellCheck="false" value={apolloKeyDraft} onChange={event=>setApolloKeyDraft(event.target.value)} placeholder="Paste your Apollo API key" aria-label="Apollo API key" /></label><div className="wm-apollo-connect-actions"><button type="submit" className="wm-primary" disabled={apolloConnectionBusy || !apolloKeyDraft.trim()}>{apolloConnectionBusy ? "Checking key…" : "Connect Apollo"}</button><a href="https://docs.apollo.io/docs/create-api-key" target="_blank" rel="noreferrer">Create an API key</a></div><small>The local server validates the key with Apollo’s zero-credit health check, then holds it in memory for approved API requests. It is never written to browser storage or disk and clears when the server stops.</small><small>Enable People API Search, Organization Search, Bulk Organization Enrichment, People Enrichment, and AI Assistant task/poll access on the key. Health confirms authentication only; Apollo checks endpoint permissions when each feature runs. API-key requests act as the workspace’s earliest active admin, which may differ from this browser sign-in.</small></form>}{apolloConnectionError && <p className="wm-apollo-connection-error" role="alert">{apolloConnectionError}</p>}</article>}</div>}</>;
  };

  const renderModule = () => {
    switch(module) {
      case "Home": return renderHome();
      case "Assistant": return <div className={`wm-assistant ${assistantMessages.length > 1 ? "has-messages" : ""}`}><div className="wm-assistant-intro"><span><Sparkles size={19}/></span><h2>Your sales assistant</h2><p>Find and qualify prospects, research accounts, draft outreach, and build campaign plans from your workspace.</p><button className="wm-context-link" onClick={()=>{setSettingsTab("AI Context");onNavigate("Settings");}}>Manage AI context <ChevronRight size={13}/></button><button className="wm-context-link" onClick={startAssistantChat}><Plus size={13}/> New chat</button></div><div className="wm-assistant-tabs"><button className={assistantView==="Chat"?"active":""} onClick={()=>setAssistantView("Chat")}>Chat</button><button className={assistantView==="Agents"?"active":""} onClick={()=>setAssistantView("Agents")}>Agents</button></div>{assistantView==="Agents"?renderAssistantAgents():<>{assistantMessages.length<=1&&<div className={`wm-prompt-chips ${showAllAssistantPrompts ? "expanded" : ""}`}>{assistantVisiblePrompts.slice(0,showAllAssistantPrompts?assistantVisiblePrompts.length:4).map(prompt=><button key={prompt} onClick={()=>setAssistantInput(prompt)}>{prompt}</button>)}<button className="wm-prompt-more" onClick={()=>setShowAllAssistantPrompts(value=>!value)}>{showAllAssistantPrompts?"Show fewer":"View all prompts"}</button></div>}<details className="wm-chat-instructions"><summary>Instructions for this chat</summary><textarea rows={2} value={activeAssistantChat?.chatInstructions || ""} onChange={event=>setAssistantChatInstructions(event.target.value)} placeholder="For example: keep emails concise and avoid overly familiar language"/></details>{apolloConfigured ? <details className="wm-chat-budget"><summary>Connected Apollo Assistant</summary><p>Each request waits for your approval before it is sent. Apollo Assistant can take actions in your account and may use a variable number of credits. The official API does not expose a per-task estimate or credit cap, so the local cap is unavailable while connected.</p><small>Your prompt, selected product context, chat instructions, and saved personal preferences are sent to Apollo when you choose Run in Apollo.</small></details> : <details className="wm-chat-budget"><summary>Credit limit · {activeAssistantChat?.creditLimit == null ? "ask before spending" : `${activeAssistantChat.creditLimit} credits`}</summary><label>Ask for approval before credit-consuming actions<select value={activeAssistantChat?.creditLimit == null ? "ask" : activeAssistantChat.creditLimitCustom ? "custom" : String(activeAssistantChat.creditLimit)} onChange={event=>{const value=event.target.value;if(value==="ask")setAssistantChatCreditLimit(null,false);else if(value==="custom")setAssistantChatCreditLimit(activeAssistantChat?.creditLimitCustom ? activeAssistantChat.creditLimit : 50,true);else setAssistantChatCreditLimit(Number(value),false);}}><option value="ask">Before every spend</option><option value="100">100 credits</option><option value="250">250 credits</option><option value="500">500 credits</option><option value="1000">1,000 credits</option><option value="2500">2,500 credits</option><option value="custom">Custom limit</option></select></label>{activeAssistantChat?.creditLimitCustom&&<label>Custom credit cap<input type="number" min="1" max="100000" step="1" value={activeAssistantChat.creditLimit ?? 50} onChange={event=>setAssistantChatCreditLimit(event.target.value,true)}/></label>}<small>{activeAssistantChat?.creditLimit == null ? "Credit-consuming actions wait for your approval." : `${Math.max(0,Number(activeAssistantChat.creditLimit)-Number(activeAssistantChat.creditUsed||0))} credits remain in this chat. Actions that may exceed the cap require approval.`}{Number(activeAssistantChat?.creditUsed||0)>0&&` · Up to ${activeAssistantChat.creditUsed} credits estimated so far.`}</small></details>}<label className="wm-chat-context"><span>Using context</span><select value={activeAssistantContextId} onChange={event=>selectAssistantContext(event.target.value)}>{assistantProducts.map(product=><option key={product.id} value={product.id}>{product.name}</option>)}</select><button type="button" className="wm-text-action" onClick={()=>{setSettingsTab("AI Context");onNavigate("Settings");}}>Edit contexts</button></label><div className={`wm-context-readiness ${assistantContextReady ? "ready" : "missing"}`}>{assistantContextReady ? <Check size={13}/> : <CircleHelp size={13}/>}<span role="status"><strong>{assistantContextReady ? "Ready for outreach drafts" : "Product context needed for drafts"}</strong><small>{assistantContextReady ? "Luna can use this for draft reviews." : "Add what you sell and who it helps."}</small></span>{!assistantContextReady && <button type="button" className="wm-text-action" onClick={()=>{setSettingsTab("AI Context");onNavigate("Settings");}}>Set up context</button>}</div><div className="wm-chat-history"><span>Recent chats</span>{[...assistantConversation.chats].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,5).map(chat=><button key={chat.id} className={chat.id===assistantConversation.activeId?"active":""} onClick={()=>setAssistantConversation(current=>({...current,activeId:chat.id}))}>{chat.title}</button>)}</div><div className="wm-chat-list" ref={assistantChatListRef}>{assistantConversationMessages.length ? assistantConversationMessages.map((message,index)=><div className={`wm-chat-message ${message.role}`} key={index}><span>{message.role==="assistant"?<Sparkles size={15}/>:"RB"}</span><p>{message.text}</p>{message.reportData&&<div className="wm-chat-reports">{message.reportData.map((report,reportIndex)=>{const max=Math.max(1,...report.items.map(item=>Number(item.value)||0));return <section className="wm-chat-report" key={`${report.title}-${reportIndex}`}><strong>{report.title}</strong><div>{report.items.map(item=><div className="wm-chat-report-row" key={item.label}><span>{item.label}</span><div className="wm-chat-report-track" role="img" aria-label={`${item.label}: ${item.display}`}><i style={{width:`${Math.max(0,Math.min(100,(Number(item.value)||0)/max*100))}%`}}/></div><small>{item.display}</small></div>)}</div></section>})}</div>}{message.nextSteps?.length>0&&<div className="wm-chat-next-steps"><strong>{message.nextStepsTitle||"Suggested next steps"}</strong>{message.nextSteps.map((step,stepIndex)=><button type="button" key={`${step.module}-${step.title}-${stepIndex}`} onClick={()=>openSuggestedFollowUp(step)}><span><b>{step.title}</b><small>{step.detail}</small></span><ChevronRight size={14}/></button>)}</div>}{message.reviewAction&&<div className="wm-action-review"><small>{message.reviewAction.type==="local-write"?message.reviewAction.label:message.reviewAction.type==="create-list-and-save"?"Create list and save prospect · local workspace":message.reviewAction.type==="save-to-list"?"Save prospect to list · local workspace":message.reviewAction.type==="create-company-list-and-save"?"Create company list and save account · local workspace":message.reviewAction.type==="save-company-to-list"?"Save account to company list · local workspace":"Enroll in sequence · local plan"}</small><strong>{message.reviewAction.type==="local-write"?message.reviewAction.summary:message.reviewAction.company?(message.reviewAction.type==="create-company-list-and-save"?`${message.reviewAction.company.name} → new company list “${message.reviewAction.targetName}”`:`${message.reviewAction.company.name} → ${message.reviewAction.targetName}`):(message.reviewAction.type==="create-list-and-save"?`${message.reviewAction.person.name} → new list “${message.reviewAction.targetName}”`:`${message.reviewAction.person.name} → ${message.reviewAction.targetName}`)}</strong>{["create-email-draft","create-email-drafts"].includes(message.reviewAction.operation)?<AssistantEmailDraftEditor emails={message.reviewAction.operation==="create-email-draft"?[message.reviewAction.email]:message.reviewAction.emails} disabled={message.reviewAction.status!=="pending"} claimsToAvoid={assistantContext.claimsToAvoid} onChange={(index,patch)=>updateAssistantReviewEmails(message.id,index,patch)}/>:message.reviewAction.operation==="create-sequence"?<AssistantSequenceDraftEditor sequence={message.reviewAction.sequence} onChange={stepPlan=>updateAssistantReviewSequence(message.id,stepPlan)}/>:message.reviewAction.operation==="update-sequence-step"?<AssistantSequenceOptimizationEditor action={message.reviewAction} onChange={stepPlan=>updateAssistantReviewStepPlan(message.id,stepPlan)}/>:message.reviewAction.preview&&<pre className="wm-action-preview">{message.reviewAction.preview}</pre>}{message.reviewAction.status==="pending"?<div><button type="button" className="wm-primary" disabled={["create-email-draft","create-email-drafts"].includes(message.reviewAction.operation) && emailDraftIssues(message.reviewAction.operation==="create-email-draft"?[message.reviewAction.email]:message.reviewAction.emails||[],assistantContext.claimsToAvoid).length>0} onClick={()=>applyAssistantReviewAction(message.id,message.reviewAction)}>Apply action</button><button type="button" className="wm-text-action" onClick={()=>cancelAssistantReviewAction(message.id,message.reviewAction)}>Cancel</button></div>:<span>{message.reviewAction.status==="applied"?"Applied":"No changes made"}</span>}</div>}{message.apolloAction&&<div className="wm-apollo-approval">{message.apolloAction.status==="pending"?<><small>{message.apolloAction.taskId?"Continue this Apollo Assistant conversation":"New Apollo Assistant task · credit use varies by action"}</small><div><button type="button" className="wm-primary" onClick={()=>runApolloAssistantAction(activeAssistantChat.id,message.id,message.apolloAction)}>Run in Apollo</button><button type="button" className="wm-text-action" onClick={()=>updateAssistantChat(activeAssistantChat.id,chat=>({...chat,messages:chat.messages.map(item=>item.id!==message.id?item:{...item,apolloAction:{...item.apolloAction,status:"cancelled"}})}))}>Cancel</button></div></>:message.apolloAction.status==="starting"?<span>Sending to Apollo…</span>:message.apolloAction.status==="error"?<span role="alert">{message.apolloAction.error} Check Apollo before retrying to avoid a duplicate task.</span>:message.apolloAction.status==="cancelled"?<span>Not sent to Apollo.</span>:<span>Sent to Apollo Assistant.</span>}</div>}{message.creditAction&&<div className="wm-credit-approval"><small>Estimated maximum · {message.creditAction.estimatedMaxCredits} credits</small>{message.creditAction.status==="approved"?<span>Approved · lookup started</span>:<button type="button" className="wm-primary" onClick={()=>approveAssistantCreditAction(message.creditAction)}>Approve and find email</button>}</div>}</div>) : <div className="wm-chat-empty">{apolloConfigured ? "Your next Apollo Assistant action starts here." : "Choose a suggestion or ask Luna about the sample workspace."}</div>}</div>{apolloConfigured&&activeAssistantChat?.apolloTaskStatus==="running"&&<small className="wm-apollo-status" role="status">Apollo Assistant is working. This page checks for updates every 10 seconds.</small>}{apolloConfigured&&activeAssistantChat?.apolloTaskStatus==="awaiting_input"&&<small className="wm-apollo-status" role="status">Apollo Assistant needs your reply. Send it below to continue the same conversation.</small>}{activeAssistantChat?.apolloPollError&&<small className="wm-apollo-status error" role="status">{activeAssistantChat.apolloPollError} Retrying automatically.</small>}<form className="wm-chat-form" onSubmit={sendAssistant}><textarea ref={assistantComposerRef} rows={1} aria-label="Ask Luna" value={assistantInput} onChange={event=>setAssistantInput(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.form?.requestSubmit();}}} disabled={apolloConfigured&&(activeAssistantChat?.apolloTaskStatus==="running"||assistantMessages.some(message=>["pending","starting"].includes(message.apolloAction?.status)))} placeholder="Ask about your sales workspace"/><button type="button" className={`wm-voice-button ${assistantVoiceListening ? "listening" : ""}`} aria-label={assistantVoiceListening ? "Stop voice input" : "Dictate prompt"} aria-pressed={assistantVoiceListening} title={assistantVoiceListening ? "Stop voice input" : "Add a spoken prompt"} onClick={toggleAssistantVoiceInput} disabled={apolloConfigured&&(activeAssistantChat?.apolloTaskStatus==="running"||assistantMessages.some(message=>["pending","starting"].includes(message.apolloAction?.status)))}>{assistantVoiceListening ? <MicOff size={15}/> : <Mic size={15}/>}</button><button className="wm-primary" aria-label="Send message" disabled={!assistantInput.trim()||apolloConfigured&&(activeAssistantChat?.apolloTaskStatus==="running"||assistantMessages.some(message=>["pending","starting"].includes(message.apolloAction?.status)))}><Send size={15}/></button></form>{assistantVoiceStatus&&<small className="wm-voice-status" role="status">{assistantVoiceStatus}</small>}<small className="wm-disclaimer"><span className="wm-disclaimer-full">{apolloConfigured?"Apollo connected · review each request; credit use follows your account.":"Demo only · no Apollo AI, live research, or sending."}</span><span className="wm-disclaimer-compact">{apolloConfigured?"Apollo connected · review each action.":"Demo mode · sample records only."}</span></small></>}</div>;
      case "Companies": return renderCompanies();
      case "Lists": return renderLists();
      case "Data enrichment": return renderEnrichment();
      case "Sequences": return renderSequences();
      case "Tasks": return renderTasks();
      case "Deals": return renderDeals();
      case "Meetings": return renderMeetings();
      case "Emails": return renderEmails();
      case "Calls": return renderCalls();
      case "Conversations": return renderConversations();
      case "Analytics": return renderAnalytics();
      case "Workflows": return renderWorkflows();
      case "Settings": return renderSettings();
      default: return renderHome();
    }
  };

  const dialogTitle = dialog === "edit-contact" ? "Edit local contact" : dialog === "add-to-list" ? module === "Companies" ? "Add accounts to a company list" : "Add prospects to a list" : dialog === "create" && module === "People" ? "Add a contact" : module === "Lists" ? `Create a ${listType === "Companies" ? "company" : "people"} list` : module === "Sequences" ? "Create a sequence" : module === "Tasks" ? "Add a task" : module === "Meetings" ? "Schedule meeting" : module === "Deals" ? "Create a deal" : module === "Workflows" ? "Create a workflow" : module === "Companies" ? "Add a company" : dialog === "compose" ? emailDraftEditing ? "Edit local draft" : "Compose email" : dialog === "log-call" ? "Log a call" : "Add prospects to a list";
  const showCreateFields = dialog === "create" || ["compose", "log-call", "add-to-list"].includes(dialog);
  const filterOptions = ["All records", "Active", "Needs attention", ...(module === "Tasks" ? ["Completed"] : [])];
  const workflowTargetOptions = workflowAction === "Add contact to a list" ? data.lists.filter(list => list.type === "People") : data.sequences;
  const sortOptions = ["Recently updated", "Name A–Z", "Name Z–A", ...(module === "Deals" ? ["Highest value"] : [])];
  return <div className="wm-page">
    {!["Home", "Assistant", "Settings", "Analytics"].includes(module) && <div className="wm-toolbar" ref={toolbarRef}><div className="wm-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={`Search ${title.toLowerCase()}...`}/></div><div className="wm-menu-anchor"><button className="wm-outline" aria-expanded={filterOpen} onClick={()=>{setFilterOpen(value=>!value);setSortOpen(false);}}><Filter size={14}/>{filterValue === "All records" ? "Filters" : filterValue}<ChevronDown size={13}/></button>{filterOpen&&<div className="wm-menu">{filterOptions.map(option=><button className={filterValue===option?"selected":""} key={option} onClick={()=>{setFilterValue(option);setFilterOpen(false);}}>{option}{filterValue===option&&<Check size={13}/>}</button>)}</div>}</div><div className="wm-menu-anchor"><button className="wm-outline" aria-expanded={sortOpen} onClick={()=>{setSortOpen(value=>!value);setFilterOpen(false);}}>{sortOrder}<ChevronDown size={13}/></button>{sortOpen&&<div className="wm-menu">{sortOptions.map(option=><button className={sortOrder===option?"selected":""} key={option} onClick={()=>{setSortOrder(option);setSortOpen(false);}}>{option}{sortOrder===option&&<Check size={13}/>}</button>)}</div>}</div>{["Companies", "Lists", "Sequences", "Tasks", "Deals", "Meetings", "Emails", "Calls", "Conversations", "Workflows", "Data enrichment"].includes(module) && <button type="button" className="wm-outline wm-export-button" onClick={exportCurrentModuleCsv} title={selectedRows.length ? `Export ${selectedRows.length} selected matching records` : "Export current matching records"}><Download size={14}/>{selectedRows.length ? `Export ${selectedRows.length}` : "Export CSV"}</button>}<span className="wm-toolbar-count">{selectedRows.length ? `${selectedRows.length} selected` : ""}</span></div>}
    <div className={`wm-content ${module === "Home" ? "home" : ""} ${module === "Assistant" ? "assistant" : ""}`}>{renderModule()}</div>
    <button className="wm-help" aria-label="Help center" onClick={onHelp}><CircleHelp size={23}/></button>
    {dialog && <div className="wm-modal-backdrop" onClick={closeDialog}><form className={`wm-modal${dialog === "edit-contact" || (dialog === "create" && module === "People") ? " wm-contact-form-modal" : ""}`} onSubmit={handleDialogSubmit} onClick={event=>event.stopPropagation()}><header><div><h2>{dialogTitle}</h2><p>{dialog==="edit-contact"?"Updates this browser record and keeps its linked lists and activity. A changed email is not marked verified.":dialog==="compose"?"Local draft only. Saving will not send it.":dialog==="log-call"?"Record this call in your local workspace; no call will be placed.":"Saved in this local demo workspace."}</p></div><button type="button" onClick={closeDialog} aria-label="Close"><X size={17}/></button></header>{dialog==="add-to-list"?<>{module!=="Companies"&&<label>Prospect name<input autoFocus value={formName} onChange={event=>setFormName(event.target.value)} placeholder={selectedRows.length ? `${selectedRows.length} selected · add another name (optional)` : "Select people or enter a name"}/></label>}<label>Destination list<select value={formDetail} onChange={event=>setFormDetail(event.target.value)}>{data.lists.filter(list=>list.type===(module==="Companies"?"Companies":"People")).map(list=><option key={list.name} value={list.name}>{list.name}</option>)}</select></label><small className="wm-modal-hint">{selectedRows.length ? `${selectedRows.length} selected ${module==="Companies"?"accounts":"people"} will be added.` : "Select people in the table, or enter one name above."}</small></>:dialog==="log-call"?<><label>Contact<select autoFocus required value={formName} onChange={event=>setFormName(event.target.value)}><option value="">Choose a contact</option>{workspacePeople.map(person=><option key={person.id||person.name} value={person.name}>{person.name} · {person.company}</option>)}</select></label><label>Outcome<select value={formDetail} onChange={event=>setFormDetail(event.target.value)}>{["Connected","No answer","Left voicemail","Busy","Wrong number"].map(outcome=><option key={outcome}>{outcome}</option>)}</select></label><label>Call notes<textarea value={formBody} onChange={event=>setFormBody(event.target.value)} placeholder="Add the conversation summary or agreed next step..." rows={4}/></label><small className="wm-modal-hint">Saved activity only; this does not place a phone call.</small></>:dialog==="create"&&module==="Lists"?<><label>List name<input autoFocus value={formName} onChange={event=>setFormName(event.target.value)} placeholder={listType==="Companies"?"Strategic accounts":"Priority prospects"}/></label><label>Description<input value={formDetail} onChange={event=>setFormDetail(event.target.value)} placeholder={listType==="Companies"?"Accounts to prioritize":"People to reach"}/></label><label>List type<select value={listType} onChange={event=>setListType(event.target.value)}><option>People</option><option>Companies</option></select></label></>:dialog==="create"&&module==="Companies"?<><label>Company name<input autoFocus value={formName} onChange={event=>setFormName(event.target.value)} placeholder="Acme, Inc." required/></label><div className="wm-form-row"><label>Website or domain<input value={companyDomain} onChange={event=>setCompanyDomain(event.target.value)} placeholder="acme.com"/></label><label>Industry<input value={companyIndustry} onChange={event=>setCompanyIndustry(event.target.value)} placeholder="Software"/></label></div><div className="wm-form-row"><label>Employees<input type="number" min="0" value={companyEmployees} onChange={event=>setCompanyEmployees(event.target.value)} placeholder="250"/></label><label>Headquarters<input value={companyLocation} onChange={event=>setCompanyLocation(event.target.value)} placeholder="City, State"/></label></div><label>Account status<select value={companyStatus} onChange={event=>setCompanyStatus(event.target.value)}>{["Target","Working","New"].map(status=><option key={status}>{status}</option>)}</select></label><small className="wm-modal-hint">This company record is stored in this browser and is available when creating contacts and deals.</small></>:dialog==="create"&&module==="People"?<><label>Full name<input autoFocus value={formName} onChange={event=>setFormName(event.target.value)} placeholder="Taylor Morgan" required/></label><label>Job title<input value={contactTitle} onChange={event=>setContactTitle(event.target.value)} placeholder="VP of Sales"/></label><label>Company<input value={contactCompany} onChange={event=>setContactCompany(event.target.value)} placeholder="Company name"/></label><div className="wm-form-row"><label>Email<input type="email" value={contactEmail} onChange={event=>setContactEmail(event.target.value)} placeholder="taylor@company.com"/></label><label>Location<input value={contactLocation} onChange={event=>setContactLocation(event.target.value)} placeholder="City, State"/></label></div><div className="wm-form-row"><label>Phone<input type="tel" value={contactPhone} onChange={event=>setContactPhone(event.target.value)} placeholder="+1 415 555 0138"/></label><label>LinkedIn<input value={contactLinkedIn} onChange={event=>setContactLinkedIn(event.target.value)} placeholder="linkedin.com/in/taylor-morgan"/></label></div><small className="wm-modal-hint">Saved in this browser and shared with People, Companies, Lists, and Data enrichment.</small></>:dialog==="edit-contact"?<><label>Full name<input autoFocus value={formName} onChange={event=>setFormName(event.target.value)} placeholder="Taylor Morgan" required/></label><label>Job title<input value={contactTitle} onChange={event=>setContactTitle(event.target.value)} placeholder="VP of Sales"/></label><label>Company<input value={contactCompany} onChange={event=>setContactCompany(event.target.value)} placeholder="Company name"/></label><div className="wm-form-row"><label>Email<input type="email" value={contactEmail} onChange={event=>setContactEmail(event.target.value)} placeholder="taylor@company.com"/></label><label>Location<input value={contactLocation} onChange={event=>setContactLocation(event.target.value)} placeholder="City, State"/></label></div><div className="wm-form-row"><label>Phone<input type="tel" value={contactPhone} onChange={event=>setContactPhone(event.target.value)} placeholder="+1 415 555 0138"/></label><label>LinkedIn<input value={contactLinkedIn} onChange={event=>setContactLinkedIn(event.target.value)} placeholder="linkedin.com/in/taylor-morgan"/></label></div><small className="wm-modal-hint">This edits the local copy only. Linked lists, sequence plans, tasks, meetings, and calls keep their contact link. If the email changes, linked local drafts using the old or no address are marked for review; nothing is sent.</small></>:dialog==="create"&&module==="Tasks"?<><label>Task title<input autoFocus value={formName} onChange={event=>setFormName(event.target.value)} placeholder="Follow up with a prospect"/></label><label>Contact<select value={formDetail} onChange={event=>setFormDetail(event.target.value)}><option value="">Unassigned</option>{[...new Map([...people,...data.savedPeople].map(person=>[person.name,person])).values()].map(person=><option value={person.name} key={person.name}>{person.name} · {person.company}</option>)}</select></label><div className="wm-form-row"><label>Due date<input type="date" value={taskDueDate} onChange={event=>setTaskDueDate(event.target.value)}/></label><label>Task type<select value={taskType} onChange={event=>setTaskType(event.target.value)}>{["Follow-up","Email","Call","Research","Meeting prep","Other"].map(type=><option key={type}>{type}</option>)}</select></label></div></>:dialog==="create"&&module==="Deals"?<><label>Deal name<input autoFocus value={formName} onChange={event=>setFormName(event.target.value)} placeholder="Enterprise expansion"/></label><label>Company<select value={formDetail} onChange={event=>setFormDetail(event.target.value)}>{[...new Set([...data.companies.map(company=>company.name),...data.deals.map(deal=>deal.company)].filter(Boolean))].map(company=><option key={company}>{company}</option>)}</select></label><label>Deal value<input type="number" min="0.01" step="1000" value={dealAmount} onChange={event=>setDealAmount(event.target.value)} placeholder="25000"/></label><label>Stage<select value={dealStageValue} onChange={event=>setDealStageValue(event.target.value)}>{stages.map(stage=><option key={stage}>{stage}</option>)}</select></label><div className="wm-form-row"><label>Expected close<input type="date" value={dealCloseDate} onChange={event=>setDealCloseDate(event.target.value)}/></label><label>Owner<select value={dealOwner} onChange={event=>setDealOwner(event.target.value)}>{[...new Set(["Robert Berry",...data.deals.map(deal=>deal.owner).filter(Boolean)])].map(owner=><option key={owner}>{owner}</option>)}</select></label></div></>:dialog==="create"&&module==="Workflows"?<><label>Workflow name<input autoFocus value={formName} onChange={event=>setFormName(event.target.value)} placeholder="Create a follow-up when a prospect is added"/></label><label>When this happens<select value={formTrigger} onChange={event=>setFormTrigger(event.target.value)}>{["Contact added to list","Deal stage changed","Task completed","Meeting marked no-show"].map(trigger=><option key={trigger}>{trigger}</option>)}</select></label><label>Then do this<select value={workflowAction} onChange={event=>{const action=event.target.value;setWorkflowAction(action);if(action!=="Create follow-up task")setWorkflowTarget(action==="Add contact to a list"?data.lists.find(list=>list.type==="People")?.name||"":data.sequences[0]?.name||"");}}>{["Create follow-up task","Add contact to a list","Enroll contact in a sequence"].map(action=><option key={action}>{action}</option>)}</select></label>{workflowAction==="Create follow-up task"?<><label>Task title<input value={formDetail} onChange={event=>setFormDetail(event.target.value)} placeholder="Follow up with {{contact}}"/></label><small className="wm-modal-hint">Use contact, company, list, deal, stage, or task placeholder names in the title. This creates local tasks only.</small><label>Task due<select value={workflowTaskDue} onChange={event=>setWorkflowTaskDue(event.target.value)}>{["Today","Tomorrow"].map(due=><option key={due}>{due}</option>)}</select></label></>:<label>{workflowAction==="Add contact to a list"?"Destination list":"Sequence"}<select value={workflowTarget} onChange={event=>setWorkflowTarget(event.target.value)}><option value="">Choose a {workflowAction==="Add contact to a list"?"list":"sequence"}</option>{workflowTargetOptions.map(target=><option key={target.name} value={target.name}>{target.name}</option>)}</select></label>}<small className="wm-modal-hint">Active workflows apply these actions to matching local workspace events. They do not send outreach.</small></>:dialog==="create"&&module==="Sequences"?<><label>Sequence name<input autoFocus value={formName} onChange={event=>setFormName(event.target.value)} placeholder="New outbound sequence"/></label><div className="wm-sequence-editor"><div className="wm-sequence-editor-heading"><strong>Steps · {sequenceSteps.length}</strong><small>Plan the outreach cadence for this sequence.</small></div>{sequenceSteps.map((step,index)=><article className="wm-sequence-step" key={index}><header><strong>Step {index+1}</strong><button type="button" className="wm-text-action" disabled={sequenceSteps.length<=1} onClick={()=>setSequenceSteps(current=>current.filter((_,stepIndex)=>stepIndex!==index))}>Remove</button></header><div className="wm-form-row"><label>Channel<select value={step.channel} onChange={event=>setSequenceSteps(current=>current.map((item,stepIndex)=>stepIndex===index?{...item,channel:event.target.value}:item))}>{["Email","Call","LinkedIn","Task"].map(channel=><option key={channel}>{channel}</option>)}</select></label><label>Timing<input value={step.delay} onChange={event=>setSequenceSteps(current=>current.map((item,stepIndex)=>stepIndex===index?{...item,delay:event.target.value}:item))} placeholder="Wait 2 days"/></label></div><label>Action<input value={step.instruction} onChange={event=>setSequenceSteps(current=>current.map((item,stepIndex)=>stepIndex===index?{...item,instruction:event.target.value}:item))} placeholder="Describe this step"/></label></article>)}<button type="button" className="wm-outline wm-add-sequence-step" onClick={()=>setSequenceSteps(current=>[...current,{channel:"Email",delay:"Wait 3 days",instruction:"Follow up with a helpful resource"}])}><Plus size={14}/>Add step</button><small className="wm-modal-hint">Local sequence plan only. Emails and calls are not sent automatically.</small></div></>:dialog==="create"&&module==="Meetings"?<><label>Meeting title<input autoFocus value={formName} onChange={event=>setFormName(event.target.value)} placeholder="Discovery call"/></label><label>Contact<select value={formDetail} onChange={event=>setFormDetail(event.target.value)}><option value="">No linked contact</option>{[...new Map([...people,...data.savedPeople].map(person=>[person.name,person])).values()].map(person=><option value={person.name} key={person.name}>{person.name} · {person.company}</option>)}</select></label><div className="wm-form-row"><label>Date<input type="date" value={meetingStart.date} onChange={event=>setMeetingStart(current=>({...current,date:event.target.value}))}/></label><label>Time<input type="time" value={meetingStart.time} onChange={event=>setMeetingStart(current=>({...current,time:event.target.value}))}/></label></div><label>Duration<select value={meetingDuration} onChange={event=>setMeetingDuration(event.target.value)}>{[15,25,30,45,60].map(minutes=><option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label></>:showCreateFields&&<><label>{dialog==="compose"?"To":dialog==="log-call"?"Contact":"Name"}<input autoFocus value={formName} onChange={event=>setFormName(event.target.value)} placeholder={dialog==="compose"?"name@company.com":dialog==="log-call"?"Choose a contact":"Enter a name"}/></label>{dialog==="compose"&&composeEmailRecipientIssue&&<small className="wm-email-recipient-review" role="status">{emailRecipientReviewMessage({to:formName,recipientNeedsReview:true,recipientReviewReason:composeEmailRecipientIssue})}</small>}<label>{dialog==="compose"?"Subject":dialog==="log-call"?"Outcome":"Details"}<input value={formDetail} onChange={event=>setFormDetail(event.target.value)} placeholder={dialog==="compose"?"Email subject":"Optional details"}/></label>{dialog==="compose"&&<label>Message<textarea value={formBody} onChange={event=>setFormBody(event.target.value)} placeholder="Write your message..." rows={4}/></label>}</>}<footer><button type="button" className="wm-outline" onClick={closeDialog}>Cancel</button><button className="wm-primary" disabled={dialog==="add-to-list" ? (!selectedRows.length&&!formName.trim()) || !formDetail : dialog==="edit-contact" ? !formName.trim() : dialog==="create"&&module==="Deals" ? !formName.trim() || !formDetail || !dealAmount || Number(dealAmount)<=0 || !dealCloseDate : dialog==="create"&&module==="Workflows" ? !formName.trim() || (workflowAction!=="Create follow-up task"&&!workflowTarget) : showCreateFields&&!formName.trim()&&dialog!=="compose"}>{dialog==="compose"?"Save draft":dialog==="log-call"?"Save call":dialog==="add-to-list"?"Add to list":dialog==="create"&&module==="Workflows"?"Create workflow":dialog==="create"&&module==="Deals"?"Create deal":dialog==="create"&&module==="Tasks"?"Create task":dialog==="create"&&module==="Companies"?"Add company":dialog==="edit-contact"?"Save contact":dialog==="create"&&module==="People"?"Add contact":"Create"}</button></footer></form></div>}
    {selected && <div className="wm-modal-backdrop" onClick={()=>setSelected(null)}><section className="wm-detail-drawer" role="dialog" aria-modal="true" aria-label="Record details" onClick={event=>event.stopPropagation()}><header><div><span className="wm-eyebrow">Record details</span><h2>{selected.name||selected.title||selected.subject||selected.person}</h2></div><button onClick={()=>setSelected(null)} aria-label="Close"><X size={17}/></button></header>{selected.folder==="Drafts"&&<div className={`wm-email-draft-status${selected.recipientNeedsReview?" needs-review":""}`}><Mail size={14}/><span>{emailSourceLabel(selected)} · not sent{selected.recipientNeedsReview?" · review recipient":""}</span></div>}<div className="wm-detail-body"><WorkspaceRecordDetails record={selected} data={data} contacts={workspacePeople} onOpen={openRelatedRecord}/>{selected.customFields&&Object.keys(selected.customFields).length>0&&<div className="wm-detail-summary"><small>Custom fields</small>{Object.entries(selected.customFields).map(([field,value])=><p key={field}><strong>{field}:</strong> {String(value)}</p>)}</div>}{Array.isArray(selected.steps)&&<div className="wm-sequence-plan"><small>Workflow actions · {selected.steps.length} steps</small>{selected.steps.map((step,index)=><article key={`${step.action}-${index}`}><Pill>{index+1} · {step.action}</Pill><span><strong>{step.targetName||step.taskTitle||step.action}</strong>{step.due&&<small>Due {step.due}</small>}</span></article>)}</div>}{Array.isArray(selected.stepPlan)&&<div className="wm-sequence-plan"><small>Sequence plan · {selected.stepPlan.length} steps</small>{selected.stepPlan.map((step,index)=><article key={`${step.channel}-${index}`}><Pill>{index+1} · {step.channel}</Pill><span><strong>{step.instruction}</strong><small>{step.delay}</small>{step.body&&<small className="wm-sequence-email-copy">{step.body}</small>}</span></article>)}</div>}{Array.isArray(selected.stepPlan)&&<WorkspaceListMembers key={`sequence-${selected.name}`} list={{ name: selected.name, type: "People", members: selected.enrolledPeople || [] }} contacts={workspacePeople} companies={data.companies} onOpen={openRelatedRecord} title="Local enrolled contacts" emptyMessage="No contacts enrolled in this browser yet. Choose prospects to review an enrollment with Luna."/>}{Array.isArray(selected.members)&&<WorkspaceListMembers key={`list-${selected.type}-${selected.name}`} list={selected} contacts={workspacePeople} companies={data.companies} onOpen={openRelatedRecord} onRemove={removeListMember}/>}</div><footer>{!(selected.name&&selected.company&&(selected.title||selected.role||selected.email))&&<button className="wm-outline" onClick={()=>setSelected(null)}>Close</button>}{Array.isArray(selected.members)?<><button className="wm-outline" disabled={!uniqueListMembers(selected).length} onClick={()=>openAssistantWithPrompt(`Export the ${selected.type === "Companies" ? "company" : "People"} list “${selected.name}” as CSV. Include only records that are currently members of this list.`)}><Download size={14}/>Export list</button><button className="wm-primary" disabled={!uniqueListMembers(selected).length} onClick={()=>openAssistantWithPrompt(selected.type === "Companies" ? `Research accounts in the company list “${selected.name}” and show each account overview for review before saving. Use only available records and identify missing information.` : `Draft personalized emails for the contacts on the People list “${selected.name}”. Use my saved company and product context. Show each draft for review before saving; do not send.`)}><Sparkles size={14}/>{selected.type === "Companies" ? "Research with Luna" : "Draft with Luna"}</button>{selected.type !== "Companies" && <button className="wm-outline" disabled={!uniqueListMembers(selected).length || !data.sequences.length} onClick={()=>setEnrollmentRequest({sourceListName:selected.name})}><Workflow size={14}/>Enroll members</button>}</>:Array.isArray(selected.stepPlan)?<button className="wm-primary" onClick={()=>setEnrollmentRequest({sequenceName:selected.name})}><Users size={14}/>Choose prospects</button> :selected.domain&&selected.industry&&selected.name&&!selected.company?<><button className="wm-outline" onClick={()=>openAssistantWithPrompt(`Research ${selected.name}${selected.domain?` (${selected.domain})`:""} using Apollo account data and available web research. Summarize recent funding, hiring, growth signals, and likely buying priorities. Separate verified facts from estimates and ask before saving research to this account.`)}><Sparkles size={14}/>Research with AI</button><button className="wm-primary" onClick={()=>{setSelected(null);onFindCompanyPeople?.(selected);}}>Find people</button></>:selected.stage&&selected.company&&selected.name&&selected.amount!=null?<button className="wm-primary" onClick={()=>openAssistantWithPrompt(`Review the Apollo deal “${selected.name}” for ${selected.company}. Saved deal context: stage ${selected.stage}, value ${fmtMoney(selected.amount)}, expected close ${selected.close||"not recorded"}, owner ${selected.owner||"not recorded"}. Use available contact, meeting, and conversation records to identify evidence-backed risks, missing information, and one recommended next step. Separate saved facts from assumptions; do not change the deal or create tasks without my review.`)}><Sparkles size={14}/>Review deal with AI</button>:selected.name&&selected.company&&(selected.title||selected.role||selected.email||selected.phone||selected.linkedinUrl)?<>{selected.source === "local" && <button type="button" className="wm-outline" onClick={()=>openContactEditor(selected)}><Pencil size={14}/>Edit contact</button>}<button className="wm-outline" onClick={()=>openAssistantWithPrompt(`Research ${selected.name}${usableContactRole(selected) ? `, ${usableContactRole(selected)}` : ""}${usableContactCompany(selected) ? ` at ${usableContactCompany(selected)}` : ""}. Use Apollo account context and available research. Separate verified facts from assumptions and ask before saving any notes.`)}><Sparkles size={14}/>Research with AI</button><button className="wm-outline" onClick={()=>openAssistantWithPrompt(`Draft a personalized email to ${selected.name}${usableContactCompany(selected) ? ` at ${usableContactCompany(selected)}` : ""}${usableContactRole(selected) ? `, their role is ${usableContactRole(selected)}` : ""}. Use saved company and product context, keep claims factual, and show the subject and email for review. Save as a draft only; do not send.`)}><Mail size={14}/>Draft email</button>{normalizeLinkedInUrl(selected.linkedinUrl) && <button className="wm-outline" onClick={()=>openAssistantWithPrompt(`Draft a personalized LinkedIn message for ${selected.name}${usableContactCompany(selected) ? ` at ${usableContactCompany(selected)}` : ""}${usableContactRole(selected) ? `, their role is ${usableContactRole(selected)}` : ""}. Saved profile URL: ${normalizeLinkedInUrl(selected.linkedinUrl)}. Use only saved company and product context; do not claim you reviewed the profile or know recent activity. Keep claims factual and show one draft for my review. Do not send or update any connected account.`)}><Users size={14}/>Draft LinkedIn note</button>}<button className="wm-primary" onClick={()=>openAssistantWithPrompt(`Create a follow-up task for ${selected.name}. Suggest a clear next action and due date, then show the task for review before applying.`)}>Create task</button><button className="wm-outline" onClick={()=>{setFormName(selected.name);setFormDetail("Connected");setFormBody("");setSelected(null);setDialog("log-call");}}><Phone size={14}/>Log call</button><button className="wm-outline" disabled={!data.sequences.length} onClick={()=>setEnrollmentRequest({contactNames:[selected.name]})}><Workflow size={14}/>Enroll in sequence</button></>:selected.summary&&selected.person&&selected.date&&selected.title?<><button className="wm-outline" onClick={()=>openAssistantWithPrompt(`Summarize the saved Apollo call “${selected.title}” with ${selected.person}. Use only its saved summary and available record context. Pull out stated needs, objections, commitments, and next steps; label anything missing instead of inferring it.`)}><Sparkles size={14}/>Summarize with AI</button><button className="wm-primary" onClick={()=>openAssistantWithPrompt(`Create a follow-up task from ${selected.person}’s call “${selected.title}”. Use the saved summary as the source, suggest the next action and due date, and show it for review before applying.`)}>Create follow-up task</button></> :selected.outcome&&selected.note&&selected.company&&selected.time?<><button className="wm-outline" onClick={()=>openAssistantWithPrompt(`Summarize this saved Apollo call log with ${selected.person} at ${selected.company} on ${selected.time}. Use its saved note and outcome, identify stated next steps and missing details, and do not invent transcript content.`)}><Sparkles size={14}/>Summarize with AI</button><button className="wm-primary" onClick={()=>openAssistantWithPrompt(`Create a follow-up task from ${selected.person}’s saved call log at ${selected.time}. Use its saved note and outcome as the source, suggest a grounded next action and due date, and show it for review before applying.`)}>Create follow-up task</button></>:selected.title&&selected.person&&selected.duration&&selected.type&&selected.time?<><button className="wm-outline" onClick={()=>openAssistantWithPrompt(`Prepare me for ${selected.title} with ${selected.person} at ${selected.time}. Review the saved account, contact, deal, and call context; summarize meeting goals, likely priorities, and useful questions. Separate known facts from assumptions and ask before creating tasks or updating records.`)}><Sparkles size={14}/>Prepare with AI</button><button className="wm-primary" disabled={selected.status==="No-show"} onClick={()=>{const company=workspacePeople.find(person=>person.name===selected.person)?.company||"";setData(current=>{const meetings=current.meetings.map(meeting=>meeting.title===selected.title&&meeting.person===selected.person?{...meeting,status:"No-show",past:true}:meeting);return applyWorkflowEvent({...current,meetings},"Meeting marked no-show",[{contact:selected.person,company,meeting:selected.title}]);});setSelected(current=>({...current,status:"No-show",past:true}));notify("Meeting marked no-show; active local workflows were checked");}}>{selected.status==="No-show"?"No-show recorded":"Mark no-show"}</button></>:selected.trigger?<button className="wm-primary" onClick={()=>{const status=selected.status==="Active"?"Paused":"Active";setData(current=>({...current,workflows:current.workflows.map(workflow=>workflow.name===selected.name?{...workflow,status}:workflow)}));setSelected(current=>({...current,status}));notify(`${selected.name} ${status.toLowerCase()}`);}}>{selected.status==="Active"?"Pause workflow":"Activate workflow"}</button>:typeof selected.done==="boolean"?<button className="wm-primary" onClick={()=>{setTaskCompletion(selected,!selected.done);setSelected(null);notify(selected.done?"Task reopened":"Task marked complete");}}>{selected.done?"Reopen task":"Mark complete"}</button>:selected.folder==="Drafts"?<button className="wm-primary" onClick={openSelectedEmailDraft}><Mail size={14}/>Edit draft</button>:<button className="wm-primary" onClick={()=>{const contact=selected.person||(selected.title?selected.name:null)||selected.company||selected.from||selected.name||"this account";const taskTitle=`Follow up with ${contact}`;setData(current=>({...current,tasks:[{title:taskTitle,person:contact,due:"Today",type:"Follow-up",done:false,source:"local"},...current.tasks]}));setSelected(null);notify(`Follow-up task added for ${contact}`);}}>Add next step</button>}</footer></section></div>}
    {enrollmentRequest && <SequenceEnrollmentPicker sequences={data.sequences} contacts={workspacePeople} savedPeople={data.savedPeople} lists={data.lists} sequenceName={enrollmentRequest.sequenceName} sourceListName={enrollmentRequest.sourceListName} preselectedNames={enrollmentRequest.contactNames || []} onClose={()=>setEnrollmentRequest(null)} onReview={(sequence, contacts, sourceListName)=>{const prompt = enrollmentPrompt(sequence, contacts, sourceListName);setEnrollmentRequest(null);openAssistantWithPrompt(prompt,{kind:"sequence-enrollment",sequenceName:sequence.name,contactNames:contacts.map(person=>person.name),sourceListName});}}/>}
  </div>;
}
