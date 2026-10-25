import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { applyWorkflowEvent } from "./workflowEvents.js";
import { CommandSearch } from "./CommandSearch.jsx";
import { readWorkspaceSnapshot, workspaceRecordKey } from "./workspaceExperience.js";
import { useDialogFocus } from "./useWorkspaceUX.js";
import { contactPhoneHref, normalizeLinkedInUrl } from "./contactUtils.js";
import { demoProspects as sampleProspects, demoWorkspaceLists, isPlaceholderEmail } from "./demoData.js";
import {
  Activity, ArrowDownUp, Bell, BriefcaseBusiness, Building2, CalendarDays, Download,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardList,
  Clock3, ContactRound, Database, FileUp, Filter, Folder,
  Home, LayoutGrid, ListFilter, LockKeyhole, Mail, MapPin, Menu,
  PanelLeftClose, Phone, Plus, Search, Settings, SlidersHorizontal,
  Sparkles, Star, Users, Workflow, Wrench, X, Zap, DollarSign, ShieldCheck, UserRound,
} from "lucide-react";

const WorkspaceModules = lazy(() => import("./WorkspaceModules.jsx").then(module => ({ default: module.WorkspaceModules })));

const navGroups = [
  { title: "Prospect and enrich", icon: Search, items: [["People", Users, "/people"], ["Companies", Building2, "/companies"], ["Lists", ListFilter, "/lists"], ["Data enrichment", Database, "/enrichment-status/data-health-center"]] },
  { title: "Engage", icon: Workflow, items: [["Sequences", Workflow, "/sequences"], ["Emails", Mail, "/emails"], ["Calls", Phone, "/phone-calls"], ["Tasks", ClipboardList, "/tasks"]] },
  { title: "Win deals", icon: DollarSign, items: [["Meetings", CalendarDays, "/meetings"], ["Conversations", ContactRound, "/conversations/recordings"], ["Deals", BriefcaseBusiness, "/opportunities?"]] },
  { title: "Tools and automation", icon: Wrench, items: [["Workflows", Workflow, "/plays"], ["Analytics", Activity, "/analytics"]] },
];

function moduleFromHash() {
  const path = (typeof window === "undefined" ? "#/people" : window.location.hash).replace(/^#\/?/, "").split("?")[0];
  if (!path) return "Home";
  if (path === "people") return "People";
  if (path === "home") return "Home";
  if (path === "assistant") return "Assistant";
  if (path.startsWith("settings")) return "Settings";
  const item = navGroups.flatMap(group => group.items.map(([label, , route]) => [label, route.replace(/^\//, "").split("?")[0]])).find(([, route]) => route === path);
  return item?.[0] || "People";
}

function navKeyForModule(module) {
  return navGroups.flatMap(({ title, items }) => items.map(([label], index) => [label, `${title}-${label}-${index}`])).find(([label]) => label === module)?.[1] || (module === "Home" || module === "Assistant" || module === "Settings" ? module : "Prospect and enrich-People-0");
}

const quickFilters = [
  { label: "Locations", items: ["United States", "Canada"] },
  { label: "Email Status", items: ["Verified", "Unverified", "Unavailable"] },
  { label: "Job Titles", items: ["founder", "sales manager", "marketing director"] },
  { label: "Industry", items: ["Information Technology & Services", "Marketing & Advertising", "Retail"] },
];
const emailStatusQuickFilters = new Set(["Verified", "Unverified", "Unavailable"]);

const contactResearchTemplates = [
  {
    id: "background",
    name: "Summarize professional background",
    description: "Create a concise overview of each contact’s experience and likely focus areas.",
    field: "Professional background summary",
    prompt: "For each selected contact, summarize their professional background, current responsibilities, likely areas of influence, and relevant career context. Use only information Apollo can access, distinguish verified facts from inference, and cite the source or profile detail for each key point.",
  },
  {
    id: "decision-maker",
    name: "Confirm decision-maker",
    description: "Assess whether each person is likely to influence or own this purchase.",
    field: "Decision-maker assessment",
    prompt: "For each selected contact, assess whether they are likely to be a decision-maker, champion, evaluator, or unlikely buyer for the purchase context I provide. Explain the evidence, label uncertainty, and ask me for the product and buying context if it is missing.",
  },
  {
    id: "company-news",
    name: "Summarize company news",
    description: "Find recent company developments that could inform outreach.",
    field: "Company news summary",
    prompt: "For each selected contact, summarize recent, relevant developments at their current company that could inform a thoughtful sales conversation. Include source links and dates when available, separate facts from implications, and say when recent information cannot be verified.",
  },
  {
    id: "account-summary",
    name: "Create a sales-focused account summary",
    description: "Connect company context, contact role, and potential outreach angles.",
    field: "Sales-focused account summary",
    prompt: "For each selected contact, create a sales-focused account summary connecting the company’s business context to the contact’s role. Identify plausible business priorities and a relevant outreach angle, label all inferences, and include source links for factual claims.",
  },
  {
    id: "personalization",
    name: "Find a personalization angle",
    description: "Draft a specific, evidence-based reason to start a conversation.",
    field: "Personalization angle",
    prompt: "For each selected contact, find one specific, evidence-based personalization angle for a first-touch sales message. Use a relevant professional or company signal, provide its source and date, avoid personal or sensitive details, and do not write or send the message yet.",
  },
];

const globalQuickLinks = ["Home", "AI Assistant", "Find people", "Companies", "Lists", "Data enrichment", "Sequences", "Emails", "Calls", "Tasks", "Meetings", "Conversations", "Deals", "Workflows", "Analytics", "Settings"];
const managementLevels = ["Owner", "C-suite", "VP", "Director", "Manager", "Senior", "Entry", "Intern"];
const departments = ["Sales", "Marketing", "Engineering", "Operations", "Finance", "Human Resources"];
const managementPatterns = {
  Owner: /founder|co-founder|owner|proprietor/i,
  "C-suite": /chief|\bceo\b|\bcto\b|\bcfo\b|\bcoo\b|\bcmo\b|president/i,
  VP: /\bvp\b|vice president/i,
  Director: /director/i,
  Manager: /manager/i,
  Senior: /\bsenior\b|\bhead of\b|\blead\b/i,
  Entry: /\bassociate\b|\bjunior\b|\bentry\b/i,
  Intern: /intern/i,
};
const departmentPatterns = {
  Sales: /sales|revenue|business development|account executive/i,
  Marketing: /marketing|growth|demand generation/i,
  Engineering: /engineering|engineer|developer|software/i,
  Operations: /operations|operational/i,
  Finance: /finance|accounting|controller/i,
  "Human Resources": /human resources|\bhr\b|people operations/i,
};
const similarTitleVariants = {
  founder: ["founder", "co-founder", "owner", "ceo", "chief executive officer"],
  owner: ["owner", "founder", "co-founder", "ceo"],
  ceo: ["ceo", "chief executive officer", "founder", "owner"],
  "sales manager": ["sales manager", "sales director", "vp of sales", "vice president of sales", "head of sales"],
  "vp of sales": ["vp of sales", "vice president of sales", "sales director", "head of sales"],
  "marketing director": ["marketing director", "vp of marketing", "vice president of marketing", "head of marketing"],
};

const filterCategories = [
  { name: "Person Info", count: 22, icon: UserRound, items: ["Job Titles", "Management Level", "Departments & Job Function", "Location", "Email Status", "Seniority", "Name", "Contact Details", "Time in Current Role", "Person Lookalikes"] },
  { name: "Company Info", count: 27, icon: Building2, items: ["Company", "Company Size", "Industry", "Keywords", "Revenue", "Technologies", "Hiring", "Funding", "Company Location", "Company Lookalikes", "Number of Locations"] },
  { name: "Engagement Activity", count: 8, icon: Activity, items: ["Email opens", "Email clicks", "Email replies", "Calls", "Meetings", "Tasks", "Sequence status", "Last contacted"] },
  { name: "Conversation", count: 6, icon: Phone, items: ["Call outcome", "Call date", "Meeting outcome", "Conversation topics", "Talk ratio", "Sentiment"] },
  { name: "Created Source", count: 5, icon: Database, items: ["Source", "Created date", "Added by", "List", "Saved search"] },
  { name: "Misc", count: 9, icon: SlidersHorizontal, items: ["Saved status", "Owner", "Account owner", "Territory", "Tags", "Custom fields", "Data source", "Record status", "Last updated"] },
];



function EmailStatusPill({ status }) {
  const verified = status === "Verified" || status === "Email available";
  const StatusIcon = verified ? ShieldCheck : CircleHelp;
  const style = verified ? "verified" : status === "Example" ? "example" : "unverified";
  return <span className={`status-pill ${style}`}><StatusIcon size={13} />{status}</span>;
}

const knownLocationCenters = [
  ["san francisco", [37.7749, -122.4194]], ["new york", [40.7128, -74.006]],
  ["austin", [30.2672, -97.7431]], ["seattle", [47.6062, -122.3321]],
  ["portland", [45.5152, -122.6784]],
];

function locationCenter(query) {
  const normalized = String(query || "").toLowerCase();
  return knownLocationCenters.find(([city]) => normalized.includes(city))?.[1] || null;
}

function distanceInMiles(left, right) {
  if (!left || !right) return null;
  const radians = degrees => degrees * Math.PI / 180;
  const [lat1, lon1] = left.map(radians);
  const [lat2, lon2] = right.map(radians);
  const deltaLat = lat2 - lat1;
  const deltaLon = lon2 - lon1;
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function readSavedPeople() {
  try {
    const value = JSON.parse(window.localStorage.getItem("apollo-prototype-saved-people") || "[]");
    if (!Array.isArray(value)) return [];
    return value.map(person => {
      if (typeof person === "string") return sampleProspects.find(sample => sample.name === person);
      if (!person || typeof person.name !== "string") return null;
      const id = typeof person.id === "string" ? person.id : `local:${person.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      return { ...person, id, role: person.role || person.title || "Title unavailable", company: person.company || "Company unavailable", location: person.location || "Location unavailable", status: person.status || (person.email ? "Email available" : "Unavailable") };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeApolloPerson(person) {
  const personId = person.id || person.person_id;
  const firstName = String(person.first_name || "").trim();
  const lastName = String(person.last_name_obfuscated || person.last_name || "").trim();
  const name = [firstName, lastName].filter(Boolean).join(" ") || "Prospect";
  const initials = `${firstName[0] || "A"}${lastName[0] || "P"}`.toUpperCase();
  const location = [person.city, person.state, person.country].filter(Boolean).join(", ") || "Location unavailable";
  const organization = person.organization || {};
  return {
    id: String(personId || `${name}:${organization.name || "unknown"}`),
    canEnrich: Boolean(personId),
    name,
    role: person.title || "Title unavailable",
    pastRole: "",
    company: organization.name || "Company unavailable",
    domain: organization.primary_domain || "",
    location,
    country: person.country || "",
    industry: organization.industry || "",
    status: person.has_email ? "Email available" : "Unavailable",
    hasEmail: Boolean(person.has_email),
    hasPhone: person.has_direct_phone === true || person.has_direct_phone === "Yes",
    phone: person.phone_number || person.phone || "",
    linkedinUrl: person.linkedin_url || person.linkedin_url_clean || person.linkedin || "",
    createdAt: person.last_refreshed_at || "",
    initials,
    color: ["coral", "blue", "purple", "green"][Number.parseInt(String(personId || "0").slice(-1), 16) % 4] || "blue",
    source: "apollo",
  };
}

function readSavedSearches() {
  try {
    const value = JSON.parse(window.localStorage.getItem("apollo-prototype-saved-searches") || "[]");
    return Array.isArray(value) ? value.filter(search => search && typeof search.id === "string" && typeof search.name === "string" && search.criteria && typeof search.criteria === "object") : [];
  } catch {
    return [];
  }
}

function readWorkspaceLists() {
  try {
    const value = JSON.parse(window.localStorage.getItem("apollo-workspace-state") || "{}");
    if (Array.isArray(value.lists)) return value.lists.filter(list => list && typeof list.name === "string" && list.type === "People");
  } catch { /* Fall back to a local destination list. */ }
  return demoWorkspaceLists.filter(list => list.type === "People").map(list => ({ ...list, members: [...list.members] }));
}

function readSavedPersonas() {
  try {
    const value = JSON.parse(window.localStorage.getItem("apollo-prototype-personas") || "[]");
    return Array.isArray(value) ? value.filter(persona => persona && typeof persona.id === "string" && typeof persona.name === "string" && persona.criteria && typeof persona.criteria === "object") : [];
  } catch { return []; }
}

const promptStopWords = new Set("a an and any are at be best by can company companies find for from give in into looking me of on people professional professionals prospect prospects right search show the to use with who that this those these apollo ai email emails status contacts contact individuals specialist specialists talent".split(" "));

function getPromptTerms(prompt) {
  return [...new Set((prompt.toLowerCase().match(/[a-z0-9]+/g) || []).filter(term => term.length > 1 && !/^\d+$/.test(term) && !promptStopWords.has(term)))];
}

function promptTermMatches(text, term) {
  if (/^(?:leader|leaders|leadership|decisionmaker|decisionmakers)$/.test(term)) return /\b(?:chief|head|vp|vice president|director|manager|founder|ceo|cro)\b/.test(text);
  const variants = [term];
  if (term.endsWith("ies") && term.length > 4) variants.push(`${term.slice(0, -3)}y`);
  if (term.endsWith("s") && term.length > 3) variants.push(term.slice(0, -1));
  return variants.some(variant => text.includes(variant));
}

function demoPromptMatchFields(person, prompt) {
  const terms = getPromptTerms(prompt);
  const fields = [
    ["Name", [person.name]],
    ["Role history", [person.role, person.pastRole]],
    ["Company", [person.company, person.pastCompany]],
    ["Location", [person.location, person.country]],
    ["Company profile", [person.industry, person.keywords, person.description, person.status]],
  ];
  return fields.filter(([, values]) => terms.some(term => values.some(value => promptTermMatches(String(value || "").toLowerCase(), term))))
    .map(([label]) => label);
}

function getFilterValues(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/[,;\n]+/);
  return values.map(item => String(item).trim().toLowerCase()).filter(Boolean);
}

function normalizeDomain(value) {
  return String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[\/@?#]/, 1)[0];
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (!quoted && character === ",") { row.push(field); field = ""; }
    else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else field += character;
  }
  row.push(field);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function ProspectFinderMark() {
  return <img className="prospect-mark" src="/assets/prospect-mark.svg" alt="Prospect Finder" />;
}

function IconButton({ children, className = "", title, onClick, ...props }) {
  return <button type="button" className={`icon-button ${className}`} title={title} aria-label={title} onClick={onClick} {...props}>{children}</button>;
}

function FilterField({ label, placeholder, value, onChange, hint, type = "text", min }) {
  return <label className="field-block"><span>{label}</span><input type={type} min={min} value={value} onChange={onChange} placeholder={placeholder} />{hint && <small>{hint}</small>}</label>;
}

export function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches);
  const mobileNavOpen = isMobileNav && sidebarOpen;
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const syncMobileNav = event => {
      setIsMobileNav(event.matches);
      if (!event.matches) setSidebarOpen(false);
    };
    syncMobileNav(media);
    media.addEventListener("change", syncMobileNav);
    return () => media.removeEventListener("change", syncMobileNav);
  }, []);
  useDialogFocus(mobileNavOpen, ".sidebar.mobile-open", () => setSidebarOpen(false));
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(Object.fromEntries(navGroups.map(({ title }) => [title, title !== "Tools and automation"])));
  const [activeModule, setActiveModule] = useState(moduleFromHash);
  const [activeNav, setActiveNav] = useState(() => navKeyForModule(moduleFromHash()));
  const [activeCountTab, setActiveCountTab] = useState("Total");
  const [showFilters, setShowFilters] = useState(() => typeof window === "undefined" || !window.matchMedia("(max-width: 700px)").matches);
  const [openFilter, setOpenFilter] = useState("");
  const [advancedTitles, setAdvancedTitles] = useState(false);
  const [includeSimilarTitles, setIncludeSimilarTitles] = useState(false);
  const [jobTitleKnowledge, setJobTitleKnowledge] = useState("any");
  const [industryKnowledge, setIndustryKnowledge] = useState("not-any-of");
  const [selectedManagementLevels, setSelectedManagementLevels] = useState([]);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [accountHq, setAccountHq] = useState(false);
  const [selectedQuick, setSelectedQuick] = useState([]);
  const [openMenu, setOpenMenu] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filtersModal, setFiltersModal] = useState(false);
  const [filterModalQuery, setFilterModalQuery] = useState("");
  const [modalCategory, setModalCategory] = useState("All");
  const [modalSelected, setModalSelected] = useState([]);
  const [pendingModalSelected, setPendingModalSelected] = useState([]);
  const [titleValue, setTitleValue] = useState("");
  const [excludedTitleValue, setExcludedTitleValue] = useState("");
  const [pastTitleValue, setPastTitleValue] = useState("");
  const [excludedPastTitleValue, setExcludedPastTitleValue] = useState("");
  const [companyValue, setCompanyValue] = useState("");
  const [companyMode, setCompanyMode] = useState("current");
  const [companyDomains, setCompanyDomains] = useState("");
  const [excludedCompanyDomains, setExcludedCompanyDomains] = useState("");
  const [companyDomainOnly, setCompanyDomainOnly] = useState(false);
  const [companySizeRanges, setCompanySizeRanges] = useState("");
  const [companyAttributesOpen, setCompanyAttributesOpen] = useState(false);
  const [revenueMinimum, setRevenueMinimum] = useState("");
  const [revenueMaximum, setRevenueMaximum] = useState("");
  const [technologyValue, setTechnologyValue] = useState("");
  const [activeJobTitles, setActiveJobTitles] = useState("");
  const [activeJobLocations, setActiveJobLocations] = useState("");
  const [activeJobsMinimum, setActiveJobsMinimum] = useState("");
  const [activeJobsMaximum, setActiveJobsMaximum] = useState("");
  const [jobPostedAfter, setJobPostedAfter] = useState("");
  const [jobPostedBefore, setJobPostedBefore] = useState("");
  const [locationValue, setLocationValue] = useState("");
  const [excludedLocationValue, setExcludedLocationValue] = useState("");
  const [locationRadius, setLocationRadius] = useState("Any distance");
  const [industryValue, setIndustryValue] = useState("");
  const [keywordValue, setKeywordValue] = useState("");
  const [excludedKeywordValue, setExcludedKeywordValue] = useState("");
  const [keywordType, setKeywordType] = useState("Keywords");
  const [excludedIndustryValue, setExcludedIndustryValue] = useState("");
  const [searchText, setSearchText] = useState("");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState(readWorkspaceSnapshot);
  const [navigationRequest, setNavigationRequest] = useState(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [apolloConfigured, setApolloConfigured] = useState(false);
  const [apolloKeySource, setApolloKeySource] = useState(null);
  const [apolloStatusLoaded, setApolloStatusLoaded] = useState(false);
  const [liveProspects, setLiveProspects] = useState(null);
  const [liveTotal, setLiveTotal] = useState(0);
  const [liveHasMore, setLiveHasMore] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(25);
  const peopleSearchRequest = useRef(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchLimitations, setSearchLimitations] = useState([]);
  const [enrichmentTarget, setEnrichmentTarget] = useState(null);
  const [enrichmentAutoStart, setEnrichmentAutoStart] = useState(false);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [enrichmentResult, setEnrichmentResult] = useState("");
  const [enrichmentError, setEnrichmentError] = useState("");
  const [resultProvider, setResultProvider] = useState("demo");
  const [savedSearchName, setSavedSearchName] = useState("");
  const [searchNameInput, setSearchNameInput] = useState("");
  const [activeSearchId, setActiveSearchId] = useState("default");
  const [savedSearches, setSavedSearches] = useState(readSavedSearches);
  const [viewSearchQuery, setViewSearchQuery] = useState("");
  const [viewSearchTab, setViewSearchTab] = useState("All searches");
  const [saveDialog, setSaveDialog] = useState(false);
  const [manualContactDialog, setManualContactDialog] = useState(false);
  const [researchTemplateDialog, setResearchTemplateDialog] = useState(false);
  const [selectedResearchTemplate, setSelectedResearchTemplate] = useState("background");
  const [manualContact, setManualContact] = useState({ name: "", title: "", company: "", email: "", phone: "", linkedinUrl: "", location: "" });
  const [listDialog, setListDialog] = useState(false);
  const [workspaceLists, setWorkspaceLists] = useState(readWorkspaceLists);
  const [selectedList, setSelectedList] = useState("");
  const [newListName, setNewListName] = useState("");
  const [savedPersonas, setSavedPersonas] = useState(readSavedPersonas);
  const [personaDialog, setPersonaDialog] = useState(false);
  const [personaDraft, setPersonaDraft] = useState({ name: "", titles: "", industry: "", location: "", companySize: "" });
  const [sortField, setSortField] = useState("Relevance");
  const [sortDirection, setSortDirection] = useState("Descending");
  const [toast, setToast] = useState("");
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [savedPeople, setSavedPeople] = useState(readSavedPeople);

  useDialogFocus(Boolean(filtersModal || settingsOpen || saveDialog || manualContactDialog || listDialog || personaDialog || researchTemplateDialog || enrichmentTarget || openMenu === "help"), ".modal-backdrop > section, .drawer-scrim > aside");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/apollo/status")
      .then(response => response.ok ? response.json() : null)
      .then(status => { if (!cancelled) { setApolloConfigured(Boolean(status?.configured)); setApolloKeySource(status?.source || null); setApolloStatusLoaded(true); } })
      .catch(() => { if (!cancelled) { setApolloConfigured(false); setApolloStatusLoaded(true); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("apollo-prototype-saved-people", JSON.stringify(savedPeople));
    } catch {
      // Keep the saved list usable for this session if browser storage is unavailable.
    }
  }, [savedPeople]);

  useEffect(() => {
    const syncSavedPeople = event => {
      if (Array.isArray(event.detail)) setSavedPeople(event.detail);
    };
    window.addEventListener("apollo:saved-people", syncSavedPeople);
    return () => window.removeEventListener("apollo:saved-people", syncSavedPeople);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("apollo-prototype-saved-searches", JSON.stringify(savedSearches));
    } catch {
      // Keep saved searches available for this session if browser storage is unavailable.
    }
  }, [savedSearches]);

  useEffect(() => {
    try { window.localStorage.setItem("apollo-prototype-personas", JSON.stringify(savedPersonas)); }
    catch { /* Keep saved personas available for this session. */ }
  }, [savedPersonas]);

  useEffect(() => {
    const handleShortcut = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setGlobalSearchQuery("");
        setOpenMenu("global-search");
        return;
      }
      if (event.key !== "Escape") return;
      if (enrichmentTarget) { if (!enrichmentLoading) setEnrichmentTarget(null); }
      else if (personaDialog) setPersonaDialog(false);
      else if (listDialog) setListDialog(false);
      else if (researchTemplateDialog) setResearchTemplateDialog(false);
      else if (manualContactDialog) setManualContactDialog(false);
      else if (saveDialog) setSaveDialog(false);
      else if (filtersModal) { setPendingModalSelected(modalSelected); setFiltersModal(false); }
      else if (settingsOpen) setSettingsOpen(false);
      else if (openMenu) setOpenMenu("");
      else if (sidebarOpen) setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [personaDialog, listDialog, manualContactDialog, researchTemplateDialog, saveDialog, filtersModal, settingsOpen, openMenu, sidebarOpen, modalSelected, enrichmentTarget, enrichmentLoading]);

  useEffect(() => {
    if (!openMenu || ["global-search", "help"].includes(openMenu)) return;
    const dismiss = event => { if (!event.target.closest(".menu-anchor, .popover, .modal-backdrop")) setOpenMenu(""); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [openMenu]);

  useEffect(() => {
    const syncRoute = () => {
      const module = moduleFromHash();
      setActiveModule(module);
      setActiveNav(navKeyForModule(module));
      setSidebarOpen(false);
    };
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  useEffect(() => {
    if (activeModule === "People") document.title = "Prospect Finder";
    setSidebarOpen(false);
    document.querySelector(".workspace")?.scrollTo({ top: 0 });
  }, [activeModule]);

  const activeFilterCount = useMemo(() => {
    return [titleValue, excludedTitleValue, pastTitleValue, excludedPastTitleValue, companyValue, companyDomains, excludedCompanyDomains, companySizeRanges, revenueMinimum, revenueMaximum, technologyValue, activeJobTitles, activeJobLocations, activeJobsMinimum, activeJobsMaximum, jobPostedAfter, jobPostedBefore, locationValue, excludedLocationValue, industryValue, keywordValue, excludedKeywordValue, excludedIndustryValue, ...selectedQuick, ...selectedManagementLevels, ...selectedDepartments].filter(Boolean).length + Number(companyDomainOnly) + Number(includeSimilarTitles) + Number(jobTitleKnowledge !== "any") + Number(industryKnowledge !== "not-any-of");
  }, [titleValue, excludedTitleValue, pastTitleValue, excludedPastTitleValue, companyValue, companyDomains, excludedCompanyDomains, companySizeRanges, revenueMinimum, revenueMaximum, technologyValue, activeJobTitles, activeJobLocations, activeJobsMinimum, activeJobsMaximum, jobPostedAfter, jobPostedBefore, locationValue, excludedLocationValue, industryValue, keywordValue, excludedKeywordValue, excludedIndustryValue, selectedQuick, selectedManagementLevels, selectedDepartments, companyDomainOnly, includeSimilarTitles, jobTitleKnowledge, industryKnowledge]);

  const filteredProspects = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    const promptTerms = getPromptTerms(submittedPrompt);
    const source = activeCountTab === "Saved" ? savedPeople : (liveProspects || sampleProspects).filter(person => {
      if (activeCountTab !== "Net New" || resultProvider === "apollo") return true;
      return !savedPeople.some(saved => saved.id === person.id || saved.name === person.name);
    });
    const quickCountries = selectedQuick.filter(value => ["United States", "Canada"].includes(value));
    const quickTitles = selectedQuick.filter(value => ["founder", "sales manager", "marketing director"].includes(value));
    const quickIndustries = selectedQuick.filter(value => ["Information Technology & Services", "Marketing & Advertising", "Retail"].includes(value));
    const includesAny = (text, values) => {
      const terms = getFilterValues(values);
      return !terms.length || terms.some(value => text.includes(value));
    };

    if (resultProvider === "apollo") {
      return source.filter(person => {
        if (!needle) return true;
        return `${person.name} ${person.role} ${person.company} ${person.location} ${person.email || ""} ${person.phone || ""} ${person.linkedinUrl || ""}`.toLowerCase().includes(needle);
      }).sort((a, b) => {
        if (sortField === "Relevance") return 0;
        const fields = { "First name": "name", "Last name": "name", Company: "company", Location: "location", "Created date": "createdAt" };
        const field = fields[sortField] || "name";
        const left = String(field === "name" && sortField === "Last name" ? a.name.split(" ").at(-1) : a[field] || "").toLowerCase();
        const right = String(field === "name" && sortField === "Last name" ? b.name.split(" ").at(-1) : b[field] || "").toLowerCase();
        const comparison = left.localeCompare(right);
        return sortDirection === "Ascending" ? comparison : -comparison;
      });
    }

    return source.filter(person => {
      const role = String(person.role || "").toLowerCase();
      const company = String(companyMode === "past" ? person.pastCompany : person.company).toLowerCase();
      const domain = String(companyMode === "past" ? person.pastDomain : person.domain || person.organization?.primary_domain || "").toLowerCase().replace(/^www\./, "");
      const companyKeywords = String(person.keywords || "").toLowerCase();
      const companyDescription = String(person.description || "").toLowerCase();
      const location = String(accountHq ? person.hqLocation || person.location : person.location).toLowerCase();
      const industry = String(person.industry || "").toLowerCase();
      const pastRole = String(person.pastRole || "").toLowerCase();
      const allText = `${person.name} ${role} ${pastRole} ${company} ${location} ${person.country || ""} ${industry} ${person.status} ${person.email || ""} ${person.phone || ""} ${person.linkedinUrl || ""} ${companyKeywords} ${companyDescription}`.toLowerCase();

      if (needle && !allText.includes(needle)) return false;
      if (resultProvider !== "apollo" && promptTerms.some(term => !promptTermMatches(allText, term))) return false;
      const titleSearchText = role;
      const requestedTitles = getFilterValues(titleValue);
      const titleMatches = requestedTitles.length === 0 || requestedTitles.some(term => {
        const variants = includeSimilarTitles ? (similarTitleVariants[term] || [term]) : [term];
        return variants.some(variant => titleSearchText.includes(variant));
      });
      if (!titleMatches || (jobTitleKnowledge === "known" && !role) || (jobTitleKnowledge === "unknown" && role)) return false;
      if (excludedTitleValue && includesAny(titleSearchText, excludedTitleValue)) return false;
      if (pastTitleValue && !includesAny(pastRole, pastTitleValue)) return false;
      if (excludedPastTitleValue && includesAny(pastRole, excludedPastTitleValue)) return false;
      if (companyValue && !includesAny(company, companyValue)) return false;
      const includedDomains = getFilterValues(companyDomains).map(normalizeDomain).filter(Boolean);
      const excludedDomains = getFilterValues(excludedCompanyDomains).map(normalizeDomain).filter(Boolean);
      if (includedDomains.length && !includedDomains.some(value => domain.includes(value))) return false;
      if (excludedDomains.some(value => domain.includes(value))) return false;
      if (companyDomainOnly && !domain) return false;
      const employeeRanges = String(companySizeRanges || "").split(/[;\n]+/).map(range => range.trim()).filter(Boolean);
      if (employeeRanges.length) {
        const matchesRange = employeeRanges.some(range => {
          const rangeMatch = range.match(/^\s*(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)\s*$/);
          const commaPair = range.match(/^\s*(\d+)\s*,\s*(\d+)\s*$/);
          const bounds = rangeMatch ? rangeMatch.slice(1).map(value => Number(value.replace(/,/g, ""))) : commaPair ? commaPair.slice(1).map(Number) : [];
          return bounds.length === 2 && Number.isFinite(bounds[0]) && Number.isFinite(bounds[1])
            && Number(person.employeeCount) >= Math.min(...bounds) && Number(person.employeeCount) <= Math.max(...bounds);
        });
        if (!matchesRange) return false;
      }
      if (revenueMinimum && Number(person.revenue) < Number(revenueMinimum)) return false;
      if (revenueMaximum && Number(person.revenue) > Number(revenueMaximum)) return false;
      const requestedTechnologies = getFilterValues(technologyValue).map(value => value.replace(/[ .]+/g, "_").toLowerCase());
      if (requestedTechnologies.length && !requestedTechnologies.some(value => person.technologies?.includes(value))) return false;
      const jobTitleText = (person.openJobTitles || []).join(" ").toLowerCase();
      const jobLocationText = (person.openJobLocations || []).join(" ").toLowerCase();
      if (activeJobTitles && !includesAny(jobTitleText, activeJobTitles)) return false;
      if (activeJobLocations && !includesAny(jobLocationText, activeJobLocations)) return false;
      if (activeJobsMinimum && Number(person.activeJobs || 0) < Number(activeJobsMinimum)) return false;
      if (activeJobsMaximum && Number(person.activeJobs || 0) > Number(activeJobsMaximum)) return false;
      if (jobPostedAfter && (!person.lastJobPostedAt || person.lastJobPostedAt < jobPostedAfter)) return false;
      if (jobPostedBefore && (!person.lastJobPostedAt || person.lastJobPostedAt > jobPostedBefore)) return false;
      if (locationValue && !includesAny(location, locationValue)) return false;
      if (excludedLocationValue && includesAny(location, excludedLocationValue)) return false;
      const radiusMiles = Number.parseInt(locationRadius, 10);
      if (radiusMiles && locationValue) {
        const center = locationCenter(locationValue);
        const point = accountHq ? person.hqCoordinates || person.coordinates : person.coordinates;
        const distance = distanceInMiles(center, point);
        if (distance !== null && distance > radiusMiles) return false;
      }
      if (industryValue && !includesAny(industry, industryValue)) return false;
      const keywordSearchText = keywordType === "Name" ? company : keywordType === "Company description" ? companyDescription : companyKeywords;
      if (keywordValue && !includesAny(keywordSearchText, keywordValue)) return false;
      if (excludedKeywordValue && includesAny(keywordSearchText, excludedKeywordValue)) return false;
      if ((industryKnowledge === "known" && !industry) || (industryKnowledge === "unknown" && industry)) return false;
      if (industryKnowledge === "not-any-of" && excludedIndustryValue && includesAny(industry, excludedIndustryValue)) return false;
      const searchableRole = role;
      if (selectedManagementLevels.length && !selectedManagementLevels.some(level => managementPatterns[level]?.test(searchableRole))) return false;
      if (selectedDepartments.length && !selectedDepartments.some(department => departmentPatterns[department]?.test(searchableRole))) return false;
      if (quickCountries.length && !quickCountries.includes(person.country)) return false;
      if (!includesAny(titleSearchText, quickTitles)) return false;
      if (!includesAny(industry, quickIndustries)) return false;
      return true;
    }).sort((a, b) => {
      if (sortField === "Relevance") return 0;
      const fields = { "First name": "name", "Last name": "name", Company: "company", Location: "location", "Created date": "createdAt" };
      const field = fields[sortField] || "name";
      const left = String((field === "name" && sortField === "Last name" ? a.name.split(" ").at(-1) : a[field]) || "").toLowerCase();
      const right = String((field === "name" && sortField === "Last name" ? b.name.split(" ").at(-1) : b[field]) || "").toLowerCase();
      const comparison = left.localeCompare(right);
      return sortDirection === "Ascending" ? comparison : -comparison;
    });
  }, [activeCountTab, searchText, submittedPrompt, savedPeople, liveProspects, resultProvider, selectedQuick, titleValue, excludedTitleValue, pastTitleValue, excludedPastTitleValue, companyValue, companyMode, companyDomains, excludedCompanyDomains, companyDomainOnly, companySizeRanges, revenueMinimum, revenueMaximum, technologyValue, activeJobTitles, activeJobLocations, activeJobsMinimum, activeJobsMaximum, jobPostedAfter, jobPostedBefore, locationValue, excludedLocationValue, locationRadius, accountHq, industryValue, keywordValue, excludedKeywordValue, keywordType, excludedIndustryValue, includeSimilarTitles, jobTitleKnowledge, industryKnowledge, selectedManagementLevels, selectedDepartments, sortField, sortDirection]);

  const notify = (message) => {
    setToast(message);
    window.clearTimeout(window.__apolloToastTimer);
    window.__apolloToastTimer = window.setTimeout(() => setToast(""), 2600);
  };

  const toggleMenu = (name) => setOpenMenu(current => current === name ? "" : name);
  const toggleQuick = (value) => setSelectedQuick(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  const toggleModalFilter = (value) => setPendingModalSelected(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  const toggleGroup = (title) => setExpandedGroups(current => ({ ...current, [title]: !current[title] }));
  const toggleSavedPerson = (person) => {
    const isSaved = savedPeople.some(saved => saved.id === person.id || saved.name === person.name);
    const next = isSaved
      ? savedPeople.filter(saved => saved.id !== person.id && saved.name !== person.name)
      : [...savedPeople, person];
    setSavedPeople(next);
    try { window.localStorage.setItem("apollo-prototype-saved-people", JSON.stringify(next)); } catch { /* Keep saved people available for this session. */ }
    window.dispatchEvent(new CustomEvent("apollo:saved-people", { detail: next }));
    notify(isSaved ? `${person.name} removed from saved people` : `${person.name} saved`);
  };
  const persistContactCompanies = contacts => {
    const companyNames = [...new Set(contacts.map(person => person.company).filter(company => company && company !== "Company unavailable"))];
    if (!companyNames.length) return;
    try {
      const state = JSON.parse(window.localStorage.getItem("apollo-workspace-state") || "{}");
      const companies = Array.isArray(state.companies) ? state.companies : [];
      const known = new Set(companies.map(company => String(company.name || "").toLowerCase()));
      const additions = companyNames.filter(name => !known.has(name.toLowerCase())).map(name => ({ name, domain: "", industry: "—", employees: "—", location: "—", people: 1, status: "New" }));
      if (additions.length) window.localStorage.setItem("apollo-workspace-state", JSON.stringify({ ...state, companies: [...additions, ...companies] }));
    } catch { /* Keep contact creation available if company metadata cannot be persisted. */ }
  };
  const addManualContact = event => {
    event.preventDefault();
    const name = manualContact.name.trim();
    const email = manualContact.email.trim().toLowerCase();
    const linkedinUrl = normalizeLinkedInUrl(manualContact.linkedinUrl);
    if (!name) return;
    if (linkedinUrl === null) { notify("Enter a valid LinkedIn profile or company URL"); return; }
    if (savedPeople.some(person => person.name.toLowerCase() === name.toLowerCase() || (email && person.email?.toLowerCase() === email))) {
      notify("A contact with that name or email is already saved");
      return;
    }
    const contact = { id: `local:${crypto.randomUUID()}`, name, title: manualContact.title.trim() || "Title unavailable", role: manualContact.title.trim() || "Title unavailable", company: manualContact.company.trim() || "Company unavailable", email, phone: manualContact.phone.trim(), linkedinUrl, location: manualContact.location.trim() || "Location unavailable", status: email ? "Added manually" : "Unavailable", source: "local", initials: name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase(), color: "blue" };
    const next = [contact, ...savedPeople];
    setSavedPeople(next);
    persistContactCompanies([contact]);
    try { window.localStorage.setItem("apollo-prototype-saved-people", JSON.stringify(next)); } catch { /* Keep the saved list usable for this session. */ }
    window.dispatchEvent(new CustomEvent("apollo:saved-people", { detail: next }));
    setManualContactDialog(false);
    setManualContact({ name: "", title: "", company: "", email: "", phone: "", linkedinUrl: "", location: "" });
    notify(`${name} added to your workspace`);
  };
  const importContactsCsv = async event => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const rows = parseCsvRows(await file.text());
      if (rows.length < 2) { notify("The CSV has no contact rows"); return; }
      const headers = rows[0].map(value => value.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
      const column = (...names) => headers.findIndex(header => names.includes(header));
      const at = (values, index) => index < 0 ? "" : String(values[index] || "").trim();
      const nameIndex = column("name", "fullname", "contactname");
      const firstIndex = column("firstname", "first");
      const lastIndex = column("lastname", "last", "surname");
      const titleIndex = column("title", "jobtitle", "role", "position");
      const companyIndex = column("company", "companyname", "organization", "account");
      const emailIndex = column("email", "emailaddress", "workemail");
      const phoneIndex = column("phone", "phonenumber", "mobile", "mobilephone", "directphone");
      const linkedinIndex = column("linkedin", "linkedinurl", "linkedinprofile", "linkedinprofileurl", "profileurl");
      const locationIndex = column("location", "city", "citystate", "contactlocation");
      if (nameIndex < 0 && firstIndex < 0 && emailIndex < 0) { notify("CSV needs a Name, First Name, or Email column"); return; }
      const imported = rows.slice(1).map((values, index) => {
        const name = at(values, nameIndex) || [at(values, firstIndex), at(values, lastIndex)].filter(Boolean).join(" ") || at(values, emailIndex).split("@")[0].replace(/[._-]+/g, " ");
        if (!name) return null;
        return { id: `local:${crypto.randomUUID()}:${index}`, name, title: at(values, titleIndex) || "Title unavailable", role: at(values, titleIndex) || "Title unavailable", company: at(values, companyIndex) || "Company unavailable", email: at(values, emailIndex).toLowerCase(), phone: at(values, phoneIndex), linkedinUrl: normalizeLinkedInUrl(at(values, linkedinIndex)) || at(values, linkedinIndex), location: at(values, locationIndex) || "Location unavailable", status: at(values, emailIndex) ? "Added manually" : "Unavailable", source: "local", initials: name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase(), color: "blue" };
      }).filter(Boolean);
      const seenNames = new Set(savedPeople.map(person => person.name.toLowerCase()));
      const seenEmails = new Set(savedPeople.map(person => person.email?.toLowerCase()).filter(Boolean));
      const unique = imported.filter(person => {
        if (seenNames.has(person.name.toLowerCase()) || (person.email && seenEmails.has(person.email))) return false;
        seenNames.add(person.name.toLowerCase());
        if (person.email) seenEmails.add(person.email);
        return true;
      });
      if (!unique.length) { notify("No new contacts to import"); return; }
      const next = [...unique, ...savedPeople];
      setSavedPeople(next);
      persistContactCompanies(unique);
      try { window.localStorage.setItem("apollo-prototype-saved-people", JSON.stringify(next)); } catch { /* Keep imported contacts available for this session. */ }
      window.dispatchEvent(new CustomEvent("apollo:saved-people", { detail: next }));
      notify(`Imported ${unique.length} contact${unique.length === 1 ? "" : "s"} from ${file.name}`);
    } catch { notify("Could not read this CSV file"); }
  };
  const exportContactsCsv = () => {
    const selected = filteredProspects.filter(person => selectedPeople.includes(person.id || person.name));
    const records = selected.length ? selected : showingResults ? filteredProspects : savedPeople;
    if (!records.length) { notify("Save or select contacts before exporting"); return; }
    const fields = ["name", "title", "company", "email", "phone", "linkedinUrl", "location", "status"];
    const escapeCell = value => {
      const text = String(value ?? "");
      const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const csv = [fields.join(","), ...records.map(person => fields.map(field => escapeCell(field === "title" ? person.title || person.role : person[field])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `prospects-${new Date()}.toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const source = selected.length ? "selected results" : showingSavedPeople ? "saved people" : showingResults ? "the current results page" : "saved people";
    notify(`Exported ${records.length} contact${records.length === 1 ? "" : "s"} from ${source} to CSV`);
  };
  const addSelectedContactsToList = () => {
    const contacts = filteredProspects.filter(person => selectedPeople.includes(person.id || person.name));
    const listName = selectedList === "new" ? newListName.trim() : selectedList.trim();
    if (!contacts.length) { notify("Select at least one visible prospect"); return; }
    if (!listName) return;
    try {
      const workspace = JSON.parse(window.localStorage.getItem("apollo-workspace-state") || "{}");
      const lists = Array.isArray(workspace.lists) ? workspace.lists : workspaceLists;
      const existing = lists.find(list => list.name.toLowerCase() === listName.toLowerCase());
      if (existing && existing.type !== "People") { notify(`“${listName}” is a company list. Choose a People list or use a different name.`); return; }
      const members = existing?.members || [];
      const newMembers = contacts.map(person => person.name).filter(name => !members.includes(name));
      const updatedList = existing
        ? { ...existing, members: [...members, ...newMembers], count: members.length + newMembers.length, updated: newMembers.length ? "Just now" : existing.updated }
        : { name: listName, type: "People", count: newMembers.length, updated: "Just now", description: "Prospects added from Find people", members: newMembers, source: "local" };
      const nextLists = existing ? lists.map(list => list.name === existing.name ? updatedList : list) : [updatedList, ...lists];
      const knownPeople = new Set(savedPeople.map(person => person.name.toLowerCase()));
      const nextPeople = [...contacts.filter(person => !knownPeople.has(person.name.toLowerCase())), ...savedPeople];
      const companyNames = [...new Set(contacts.map(person => person.company).filter(company => company && company !== "Company unavailable"))];
      const companies = Array.isArray(workspace.companies) ? workspace.companies : [];
      const knownCompanies = new Set(companies.map(company => String(company.name || "").toLowerCase()));
      const addedCompanies = companyNames.filter(name => !knownCompanies.has(name.toLowerCase())).map(name => ({ name, domain: "", industry: "—", employees: "—", location: "—", people: 1, status: "New" }));
      const nextWorkspace = applyWorkflowEvent({ ...workspace, lists: nextLists, companies: [...addedCompanies, ...companies], savedPeople: nextPeople }, "Contact added to list", contacts.filter(person => newMembers.includes(person.name)).map(person => ({ contact: person.name, company: person.company, list: listName })));
      window.localStorage.setItem("apollo-workspace-state", JSON.stringify(nextWorkspace));
      window.localStorage.setItem("apollo-prototype-saved-people", JSON.stringify(nextPeople));
      setWorkspaceLists(nextWorkspace.lists.filter(list => list.type === "People"));
      setSavedPeople(nextPeople);
      window.dispatchEvent(new CustomEvent("apollo:saved-people", { detail: nextPeople }));
      setListDialog(false);
      setSelectedPeople([]);
      notify(`${newMembers.length} prospect${newMembers.length === 1 ? "" : "s"} added to ${listName}`);
    } catch { notify("Could not save those prospects to the local list"); }
  };
  const openPersonEnrichment = (person, { autoApprove = false } = {}) => {
    if (!apolloConfigured) return false;
    setEnrichmentTarget(person);
    setEnrichmentResult("");
    setEnrichmentError("");
    setEnrichmentAutoStart(autoApprove);
    return true;
  };
  const enrichPersonEmail = async () => {
    if (!enrichmentTarget?.canEnrich || enrichmentLoading) return;
    setEnrichmentLoading(true);
    setEnrichmentError("");
    setEnrichmentResult("");
    try {
      const response = await fetch("/api/apollo/people/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: enrichmentTarget.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Apollo enrichment failed.");
      if (!payload.email) {
        const attempted = { ...enrichmentTarget, enrichmentAttempted: true };
        setLiveProspects(current => current?.map(person => person.id === attempted.id ? attempted : person) || current);
        setSavedPeople(current => current.map(person => person.id === attempted.id ? attempted : person));
        setEnrichmentError(payload.message || "Apollo did not return an email for this person.");
        return;
      }
      const normalizedStatus = String(payload.emailStatus || "").toLowerCase() === "verified" ? "Verified" : "Email available";
      const enriched = {
        ...enrichmentTarget,
        email: payload.email,
        emailStatus: payload.emailStatus || null,
        status: normalizedStatus,
        enrichmentAttempted: true,
      };
      setLiveProspects(current => current?.map(person => person.id === enriched.id ? enriched : person) || current);
      setSavedPeople(current => current.map(person => person.id === enriched.id ? enriched : person));
      setEnrichmentResult(`${payload.email}${payload.matchConfidence ? ` · ${payload.matchConfidence} match` : ""}`);
    } catch (error) {
      setEnrichmentError(error instanceof Error ? error.message : "Apollo enrichment failed.");
    } finally {
      setEnrichmentLoading(false);
    }
  };
  useEffect(() => {
    if (!enrichmentAutoStart || !enrichmentTarget || enrichmentLoading) return;
    setEnrichmentAutoStart(false);
    enrichPersonEmail();
  }, [enrichmentAutoStart, enrichmentTarget, enrichmentLoading, apolloConfigured]);
  const runPeopleSearch = async (event, overrides = {}) => {
    event?.preventDefault?.();
    const prompt = String(overrides.prompt ?? aiPrompt).trim();
    const displayPrompt = String(overrides.displayPrompt ?? prompt).trim();
    const apiPrompt = companyDomains && prompt.toLowerCase().startsWith("people at ") ? "" : prompt;
    const nextSearchText = String(overrides.searchText ?? searchText).trim();
    const page = Math.min(500, Math.max(1, Number(overrides.page) || 1));
    const perPage = Math.min(100, Math.max(1, Number(overrides.perPage) || resultsPerPage));
    const searchFilters = overrides.criteria || {
      titleValue, excludedTitleValue, pastTitleValue, excludedPastTitleValue, companyValue, companyMode,
      companyDomains, excludedCompanyDomains, companyDomainOnly, companySizeRanges, revenueMinimum, revenueMaximum,
      technologyValue, activeJobTitles, activeJobLocations, activeJobsMinimum, activeJobsMaximum, jobPostedAfter,
      jobPostedBefore, locationValue, excludedLocationValue, locationRadius, accountHq, industryValue,
      excludedIndustryValue, jobTitleKnowledge, industryKnowledge, keywordValue, excludedKeywordValue, keywordType,
      includeSimilarTitles, selectedManagementLevels, selectedDepartments, selectedQuick,
    };
    if (page === 1 && !prompt && !nextSearchText && activeFilterCount === 0 && !overrides.allowEmpty) return;
    const requestId = ++peopleSearchRequest.current;
    setSubmittedPrompt(displayPrompt || (nextSearchText ? `Name: ${nextSearchText}` : "People search"));
    setSearchText(nextSearchText);
    setSearchError("");
    setSearchLimitations([]);
    setSearchPage(page);
    setResultsPerPage(perPage);
    if (page === 1) setSelectedPeople([]);

    if (!apolloConfigured) {
      setSearchLoading(false);
      setResultProvider("demo");
      setLiveProspects(null);
      setLiveTotal(0);
      setLiveHasMore(false);
      return;
    }

    setSearchLoading(true);
    setResultProvider("apollo");
    setLiveProspects([]);
    try {
      const response = await fetch("/api/apollo/people/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page,
          perPage,
          criteria: { prompt: apiPrompt, searchText: nextSearchText, ...searchFilters },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Apollo search failed.");
      if (requestId !== peopleSearchRequest.current) return;
      setLiveProspects((payload.people || []).map(normalizeApolloPerson));
      setLiveTotal(Number(payload.total) || 0);
      setLiveHasMore(Boolean(payload.hasMore));
      setSearchLimitations(Array.isArray(payload.limitations) ? payload.limitations : []);
      setResultProvider("apollo");
    } catch (error) {
      if (requestId !== peopleSearchRequest.current) return;
      setLiveProspects([]);
      setLiveTotal(0);
      setLiveHasMore(false);
      setSearchError(error instanceof Error ? error.message : "Apollo search failed.");
    } finally {
      if (requestId === peopleSearchRequest.current) setSearchLoading(false);
    }
  };
  const submitPrompt = (event) => runPeopleSearch(event);

  const runGlobalSearch = (item) => {
    if (!item) return;
    setOpenMenu("");
    setGlobalSearchQuery("");
    const moduleBySearch = { "Find people": "People", "Find companies": "Companies" };
    const module = moduleBySearch[item] || item;
    if (["Home", "AI Assistant", "People", "Companies", "Lists", "Data enrichment", "Sequences", "Emails", "Calls", "Tasks", "Meetings", "Conversations", "Deals", "Workflows", "Analytics", "Settings"].includes(module)) {
      const resolvedModule = module === "AI Assistant" ? "Assistant" : module;
      const routeMap = { Home: "/home", Assistant: "/assistant", People: "/people", Companies: "/companies", Lists: "/lists", "Data enrichment": "/enrichment-status/data-health-center", Sequences: "/sequences", Emails: "/emails", Calls: "/phone-calls", Tasks: "/tasks", Meetings: "/meetings", Conversations: "/conversations/recordings", Deals: "/opportunities", Workflows: "/plays", Analytics: "/analytics", Settings: "/settings" };
      if (routeMap[resolvedModule] && window.location.hash !== `#${routeMap[resolvedModule]}`) window.location.hash = routeMap[resolvedModule];
      setActiveNav(navKeyForModule(resolvedModule));
      setActiveModule(resolvedModule);
      setActiveCountTab("Total");
      if (module === "People") { setSubmittedPrompt(""); setAiPrompt(""); }
      return;
    }
    notify(`${item} is not available in this workspace`);
  };
  const openAssistantWithPrompt = prompt => {
    setOpenMenu("");
    setNavigationRequest({ module: "Assistant", prompt, requestId: `${Date.now()}-${Math.random()}` });
    runGlobalSearch("AI Assistant");
  };
  const openWorkspaceRecord = item => {
    setOpenMenu("");
    setNavigationRequest({ ...item, requestId: `${Date.now()}-${Math.random()}` });
    runGlobalSearch(item.module);
  };
  const openConnectionSettings = () => {
    setNavigationRequest({ module: "Settings", settingsTab: "Integrations", requestId: `${Date.now()}` });
    runGlobalSearch("Settings");
  };
  const searchPeopleFromAssistant = prompt => {
    if (!apolloConfigured) return false;
    setActiveNav("People");
    setActiveModule("People");
    setActiveCountTab("Total");
    setAiPrompt(prompt);
    setSearchText("");
    if (window.location.hash !== "#/people") window.location.hash = "#/people";
    runPeopleSearch(null, { page: 1, prompt, searchText: "", criteria: {}, allowEmpty: true });
    return true;
  };
  const searchPeopleAtCompany = company => {
    if (!company?.name) return;
    const domain = String(company.domain || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
    setActiveNav("People");
    setActiveModule("People");
    setActiveCountTab("Total");
    setCompanyValue(domain ? "" : company.name);
    setCompanyMode("current");
    setCompanyDomains(domain);
    setCompanyDomainOnly(Boolean(domain));
    const prompt = `People at ${company.name}`;
    setAiPrompt(prompt);
    setSearchText("");
    if (window.location.hash !== "#/people") window.location.hash = "#/people";
    runPeopleSearch(null, {
      page: 1,
      prompt,
      searchText: "",
      criteria: {
        titleValue, excludedTitleValue, pastTitleValue, excludedPastTitleValue,
        companyValue: domain ? "" : company.name, companyMode: "current", companyDomains: domain || "", excludedCompanyDomains,
        companyDomainOnly: Boolean(domain), companySizeRanges, revenueMinimum, revenueMaximum, technologyValue,
        activeJobTitles, activeJobLocations, activeJobsMinimum, activeJobsMaximum, jobPostedAfter, jobPostedBefore,
        locationValue, excludedLocationValue, locationRadius, accountHq, industryValue, excludedIndustryValue,
        jobTitleKnowledge, industryKnowledge, keywordValue, excludedKeywordValue, keywordType, includeSimilarTitles,
        selectedManagementLevels, selectedDepartments, selectedQuick,
      },
      allowEmpty: true,
    });
    if (!apolloConfigured) notify(`Showing sample contacts for ${company.name}. Connect Apollo to search the live directory.`);
    else if (!domain) notify(`Searching for people associated with ${company.name} by keyword; add a company domain for a more precise account search.`);
  };
  const openWorkflowTemplate = action => {
    setNavigationRequest({ module: "Workflows", workflowAction: action, requestId: `${Date.now()}-${Math.random()}` });
    runGlobalSearch("Workflows");
  };
  const continueWithResearchTemplate = () => {
    const selectedContacts = filteredProspects.filter(person => selectedPeople.includes(person.id || person.name));
    const template = contactResearchTemplates.find(item => item.id === selectedResearchTemplate);
    if (!template || !selectedContacts.length) return;
    const references = selectedContacts.map(person => `${person.name}${person.role ? ` — ${person.role}` : ""}${person.company ? ` at ${person.company}` : ""}`);
    const dataNote = resultProvider === "demo" ? "The current table contains local demo records, not Apollo contact research. State that limitation clearly and do not invent facts about these people." : "Use only connected Apollo data or linked sources; do not imply you have researched fields that are unavailable.";
    const prompt = `Use Apollo AI Research template “${template.name}” for the selected contacts: ${references.join("; ")}. Proposed reusable research field: “${template.field}”. Template instructions: ${template.prompt} ${dataNote} First show a preview for up to 3 contacts and the exact output format. Explain any credit use and confirm the selected contacts and research field. Do not apply research to the contacts or make account changes until I approve the preview.`;
    setResearchTemplateDialog(false);
    openAssistantWithPrompt(prompt);
  };

  const clearFilters = () => {
    setTitleValue(""); setExcludedTitleValue(""); setPastTitleValue(""); setExcludedPastTitleValue(""); setCompanyValue(""); setCompanyMode("current"); setCompanyDomains(""); setExcludedCompanyDomains(""); setCompanyDomainOnly(false); setCompanySizeRanges(""); setCompanyAttributesOpen(false); setRevenueMinimum(""); setRevenueMaximum(""); setTechnologyValue(""); setActiveJobTitles(""); setActiveJobLocations(""); setActiveJobsMinimum(""); setActiveJobsMaximum(""); setJobPostedAfter(""); setJobPostedBefore(""); setLocationValue(""); setExcludedLocationValue(""); setLocationRadius("Any distance"); setAccountHq(false); setIndustryValue(""); setKeywordValue(""); setExcludedKeywordValue(""); setKeywordType("Keywords"); setExcludedIndustryValue(""); setSelectedQuick([]); setModalSelected([]); setSearchText("");
    setIncludeSimilarTitles(false); setJobTitleKnowledge("any"); setIndustryKnowledge("not-any-of"); setSelectedManagementLevels([]); setSelectedDepartments([]);
  };

  const currentSearchCriteria = () => ({
    activeCountTab: activeCountTab === "Saved" ? "Total" : activeCountTab,
    submittedPrompt, aiPrompt, searchText, selectedQuick, modalSelected,
    titleValue, excludedTitleValue, pastTitleValue, excludedPastTitleValue, companyValue, companyMode, companyDomains, excludedCompanyDomains, companyDomainOnly, companySizeRanges, revenueMinimum, revenueMaximum, technologyValue, activeJobTitles, activeJobLocations, activeJobsMinimum, activeJobsMaximum, jobPostedAfter, jobPostedBefore, locationValue,
    excludedLocationValue, locationRadius, accountHq, industryValue, keywordValue, excludedKeywordValue, keywordType,
    excludedIndustryValue, includeSimilarTitles, jobTitleKnowledge, industryKnowledge,
    selectedManagementLevels, selectedDepartments, sortField, sortDirection,
  });

  const saveCurrentSearch = () => {
    const name = searchNameInput.trim();
    if (!name) {
      notify("Enter a name for this search");
      return;
    }
    const id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const search = { id, name, starred: false, criteria: currentSearchCriteria() };
    setSavedSearches(current => [search, ...current]);
    setSavedSearchName(name);
    setActiveSearchId(id);
    setSearchNameInput("");
    setSaveDialog(false);
    setOpenMenu("");
    notify("Search saved in this browser");
  };

  const restoreSavedSearch = (search) => {
    if (!search) {
      clearFilters();
      setSubmittedPrompt(""); setAiPrompt(""); setSelectedQuick([]); setModalSelected([]);
      setSortField("Relevance"); setSortDirection("Descending"); setActiveCountTab("Total");
      setSavedSearchName(""); setActiveSearchId("default"); setOpenMenu("");
      return;
    }
    const criteria = search.criteria;
    setTitleValue(criteria.titleValue || ""); setExcludedTitleValue(criteria.excludedTitleValue || "");
    setPastTitleValue(criteria.pastTitleValue || ""); setExcludedPastTitleValue(criteria.excludedPastTitleValue || ""); setCompanyValue(criteria.companyValue || "");
    setCompanyMode(criteria.companyMode || "current"); setCompanyDomains(criteria.companyDomains || ""); setExcludedCompanyDomains(criteria.excludedCompanyDomains || ""); setCompanyDomainOnly(Boolean(criteria.companyDomainOnly)); setCompanySizeRanges(criteria.companySizeRanges || ""); setRevenueMinimum(criteria.revenueMinimum || ""); setRevenueMaximum(criteria.revenueMaximum || ""); setTechnologyValue(criteria.technologyValue || ""); setActiveJobTitles(criteria.activeJobTitles || ""); setActiveJobLocations(criteria.activeJobLocations || ""); setActiveJobsMinimum(criteria.activeJobsMinimum || ""); setActiveJobsMaximum(criteria.activeJobsMaximum || ""); setJobPostedAfter(criteria.jobPostedAfter || ""); setJobPostedBefore(criteria.jobPostedBefore || "");
    setLocationValue(criteria.locationValue || ""); setExcludedLocationValue(criteria.excludedLocationValue || ""); setLocationRadius(criteria.locationRadius || "Any distance"); setAccountHq(Boolean(criteria.accountHq));
    setIndustryValue(criteria.industryValue || ""); setKeywordValue(criteria.keywordValue || ""); setKeywordType(criteria.keywordType || "Keywords");
    setExcludedKeywordValue(criteria.excludedKeywordValue || ""); setExcludedIndustryValue(criteria.excludedIndustryValue || "");
    setIncludeSimilarTitles(Boolean(criteria.includeSimilarTitles)); setJobTitleKnowledge(criteria.jobTitleKnowledge || "any"); setIndustryKnowledge(criteria.industryKnowledge || "not-any-of");
    setSelectedManagementLevels(Array.isArray(criteria.selectedManagementLevels) ? criteria.selectedManagementLevels : []); setSelectedDepartments(Array.isArray(criteria.selectedDepartments) ? criteria.selectedDepartments : []);
    setSelectedQuick(Array.isArray(criteria.selectedQuick) ? criteria.selectedQuick : []);
    setModalSelected(Array.isArray(criteria.modalSelected) ? criteria.modalSelected : []);
    setSearchText(criteria.searchText || ""); setSubmittedPrompt(criteria.submittedPrompt || ""); setAiPrompt(criteria.aiPrompt || criteria.submittedPrompt || "");
    setSortField(criteria.sortField || "Relevance"); setSortDirection(criteria.sortDirection || "Descending");
    setActiveCountTab(criteria.activeCountTab === "Net New" ? "Net New" : "Total");
    setSavedSearchName(search.name); setActiveSearchId(search.id); setOpenMenu("");
  };

  const toggleSavedSearchStar = (id) => setSavedSearches(current => current.map(search => search.id === id ? { ...search, starred: !search.starred } : search));
  const openPersonaBuilder = () => {
    setPersonaDraft({ name: "", titles: titleValue, industry: industryValue, location: locationValue, companySize: companySizeRanges });
    setPersonaDialog(true);
  };
  const savePersona = event => {
    event.preventDefault();
    const name = personaDraft.name.trim();
    if (!name) return;
    const existing = savedPersonas.find(persona => persona.name.toLowerCase() === name.toLowerCase());
    const id = existing?.id || window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const persona = { id, name, criteria: { titles: personaDraft.titles.trim(), industry: personaDraft.industry.trim(), location: personaDraft.location.trim(), companySize: personaDraft.companySize.trim() } };
    setSavedPersonas(current => existing ? current.map(item => item.id === existing.id ? persona : item) : [persona, ...current]);
    setPersonaDialog(false);
    notify(`Persona ${name} saved in this browser`);
  };
  const applyPersona = persona => {
    clearFilters();
    const criteria = {
      titleValue: persona.criteria.titles || "", excludedTitleValue: "", pastTitleValue: "", excludedPastTitleValue: "",
      companyValue: "", companyMode: "current", companyDomains: "", excludedCompanyDomains: "", companyDomainOnly: false,
      companySizeRanges: persona.criteria.companySize || "", revenueMinimum: "", revenueMaximum: "", technologyValue: "",
      activeJobTitles: "", activeJobLocations: "", activeJobsMinimum: "", activeJobsMaximum: "", jobPostedAfter: "", jobPostedBefore: "",
      locationValue: persona.criteria.location || "", excludedLocationValue: "", locationRadius: "Any distance", accountHq: false,
      industryValue: persona.criteria.industry || "", excludedIndustryValue: "", jobTitleKnowledge: "any", industryKnowledge: "not-any-of",
      keywordValue: "", excludedKeywordValue: "", keywordType: "Keywords", includeSimilarTitles: false,
      selectedManagementLevels: [], selectedDepartments: [], selectedQuick: [],
    };
    setTitleValue(criteria.titleValue); setIndustryValue(criteria.industryValue); setLocationValue(criteria.locationValue); setCompanySizeRanges(criteria.companySizeRanges);
    setSubmittedPrompt(""); setAiPrompt(""); setSavedSearchName(""); setActiveSearchId("default"); setActiveCountTab("Total");
    if (apolloConfigured) runPeopleSearch(null, { page: 1, allowEmpty: true, prompt: "", searchText: "", criteria });
    notify(`Applied persona: ${persona.name}`);
  };
  const deletePersona = id => {
    setSavedPersonas(current => current.filter(persona => persona.id !== id));
    notify("Persona removed");
  };

  const matchesModalFilter = (item, categoryName) => {
    const inCategory = modalCategory === "All" || categoryName === modalCategory;
    const inSearch = !filterModalQuery || item.toLowerCase().includes(filterModalQuery.toLowerCase());
    return inCategory && inSearch;
  };

  const applyAdvancedFilters = () => {
    const emailStatusUnavailable = !apolloConfigured && pendingModalSelected.includes("Email Status");
    const selectedFilters = pendingModalSelected;
    const destinations = {
      "Job Titles": "Job Titles",
      "Management Level": "Job Titles",
      "Departments & Job Function": "Job Titles",
      Location: "Location",
      "Company Location": "Location",
      Company: "Company",
      "Company Size": "Company",
      Revenue: "Company",
      Technologies: "Company",
      Hiring: "Company",
      Industry: "Industry & Keywords",
      Keywords: "Industry & Keywords",
    };
    const destination = selectedFilters.map(item => destinations[item]).find(Boolean);
    const emailStatusSelected = selectedFilters.includes("Email Status");
    const unsupported = selectedFilters.filter(item => !destinations[item] && !["Name", "Email Status"].includes(item));
    setModalSelected(selectedFilters);
    setPendingModalSelected(selectedFilters);
    setFiltersModal(false);
    if (selectedFilters.some(item => ["Company Size", "Revenue", "Technologies", "Hiring"].includes(item))) setCompanyAttributesOpen(true);
    if (selectedFilters.includes("Company Location")) setAccountHq(true);
    if (destination) setOpenFilter(destination);
    if (emailStatusSelected) window.setTimeout(() => document.getElementById("quick-email-status")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    if (selectedFilters.includes("Name")) window.setTimeout(() => document.querySelector(".people-search-field input")?.focus(), 0);
    if (emailStatusUnavailable) notify("Email verification filters need a connected Apollo account. Demo addresses are placeholders.");
    else if (unsupported.length) notify(`${unsupported.length} selected filter${unsupported.length === 1 ? " is" : "s are"} not available in this prototype yet.`);
    else if (emailStatusSelected && !destination) notify("Choose an email status under Quick filters.");
    else if (destination || pendingModalSelected.includes("Name")) notify("Choose values in the selected filter controls.");
    else notify("No supported filter selected.");
  };

  const showingSavedPeople = activeCountTab === "Saved";
  const showingResults = Boolean(submittedPrompt) || showingSavedPeople;
  const normalizedViewQuery = viewSearchQuery.trim().toLowerCase();
  const visibleSavedSearches = savedSearches.filter(search => {
    const matchesQuery = !normalizedViewQuery || search.name.toLowerCase().includes(normalizedViewQuery);
    const matchesTab = viewSearchTab === "All searches" || viewSearchTab === "Your searches" || (viewSearchTab === "Starred" && search.starred);
    return matchesQuery && matchesTab;
  });
  const showDefaultView = viewSearchTab === "All searches" && (!normalizedViewQuery || "default view".includes(normalizedViewQuery));

  const activityItems = workspaceSnapshot.notificationsEnabled === false ? [] : [
    ...(workspaceSnapshot.emails || []).filter(email => email.unread && (email.folder || "Inbox") === "Inbox").slice(0, 2).map(record => ({ record, module: "Emails", collection: "emails", title: record.subject, detail: `Unread email · ${record.from}`, icon: Mail })),
    ...(workspaceSnapshot.tasks || []).filter(task => !task.done && task.due === "Today").slice(0, 3).map(record => ({ record, module: "Tasks", collection: "tasks", title: record.title, detail: "Due today", icon: ClipboardList })),
  ];
  const onboardingCompleted = Math.max(0, Math.min(6, (Number(workspaceSnapshot.onboardingCompleted) || 0) + Number(savedPeople.length > 0) - Number(Boolean(workspaceSnapshot.savedPeople?.length))));

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} onClick={() => openMenu && setOpenMenu("")}>
      <input id="apollo-contact-csv" type="file" accept=".csv,text/csv" hidden onChange={importContactsCsv} />
      <aside id="primary-navigation" className={`sidebar ${sidebarOpen ? "mobile-open" : ""}`} role={mobileNavOpen ? "dialog" : "navigation"} aria-label="Primary navigation" aria-modal={mobileNavOpen || undefined} aria-hidden={isMobileNav && !sidebarOpen} inert={isMobileNav && !sidebarOpen} onClick={event => { event.stopPropagation(); if (event.target.closest("a[href]")) setSidebarOpen(false); }}>
        <div className="brand-row">
            <a href="#/home" className="brand-link" aria-label="Apollo home" onClick={() => { setActiveNav("Home"); setActiveModule("Home"); }}><ProspectFinderMark /></a>
          <button className="collapse-sidebar" aria-label={isMobileNav ? "Close navigation" : sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => isMobileNav ? setSidebarOpen(false) : setSidebarCollapsed(value => !value)}>{isMobileNav ? <X size={16} /> : <PanelLeftClose size={16} />}</button>
        </div>
        <div className="side-scroll">
          <div className="top-home-row">
            <a aria-label="Home" title={sidebarCollapsed ? "Home" : undefined} className={`side-link home-link ${activeModule === "Home" ? "active" : ""}`} href="#/home" onClick={() => { setActiveNav("Home"); setActiveModule("Home"); }}><Home size={16} /><span>Home</span></a>
            <button className="side-utility-button" aria-label="Open dialer" title="Open dialer" onClick={() => runGlobalSearch("Calls")}><Phone size={15} /></button>
          </div>
          <a aria-label="AI Assistant" title={sidebarCollapsed ? "AI Assistant" : undefined} className={`side-link top-ai-link ${activeModule === "Assistant" ? "active" : ""}`} href="#/assistant" onClick={() => { setActiveNav("Assistant"); setActiveModule("Assistant"); }}><Sparkles size={16} /><span>AI Assistant</span></a>
          <div className="nav-separator" aria-hidden="true" />
          {navGroups.map(({ title, icon: GroupIcon, items }) => (
            <section className="nav-group" key={title}>
              <button className="nav-group-heading" onClick={() => toggleGroup(title)}><GroupIcon size={16} /><span>{title}</span><ChevronDown className={expandedGroups[title] ? "chevron-up" : ""} size={14} /></button>
              {(expandedGroups[title] || sidebarCollapsed) && <div className="nav-subitems">{items.map(([label, ItemIcon, route], index) => {
                const key = `${title}-${label}-${index}`;
                return <a key={key} aria-label={label} title={sidebarCollapsed ? label : undefined} aria-current={activeNav === key ? "page" : undefined} className={`side-link nav-subitem ${activeNav === key ? "active" : ""}`} href={`#${route}`} onClick={() => { setActiveNav(key); setActiveModule(label); }}><ItemIcon size={15} /><span>{label}</span></a>;
              })}</div>}
            </section>
          ))}
        </div>
        <div className="side-bottom">
          <a className="upgrade-button" href="#/settings/plans/upgrade?source=side_nav_growth_cta&family=Upgrade" onClick={() => notify("Upgrade options are part of Apollo billing")}>Upgrade</a>
          {!onboardingDismissed && <div className="onboarding-card-shell">
            <a className="onboarding-card" href="#/home">
              <span className="onboarding-title">Onboarding hub</span>
              <span className="onboarding-progress"><span className="onboarding-progress-track"><b style={{ width: `${onboardingCompleted / 6 * 100}%` }} /></span><span className="onboarding-completion">{Math.round(onboardingCompleted / 6 * 100)}% Completed</span></span>
            </a>
            <button className="onboarding-dismiss" aria-label="Dismiss onboarding hub" title="Dismiss onboarding hub" onClick={() => setOnboardingDismissed(true)}><X size={15} /></button>
          </div>}
          <a className="side-link" aria-label="Email setup and health" title={sidebarCollapsed ? "Email setup and health" : undefined} href="#/enrichment-status/data-health-center" onClick={() => { setActiveNav("Prospect and enrich-Data enrichment-3"); setActiveModule("Data enrichment"); }}><Mail size={16} /><span>Email setup and health</span></a>
          <a aria-label="Admin Settings" title={sidebarCollapsed ? "Admin Settings" : undefined} className={`side-link ${activeModule === "Settings" ? "active" : ""}`} href="#/settings" onClick={() => { setActiveNav("Settings"); setActiveModule("Settings"); }}><Settings size={16} /><span>Admin Settings</span><ChevronRight size={14} /></a>
        </div>
      </aside>

      <section className="workspace" inert={mobileNavOpen || undefined} onClick={event => event.stopPropagation()}>
        <header className="global-header">
          <button className="mobile-menu-button" aria-label="Open navigation" aria-expanded={mobileNavOpen} aria-controls="primary-navigation" onClick={() => { setSidebarCollapsed(false); setSidebarOpen(value => !value); }}><Menu size={20} /></button>
          <button className="global-search" aria-label="Search workspace" onClick={() => { setGlobalSearchQuery(""); toggleMenu("global-search"); }}><Search size={14} /><span>Search or ask a question in Apollo</span><span className="global-shortcut"><kbd>⌘</kbd><kbd>K</kbd></span></button>
          <div className="header-actions">
            <div className="menu-anchor"><button className="credits-button" aria-label="Apollo API connection status" onClick={event => { event.stopPropagation(); toggleMenu("credits"); }}><Database className="credits-mobile-icon" size={16} /><span>{!apolloStatusLoaded ? "Checking…" : apolloConfigured ? "API key set" : "Demo mode"}</span></button>{openMenu === "credits" && <div className="popover compact-popover" onClick={event => event.stopPropagation()}><strong>Apollo connection</strong><p>{!apolloStatusLoaded ? "Checking the local server…" : apolloConfigured ? "A server-side Apollo API key is configured. People Search, Organization Search, enrichment, and Assistant access are checked when used." : "Searches currently use local sample prospects."}</p><small>{apolloConfigured ? "Feature access is checked when used. Organization Search costs 1 credit per page. This preview does not read your Apollo credit balance or enforce Apollo Assistant credit limits." : "Set APOLLO_API_KEY in .env.local and restart the preview to enable Apollo People Search, Organization Search, enrichment, and Assistant tasks."}</small><button className="outline-button connection-settings-button" onClick={openConnectionSettings}>{apolloConfigured ? "Manage connection" : "Connect Apollo"}</button></div>}</div>
            <button className="assistant-button" aria-label="Open AI Assistant" onClick={() => runGlobalSearch("AI Assistant")}><Sparkles size={16} /><span className="assistant-label">AI Assistant<span className="assistant-button-tail" /></span></button>
            <IconButton className="mobile-extra-icon" title="Open dialer" onClick={() => runGlobalSearch("Calls")}><Phone size={16} /></IconButton>
            <div className="header-utility-group">
              <div className="menu-anchor"><IconButton title="Activity & notifications" aria-expanded={openMenu === "notifications"} onClick={() => toggleMenu("notifications")}><Bell size={16} /></IconButton>{openMenu === "notifications" && <div className="popover wm-notifications" onClick={event => event.stopPropagation()}><header><strong>Workspace activity</strong><IconButton title="Close activity" onClick={() => setOpenMenu("")}><X size={15}/></IconButton></header>{activityItems.map(({ record, module, collection, title, detail, icon: ActivityIcon }) => <button type="button" className="wm-notification-row" key={`${collection}-${title}`} onClick={() => openWorkspaceRecord({ record, module, collection, key: workspaceRecordKey(record) })}><ActivityIcon size={15}/><span><strong>{title}</strong><small>{detail}</small></span></button>)}{!activityItems.length && <p>{workspaceSnapshot.notificationsEnabled === false ? "Workspace notifications are turned off in Admin settings." : "You’re up to date. No unread emails or tasks due today."}</p>}<small>Saved and sample workspace activity</small></div>}</div>
              <IconButton className="mobile-extra-icon" title="Settings" onClick={() => setSettingsOpen(true)}><Settings size={16} /></IconButton>
              <div className="profile-slot"><div className="menu-anchor"><button className="avatar-button" title="Your profile" onClick={event => { event.stopPropagation(); toggleMenu("profile"); }}><span className="avatar-initials">RB</span></button>{openMenu === "profile" && <div className="popover compact-popover profile-popover" onClick={event => event.stopPropagation()}><strong>Robert Berry</strong><button className="outline-button" onClick={() => runGlobalSearch("Settings")}>Account settings</button><small>Local preview workspace</small></div>}</div></div>
            </div>
          </div>
        </header>

        {activeModule === "People" ? <>
        <div className="page-title-row">
          <h1>Find people</h1>
            <div className="menu-anchor"><button className="outline-button" onClick={event => { event.stopPropagation(); toggleMenu("import"); }}>Import <ChevronDown size={14} /></button>{openMenu === "import" && <div className="popover menu-list" onClick={event => event.stopPropagation()}><button onClick={() => { setOpenMenu(""); setManualContact({ name: "", title: "", company: "", email: "", phone: "", linkedinUrl: "", location: "" }); setManualContactDialog(true); }}><UserRound size={15} /> Single contact</button><button onClick={() => { setOpenMenu(""); document.getElementById("apollo-contact-csv")?.click(); }}><FileUp size={15} /> CSV file</button><button onClick={() => { setOpenMenu(""); exportContactsCsv(); }}><Download size={15} /> {showingSavedPeople ? "Export saved contacts" : showingResults ? "Export current results" : "Export saved contacts"}</button></div>}</div>
        </div>

        <div className="toolbar-row">
          <div className="toolbar-primary-group">
            <div className="menu-anchor view-anchor">
              <button className="view-button" aria-expanded={openMenu === "views"} onClick={event => { event.stopPropagation(); toggleMenu("views"); }}><LayoutGrid size={16} /><span>{savedSearchName || "Default view"}</span><ChevronDown size={13} /></button>
              {openMenu === "views" && <div className="popover views-popover" onClick={event => event.stopPropagation()}>
                <div className="view-search"><Search size={15} /><input value={viewSearchQuery} onChange={event => setViewSearchQuery(event.target.value)} placeholder="Search..." aria-label="Search saved views" /></div>
                <div className="view-tabs">{["All searches", "Your searches", "Starred", "Assigned to you", "Shared"].map(tab => <button key={tab} className={viewSearchTab === tab ? "selected" : ""} aria-pressed={viewSearchTab === tab} onClick={() => setViewSearchTab(tab)}>{tab}</button>)}</div>
                <div className="view-results-list">
                  {showDefaultView && <button className={`view-result ${activeSearchId === "default" ? "active" : ""}`} onClick={() => restoreSavedSearch(null)}><LayoutGrid size={15} />Default view<span>System</span></button>}
                  {visibleSavedSearches.map(search => <div className="saved-view-row" key={search.id}>
                    <button className={`view-result ${activeSearchId === search.id ? "active" : ""}`} onClick={() => restoreSavedSearch(search)}><LayoutGrid size={15} /><span className="saved-view-name">{search.name}</span><small>You</small></button>
                    <IconButton className="saved-search-star" title={search.starred ? `Unstar ${search.name}` : `Star ${search.name}`} aria-label={search.starred ? `Unstar ${search.name}` : `Star ${search.name}`} aria-pressed={Boolean(search.starred)} onClick={() => toggleSavedSearchStar(search.id)}><Star size={14} fill={search.starred ? "currentColor" : "none"} /></IconButton>
                  </div>)}
                  {!showDefaultView && visibleSavedSearches.length === 0 && <p className="view-empty">No saved searches found.</p>}
                </div>
                <button className="create-saved" onClick={() => { setOpenMenu(""); setSearchNameInput(""); setSaveDialog(true); }}>Create saved search</button>
              </div>}
            </div>
            <button className="toolbar-filter-toggle" onClick={() => setShowFilters(value => !value)}><SlidersHorizontal size={14} />{showFilters ? "Hide Filters" : "Show Filters"}</button>
          </div>
          <label className="people-search"><span className="people-search-icon"><Search size={18} /></span><span className="people-search-field"><input className="people-search-input" placeholder="Search people" value={searchText} onChange={event => setSearchText(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); runPeopleSearch(null, { searchText: event.currentTarget.value }); } }} /></span><kbd>↵</kbd></label>
          <div className="toolbar-actions">
            {filteredProspects.some(person => selectedPeople.includes(person.id || person.name)) && <button className="outline-button" onClick={() => { const lists = readWorkspaceLists(); setWorkspaceLists(lists); setSelectedList(lists[0]?.name || "new"); setNewListName(""); setListDialog(true); }}><Plus size={14} />Add to list</button>}
            <div className="menu-anchor research-anchor"><button className="outline-button research-button" onClick={event => { event.stopPropagation(); toggleMenu("research"); }}><Sparkles size={14} /> Research with AI <ChevronDown size={13} /></button>{openMenu === "research" && <div className="popover menu-list" onClick={event => event.stopPropagation()}>{["Run custom AI prompt", "Generate AI formula", "Use Apollo Assistant", "Start with a template"].map((item, index) => <button key={item} onClick={() => { setOpenMenu(""); if (item === "Generate AI formula") { if (!apolloConfigured) notify("Connect Apollo to generate AI formulas with Apollo Assistant."); else { const selectedContacts = filteredProspects.filter(person => selectedPeople.includes(person.id || person.name)); const references = selectedContacts.map(person => `${person.name}${person.role ? ` (${person.role}` : ""}${person.role && person.company ? " at " : ""}${person.company || ""}${person.role ? ")" : ""}`); openAssistantWithPrompt(references.length ? `Help me generate an AI formula for these selected contacts: ${references.join(", ")}. First ask what outcome I need, then propose the formula for review before making any account changes.` : "Help me generate an AI formula for my prospect data. First ask what outcome I need, then propose the formula for review before making any account changes."); } } else if (item === "Run custom AI prompt") { if (!apolloConfigured) notify("Connect Apollo to run custom AI research prompts."); else { const selectedContacts = filteredProspects.filter(person => selectedPeople.includes(person.id || person.name)); const references = selectedContacts.map(person => `${person.name}${person.role ? ` (${person.role}` : ""}${person.role && person.company ? " at " : ""}${person.company || ""}${person.role ? ")" : ""}`); openAssistantWithPrompt(references.length ? `Run custom AI research with Apollo on these selected contacts: ${references.join(", ")}. Ask what I want to learn and which reusable research field or output format to use before proceeding.` : "Help me run custom AI research with Apollo. Ask which people or companies to research, what I want to learn, and whether to save the result to a reusable research field."); } } else if (item === "Start with a template") { setSelectedResearchTemplate("background"); setResearchTemplateDialog(true); } else { const selectedNames = filteredProspects.filter(person => selectedPeople.includes(person.id || person.name)).map(person => person.name); openAssistantWithPrompt(selectedNames.length ? `Find and summarize these selected contacts: ${selectedNames.join(", ")}` : "Find and summarize relevant contacts in my workspace"); } }}>{index === 0 ? <Sparkles size={15} /> : index === 1 ? <Zap size={15} /> : index === 2 ? <Users size={15} /> : <Folder size={15} />}{item}</button>)}</div>}</div>
            <div className="menu-anchor workflow-anchor"><button className="outline-button" onClick={event => { event.stopPropagation(); toggleMenu("workflow"); }}><Zap size={14} /> Create workflow <ChevronDown size={13} /></button>{openMenu === "workflow" && <div className="popover menu-list" onClick={event => event.stopPropagation()}>{[["Create follow-up tasks", "Create follow-up task"], ["Add contacts to a list", "Add contact to a list"], ["Enroll contacts in a sequence", "Enroll contact in a sequence"], ["Create from scratch", ""]].map(([label, action]) => <button key={label} onClick={() => { setOpenMenu(""); action ? openWorkflowTemplate(action) : runGlobalSearch("Workflows"); }}><Workflow size={15} />{label}</button>)}</div>}</div>
            <button className="outline-button save-search" onClick={() => { setSearchNameInput(""); setSaveDialog(true); }}>Save as new search</button>
            <div className="menu-anchor sort-anchor"><button className="sort-button" onClick={event => { event.stopPropagation(); toggleMenu("sort"); }}><ArrowDownUp size={16} /> {sortField} <ChevronDown size={13} /></button>{openMenu === "sort" && <div className="popover sort-popover" onClick={event => event.stopPropagation()}><span>Sort by</span><select value={sortField} onChange={event => setSortField(event.target.value)}><option>Relevance</option><option>First name</option><option>Last name</option><option>Company</option><option>Location</option><option>Created date</option></select><select value={sortDirection} onChange={event => setSortDirection(event.target.value)}><option>Descending</option><option>Ascending</option></select><button onClick={() => setOpenMenu("")}>Apply</button></div>}</div>
            <button className="outline-button settings-button" onClick={() => setSettingsOpen(true)}><Settings size={16} /> Search settings</button>
          </div>
        </div>

        <div className={`people-workspace ${showFilters ? "" : "filters-hidden"}`}>
          {showFilters && <aside className="filter-panel">
            <div className="count-tabs"><div className="count-tabs-segment" role="tablist" aria-label="People list">{[["Total", apolloConfigured ? liveProspects ? liveTotal.toLocaleString() : "—" : sampleProspects.length], ["Net New", apolloConfigured ? liveProspects ? liveTotal.toLocaleString() : "—" : sampleProspects.filter(person => !savedPeople.some(saved => saved.id === person.id || saved.name === person.name)).length], ["Saved", savedPeople.length]].map(([label, count], index) => <button key={label} id={`people-tab-${index}`} role="tab" aria-selected={activeCountTab === label} aria-controls="people-results" tabIndex={activeCountTab === label ? 0 : -1} className={activeCountTab === label ? "count-tab selected" : "count-tab"} onClick={() => setActiveCountTab(label)} onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const tabs = Array.from(event.currentTarget.parentElement.querySelectorAll('[role="tab"]')); const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; tabs[nextIndex].focus(); tabs[nextIndex].click(); }}><span className="count-tab-content"><span className="count-tab-label">{label}</span><span className="count-tab-badge-row"><small className="count-tab-badge">{count}</small></span></span></button>)}</div></div>
            <div className="accordion-list">
              <section className={`filter-accordion ${openFilter === "Job Titles" ? "expanded" : ""}`}><button className="accordion-trigger" onClick={() => setOpenFilter(openFilter === "Job Titles" ? "" : "Job Titles")}><BriefcaseBusiness size={16} /><span>Job Titles{titleValue && <small className="filter-chip">{titleValue}</small>}</span><ChevronDown size={14} /></button>{openFilter === "Job Titles" && <div className="accordion-content"><div className="mode-toggle"><button className={!advancedTitles ? "selected" : ""} onClick={() => setAdvancedTitles(false)}>Simple</button><button className={advancedTitles ? "selected" : ""} onClick={() => setAdvancedTitles(true)}>Advanced</button></div>{advancedTitles ? <><div className="known-row">{[["known", "Is known"], ["unknown", "Is unknown"]].map(([value, label]) => <button key={value} className={jobTitleKnowledge === value ? "selected" : ""} aria-pressed={jobTitleKnowledge === value} onClick={() => setJobTitleKnowledge(current => current === value ? "any" : value)}>{label}</button>)}</div><FilterField label="Job titles" placeholder="Search job titles" value={titleValue} onChange={event => setTitleValue(event.target.value)} /><p className="field-hint">Include people with any of these job titles.</p></> : <><FilterField label="Include" placeholder="Add job titles" value={titleValue} onChange={event => setTitleValue(event.target.value)} hint="Use exact match to find specific titles." /><label className="check-line"><input type="checkbox" checked={includeSimilarTitles} onChange={event => setIncludeSimilarTitles(event.target.checked)} /> Include similar titles</label><FilterField label="Exclude" placeholder="Add titles to exclude" value={excludedTitleValue} onChange={event => setExcludedTitleValue(event.target.value)} /></>}<details><summary>Past job titles <ChevronDown size={13} /></summary><FilterField label="Include past titles" placeholder="Add past titles" value={pastTitleValue} onChange={event => setPastTitleValue(event.target.value)} /><FilterField label="Exclude past titles" placeholder="Add past titles to exclude" value={excludedPastTitleValue} onChange={event => setExcludedPastTitleValue(event.target.value)} /></details><details><summary>Management Level <ChevronDown size={13} /></summary><div className="option-grid">{managementLevels.map(item => <label key={item}><input type="checkbox" checked={selectedManagementLevels.includes(item)} onChange={event => { const checked = event.target.checked; setSelectedManagementLevels(current => checked ? [...current, item] : current.filter(value => value !== item)); }} />{item}</label>)}</div></details><details><summary>Departments &amp; Job Function <ChevronDown size={13} /></summary><div className="option-grid">{departments.map(item => <label key={item}><input type="checkbox" checked={selectedDepartments.includes(item)} onChange={event => { const checked = event.target.checked; setSelectedDepartments(current => checked ? [...current, item] : current.filter(value => value !== item)); }} />{item}</label>)}</div></details><button className="persona-button" onClick={openPersonaBuilder}>Create New Persona</button>{savedPersonas.length>0&&<div className="persona-saved-list"><small>Saved personas</small>{savedPersonas.map(persona=><div className="persona-saved-row" key={persona.id}><button onClick={()=>applyPersona(persona)}>{persona.name}</button><button aria-label={`Delete persona ${persona.name}`} title={`Delete ${persona.name}`} onClick={()=>deletePersona(persona.id)}><X size={12}/></button></div>)}</div>}<small className="persona-hint">Personas reuse job title, industry, location, and company-size filters saved in this browser.</small></div>}</section>
              <section className="filter-accordion locked"><button className="accordion-trigger" onClick={() => notify("People Lookalikes is an advanced Apollo feature")}><Users size={16} /><span>People Lookalikes</span><LockKeyhole size={13} /></button></section>
              <section className={`filter-accordion ${openFilter === "Company" ? "expanded" : ""}`}><button className="accordion-trigger" onClick={() => setOpenFilter(openFilter === "Company" ? "" : "Company")}><Building2 size={16} /><span>Company{companyValue && <small className="filter-chip">{companyValue}</small>}</span><ChevronDown size={14} /></button>{openFilter === "Company" && <div className="accordion-content"><h4>Specific companies</h4><div className="radio-line"><label><input type="radio" name="company-mode" checked={companyMode === "current"} onChange={() => setCompanyMode("current")} /> Current company</label><label><input type="radio" name="company-mode" checked={companyMode === "past"} onChange={() => setCompanyMode("past")} /> Past company</label></div><FilterField label="Is any of" placeholder="Search companies" value={companyValue} onChange={event => setCompanyValue(event.target.value)} /><button className="add-field" onClick={() => setCompanyValue(value => value ? `${value}, ` : "")}>+ Add another company</button><FilterField label="Company domains" placeholder="example.com, acme.io" value={companyDomains} onChange={event => setCompanyDomains(event.target.value)} hint="Match people associated with any listed employer domain." /><FilterField label="Exclude company domains" placeholder="competitor.com" value={excludedCompanyDomains} onChange={event => setExcludedCompanyDomains(event.target.value)} hint="Apollo excludes every known domain for a matching company." /><label className="check-line"><input type="checkbox" checked={companyDomainOnly} onChange={event => setCompanyDomainOnly(event.target.checked)} /> Only show companies with a known domain</label><details open={companyAttributesOpen} onToggle={event => setCompanyAttributesOpen(event.currentTarget.open)}><summary>Company attributes <ChevronDown size={13} /></summary><div className="company-attribute-fields"><FilterField label="Employee count ranges" placeholder="1-50; 51-200" value={companySizeRanges} onChange={event => setCompanySizeRanges(event.target.value)} hint="Separate multiple ranges with semicolons." /><div className="revenue-range-fields"><FilterField label="Revenue from ($)" placeholder="Minimum" type="number" min="0" value={revenueMinimum} onChange={event => setRevenueMinimum(event.target.value)} /><FilterField label="Revenue to ($)" placeholder="Maximum" type="number" min="0" value={revenueMaximum} onChange={event => setRevenueMaximum(event.target.value)} /></div><FilterField label="Technologies used" placeholder="Salesforce, HubSpot" value={technologyValue} onChange={event => setTechnologyValue(event.target.value)} hint="Match companies using any listed technology." /><div className="revenue-range-fields"><FilterField label="Active jobs from" placeholder="Minimum" type="number" min="0" value={activeJobsMinimum} onChange={event => setActiveJobsMinimum(event.target.value)} /><FilterField label="Active jobs to" placeholder="Maximum" type="number" min="0" value={activeJobsMaximum} onChange={event => setActiveJobsMaximum(event.target.value)} /></div><FilterField label="Titles in active job postings" placeholder="Sales manager, analyst" value={activeJobTitles} onChange={event => setActiveJobTitles(event.target.value)} /><FilterField label="Active job locations" placeholder="New York, Remote" value={activeJobLocations} onChange={event => setActiveJobLocations(event.target.value)} /><div className="revenue-range-fields"><FilterField label="Jobs posted after" type="date" value={jobPostedAfter} onChange={event => setJobPostedAfter(event.target.value)} /><FilterField label="Jobs posted before" type="date" value={jobPostedBefore} onChange={event => setJobPostedBefore(event.target.value)} /></div></div></details></div>}</section>
              <section className={`filter-accordion ${openFilter === "Location" ? "expanded" : ""}`}><button className="accordion-trigger" onClick={() => setOpenFilter(openFilter === "Location" ? "" : "Location")}><MapPin size={16} /><span>Location{locationValue && <small className="filter-chip">{locationValue}</small>}</span><ChevronDown size={14} /></button>{openFilter === "Location" && <div className="accordion-content"><div className="mode-toggle"><button className={!accountHq ? "selected" : ""} onClick={() => setAccountHq(false)}>Contact</button><button className={accountHq ? "selected" : ""} onClick={() => setAccountHq(true)}>Account HQ</button></div><FilterField label={accountHq ? "Headquarters" : "Include locations"} placeholder="City, state, country or ZIP" value={locationValue} onChange={event => setLocationValue(event.target.value)} /><FilterField label="Exclude locations" placeholder="Search locations" value={excludedLocationValue} onChange={event => setExcludedLocationValue(event.target.value)} /><label className="field-block"><span>Radius</span><select value={locationRadius} onChange={event => setLocationRadius(event.target.value)}><option>Any distance</option><option>10 miles</option><option>25 miles</option><option>50 miles</option><option>100 miles</option></select></label>{accountHq && <small className="field-hint">Apollo searches company headquarters when Account HQ is selected.</small>}</div>}</section>
              <section className={`filter-accordion ${openFilter === "Industry & Keywords" ? "expanded" : ""}`}><button className="accordion-trigger" onClick={() => setOpenFilter(openFilter === "Industry & Keywords" ? "" : "Industry & Keywords")}><Building2 size={16} /><span>Industry &amp; Keywords{keywordValue && <small className="filter-chip">{keywordValue}</small>}</span><ChevronDown size={14} /></button>{openFilter === "Industry & Keywords" && <div className="accordion-content"><FilterField label="Search industries" placeholder="Add industries" value={industryValue} onChange={event => setIndustryValue(event.target.value)} /><details open><summary>Company Keywords <ChevronDown size={13} /></summary><FilterField label="Include keywords" placeholder="Enter keywords" value={keywordValue} onChange={event => setKeywordValue(event.target.value)} /><FilterField label="Exclude keywords" placeholder="Enter keywords to exclude" value={excludedKeywordValue} onChange={event => setExcludedKeywordValue(event.target.value)} /><label className="field-block"><span>Type of Keywords</span><select value={keywordType} onChange={event => setKeywordType(event.target.value)}><option>Name</option><option>Keywords</option><option>Company description</option></select></label></details><details><summary>Advanced settings <ChevronDown size={13} /></summary><div className="known-row">{[["not-any-of", "Is not any of"], ["known", "Is known"], ["unknown", "Is unknown"]].map(([value, label]) => <button key={value} className={industryKnowledge === value ? "selected" : ""} aria-pressed={industryKnowledge === value} onClick={() => setIndustryKnowledge(value)}>{label}</button>)}</div><FilterField label="Exclude industries" placeholder="Search industries to exclude" value={excludedIndustryValue} onChange={event => setExcludedIndustryValue(event.target.value)} /></details></div>}</section>
            </div>
            <div className="filter-footer"><button className="clear-button" disabled={!activeFilterCount} onClick={clearFilters}><span>Clear all</span></button><button className="outline-button view-filters-button" onClick={() => { setPendingModalSelected(modalSelected); setFiltersModal(true); }}>View 60+ Filters</button></div>
          </aside>}

          <main id="people-results" role="tabpanel" aria-labelledby={`people-tab-${["Total", "Net New", "Saved"].indexOf(activeCountTab)}`} className={`main-stage ${showingResults ? "results-mode" : ""}`}>
            {showingResults ? <div className="results-view"><div className="results-heading"><div><div className="eyebrow">{showingSavedPeople ? "Saved people" : resultProvider === "apollo" ? "Apollo people search" : "Demo prospect search"}</div><h2>{showingSavedPeople ? "Your saved people" : "People matching your search"}</h2>{!showingSavedPeople && <p>“{submittedPrompt}” <span>· {resultProvider === "apollo" ? "Live Apollo data" : `Sample pool · ${sampleProspects.length} contacts`}</span></p>}</div><div className="results-heading-actions">{!showingSavedPeople && <button className="apply-filters" disabled={searchLoading} onClick={() => runPeopleSearch(null, { page: 1, prompt: aiPrompt, allowEmpty: true })}>Apply filters</button>}<button className="outline-button" onClick={() => { setActiveCountTab("Total"); if (!showingSavedPeople) { setSubmittedPrompt(""); setAiPrompt(""); } }}>Back to search</button></div></div>{resultProvider === "demo" && !showingSavedPeople && <div className="data-connection-note">Demo mode · Showing a local sample of {sampleProspects.length} contacts. Connect Apollo to search live.</div>}{resultProvider === "demo" && !showingSavedPeople && selectedQuick.some(value => emailStatusQuickFilters.has(value)) && <div className="search-limitation">Email status filters are not applied to sample contacts. Connect Apollo to apply them.</div>}{searchError && <div className="search-error" role="alert">{searchError}</div>}{resultProvider === "apollo" && !showingSavedPeople && <div className="data-connection-note">Apollo People API Search · emails and phone numbers are not included in this endpoint.</div>}{searchLimitations.map((limitation, index) => <div className="search-limitation" key={`${index}-${limitation}`}>{limitation}</div>)}<div className="results-toolbar" role="status" aria-live="polite"><strong>{resultProvider === "apollo" && !showingSavedPeople ? `${liveTotal.toLocaleString()} ${liveTotal === 1 ? "person" : "people"}` : `${filteredProspects.length} ${filteredProspects.length === 1 ? "person" : "people"}`}</strong><span>{showingSavedPeople ? "Saved in this browser" : resultProvider === "apollo" ? "People API Search returns net-new prospects" : "Matching local sample records"}</span></div><div className={`table-wrap${showingSavedPeople ? " saved-contacts-table" : ""}`}><table><thead><tr><th><input type="checkbox" aria-label="Select all visible people" checked={filteredProspects.length > 0 && filteredProspects.every(person => selectedPeople.includes(person.id || person.name))} onChange={event => { const visibleIds = filteredProspects.map(person => person.id || person.name); setSelectedPeople(current => event.target.checked ? [...new Set([...current, ...visibleIds])] : current.filter(id => !visibleIds.includes(id))); }} /></th><th>Name</th><th>Company</th><th>Location</th><th>Email</th>{showingSavedPeople && <><th>Phone</th><th>LinkedIn</th></>}<th>Actions</th></tr></thead><tbody>{filteredProspects.map(person => { const isSaved = savedPeople.some(saved => saved.id === person.id || saved.name === person.name); const rowId = person.id || person.name; const promptMatchFields = resultProvider === "demo" && !showingSavedPeople ? demoPromptMatchFields(person, submittedPrompt) : []; const phoneHref = contactPhoneHref(person.phone); const linkedinHref = normalizeLinkedInUrl(person.linkedinUrl); return <tr key={rowId}><td><input type="checkbox" checked={selectedPeople.includes(rowId)} onChange={() => setSelectedPeople(current => current.includes(rowId) ? current.filter(id => id !== rowId) : [...current, rowId])} aria-label={`Select ${person.name}`} /></td><td><div className="person-cell"><span className={`person-avatar ${person.color}`}>{person.initials}</span><div><strong>{person.name}</strong><small>{person.role}</small>{promptMatchFields.length > 0 && <small className="person-match-reasons">Matches prompt in: {promptMatchFields.join(" · ")}</small>}</div></div></td><td><strong>{person.company}</strong></td><td>{person.location}</td><td>{person.email ? <div className="email-cell"><EmailStatusPill status={person.status} />{isPlaceholderEmail(person.email) ? <span className="email-placeholder" title="Sample address; not deliverable" aria-label={`${person.email}, sample address not deliverable`}>{person.email}</span> : <a href={`mailto:${person.email}`}>{person.email}</a>}</div> : <div className="email-cell"><EmailStatusPill status={person.status} />{person.source === "apollo" && person.canEnrich && !person.enrichmentAttempted && <button className="row-action enrich-action" onClick={() => openPersonEnrichment(person)}>Find email</button>}{person.enrichmentAttempted && <small>No email found</small>}</div>}</td>{showingSavedPeople && <><td>{phoneHref ? <a className="contact-channel-link" href={phoneHref}>{person.phone}</a> : person.phone || "Unavailable"}</td><td>{linkedinHref ? <a className="contact-channel-link" href={linkedinHref} target="_blank" rel="noreferrer">Open profile</a> : person.linkedinUrl ? "Check URL" : "Unavailable"}</td></>}<td><button className="row-action" aria-pressed={isSaved} aria-label={isSaved ? `Remove ${person.name} from saved people` : `Save ${person.name}`} onClick={() => toggleSavedPerson(person)}>{isSaved ? <Check size={15} /> : <Plus size={15} />}{isSaved ? "Saved" : "Save"}</button></td></tr>; })}</tbody></table>{searchLoading && <div className="empty-results">Searching Apollo…</div>}{!searchLoading && filteredProspects.length === 0 && <div className="empty-results">{searchError ? "Search did not complete." : showingSavedPeople ? "You haven’t saved any people yet." : "No prospects match this search."}<button type="button" className="outline-button" onClick={() => { clearFilters(); setActiveCountTab("Total"); setSubmittedPrompt(""); setAiPrompt(""); }}>Start a new search</button></div>}</div>{resultProvider === "apollo" && !showingSavedPeople && (liveHasMore || searchPage > 1) && <div className="results-pagination"><span>Page {searchPage} · {liveTotal.toLocaleString()} matches</span><label className="page-size-control">Rows per page <select aria-label="Rows per page" value={resultsPerPage} onChange={event => runPeopleSearch(null, { page: 1, perPage: Number(event.target.value), allowEmpty: true })}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label><div><button className="outline-button" disabled={searchPage <= 1 || searchLoading} onClick={() => runPeopleSearch(null, { page: searchPage - 1 })}>Previous</button><button className="outline-button" disabled={!liveHasMore || searchLoading} onClick={() => runPeopleSearch(null, { page: searchPage + 1 })}>Next</button></div></div>}</div> : <div className="ai-search-card-wrap">
              <div className="ai-search-intro">
                <div className="ai-search-heading"><h2>Describe the prospects you want to find</h2></div>
                <form role="search" aria-label="Find people" className={`ai-prompt-form${aiPrompt.trim() ? " has-prompt" : ""}`} onSubmit={submitPrompt}><span className="ai-prompt-icon"><Sparkles size={18} /></span><span className="ai-prompt-field"><input value={aiPrompt} onChange={event => setAiPrompt(event.target.value)} placeholder="Example: SaaS sales leaders" aria-label="Describe the prospects you want to find" autoComplete="off" enterKeyHint="search" /></span><button type="submit" aria-label="Search prospects"><ChevronRight size={16} /></button></form>
              </div>
              <section className="quick-filters-card"><div className="quick-filters-content"><h3>Quick filters</h3><div className="quick-grid">{quickFilters.map(group => <div className="quick-group" id={group.label === "Email Status" ? "quick-email-status" : undefined} key={group.label}><h4>{group.label}</h4><div className="quick-chips">{group.items.map(item => { const unavailable = group.label === "Email Status" && !apolloConfigured; const selected = selectedQuick.includes(item); return <button key={item} type="button" disabled={unavailable} aria-pressed={selected} aria-describedby={unavailable ? "email-status-demo-note" : undefined} title={unavailable ? "Connect Apollo to filter by email status." : undefined} className={`quick-chip ${selected ? "selected" : ""}`} onClick={() => toggleQuick(item)}>{selected && <Check size={11} />}<span>{item}</span></button>; })}</div>{group.label === "Email Status" && !apolloConfigured && <p className="quick-filter-note" id="email-status-demo-note" role="note">Connect Apollo to apply email status filters. Sample addresses are placeholders.</p>}</div>)}</div></div><div className="advanced-lock-row"><div className="advanced-lock-content"><div className="advanced-lock-main"><span className="lock-tile"><LockKeyhole size={15} /></span><div className="advanced-lock-copy"><span className="advanced-lock-label">Unlock advanced filters:</span><div className="advanced-lock-options"><button onClick={() => notify("Revenue is an advanced Apollo filter")}><DollarSign size={13} />Revenue</button><button onClick={() => notify("Funding is an advanced Apollo filter")}><Database size={13} />Funding</button><button onClick={() => notify("Company Lookalikes is an advanced Apollo filter")}><Building2 size={13} />Company Lookalikes</button></div></div></div><a className="upgrade-cta" href="#/settings/plans/upgrade?upgradeOrigin=advanced_filters">View plans</a></div></div></section>
            </div>}
          </main>
        </div>
        </> : <Suspense fallback={<div className="module-loading" role="status">Loading workspace…</div>}><WorkspaceModules module={activeModule} onNavigate={label => runGlobalSearch(label === "People" ? "Find people" : label)} onSearchPeople={searchPeopleFromAssistant} onFindCompanyPeople={searchPeopleAtCompany} onEnrichPerson={openPersonEnrichment} navigationRequest={navigationRequest} onNavigationHandled={requestId => setNavigationRequest(current => current?.requestId === requestId ? null : current)} onWorkspaceChange={setWorkspaceSnapshot} onHelp={() => setOpenMenu("help")} apolloConfigured={apolloConfigured} apolloConnectionSource={apolloKeySource} onApolloConnectionChange={status => { setApolloConfigured(Boolean(status?.configured)); setApolloKeySource(status?.source || null); }} notify={notify} /></Suspense>}
        {activeModule === "People" && <button className="help-launcher" aria-label="Help" onClick={() => setOpenMenu("help")}><CircleHelp size={26} /></button>}
      </section>

      {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}

      {openMenu === "help" && <div className="modal-backdrop" onClick={() => setOpenMenu("")}><section className="save-dialog" role="dialog" aria-modal="true" aria-label="Workspace help" onClick={event => event.stopPropagation()}><header><div><h3>Get more from your workspace</h3><p>Find a record, prepare your next conversation, or connect Apollo.</p></div><IconButton title="Close help" onClick={() => setOpenMenu("")}><X size={17}/></IconButton></header><div className="workspace-help-actions"><button className="outline-button" onClick={() => { setGlobalSearchQuery(""); setOpenMenu("global-search"); }}><Search size={15}/>Search across your workspace <kbd>⌘ K</kbd></button><button className="outline-button" onClick={() => openAssistantWithPrompt("Help me choose the next best action from my open tasks, upcoming meetings, and deal records.")}><Sparkles size={15}/>Ask Luna for the next step</button><button className="outline-button" onClick={openConnectionSettings}><Database size={15}/>{apolloConfigured ? "Manage Apollo connection" : "Connect your Apollo account"}</button></div><p className="workspace-help-note">Luna supports multi-line prompts. Press Enter to send, or Shift + Enter for a new line. Use Escape to close a dialog.</p></section></div>}

      {openMenu === "global-search" && <CommandSearch query={globalSearchQuery} onQueryChange={setGlobalSearchQuery} snapshot={{ ...workspaceSnapshot, ...readWorkspaceSnapshot(), savedPeople }} people={workspaceSnapshot.people || sampleProspects} pages={globalQuickLinks} onNavigate={runGlobalSearch} onRecord={openWorkspaceRecord} onAskLuna={openAssistantWithPrompt} onClose={() => setOpenMenu("")} />}

      {settingsOpen && <div className="drawer-scrim" onClick={() => setSettingsOpen(false)}><aside className="settings-drawer" onClick={event => event.stopPropagation()}><header><h3>Search settings</h3><IconButton title="Close drawer" onClick={() => setSettingsOpen(false)}><X size={17} /></IconButton></header><h4>Fields</h4><button className="drawer-row"><ListFilter size={16} /><span>Fields</span><small>14</small><ChevronRight size={14} /></button><h4>Applied filters</h4><button className="drawer-row"><Filter size={16} /><span>Filters</span><small>{activeFilterCount}</small><ChevronRight size={14} /></button></aside></div>}

      {filtersModal && <div className="modal-backdrop" onClick={() => { setPendingModalSelected(modalSelected); setFiltersModal(false); }}><section className="filters-dialog" onClick={event => event.stopPropagation()}><header className="filters-modal-header"><div><h2>Search filters</h2><span>Find the right people with more than 60 filters</span></div><IconButton title="Close filters" onClick={() => { setPendingModalSelected(modalSelected); setFiltersModal(false); }}><X size={18} /></IconButton></header><div className="modal-search-row"><div className="modal-filter-search"><Search size={15} /><input value={filterModalQuery} onChange={event => setFilterModalQuery(event.target.value)} placeholder="Search filters" /></div><button className="type-select" onClick={() => toggleMenu("filter-type")}>Type: All <ChevronDown size={13} /></button>{openMenu === "filter-type" && <div className="filter-type-menu">{["All", "Person Info", "Company Info", "Engagement Activity", "Conversation", "Created Source", "Misc"].map(item => <button key={item} onClick={() => { setModalCategory(item); setOpenMenu(""); }}>{item}</button>)}</div>}</div><div className="filters-dialog-body"><aside className="pinned-filters"><h4>Pinned filters</h4><button onClick={() => setModalCategory("Person Info")}><UserRound size={14} /> Person Info</button><button onClick={() => setModalCategory("Company Info")}><Building2 size={14} /> Company Info</button><button onClick={() => setModalCategory("Engagement Activity")}><Activity size={14} /> Engagement Activity</button><button onClick={() => setModalCategory("All")}><Star size={14} /> All filters</button></aside><div className="filter-categories">{filterCategories.map(({ name, count, icon: CategoryIcon, items }) => <section className="modal-category" key={name}><button className="modal-category-heading" onClick={() => setModalCategory(modalCategory === name ? "All" : name)}><CategoryIcon size={16} /><span>{name}</span><small>{count}</small><ChevronDown size={14} /></button>{(modalCategory === "All" || modalCategory === name) && <div className="modal-filter-grid">{items.filter(item => matchesModalFilter(item, name)).map(item => { const unavailable = item === "Email Status" && !apolloConfigured; const selected = pendingModalSelected.includes(item); return <button key={item} type="button" disabled={unavailable} aria-pressed={selected} aria-describedby={unavailable ? "email-status-modal-note" : undefined} className={`${selected ? "selected " : ""}${unavailable ? "unavailable" : ""}`} onClick={() => toggleModalFilter(item)}>{selected && <Check size={13} />}{item}<Plus size={13} /></button>; })}{items.includes("Email Status") && (!filterModalQuery || "Email Status".toLowerCase().includes(filterModalQuery.toLowerCase())) && !apolloConfigured && <p className="filter-unavailable-note" id="email-status-modal-note" role="note">Connect Apollo to apply email status filters. Sample addresses are placeholders.</p>}</div>}</section>)}</div></div><footer className="filters-modal-footer"><span>{pendingModalSelected.length ? `${pendingModalSelected.length} filter${pendingModalSelected.length > 1 ? "s" : ""} selected` : "Showing filters for people"}</span><div><button className="clear-button" onClick={() => setPendingModalSelected([])}>Clear all</button><button className="apply-filters" onClick={applyAdvancedFilters}>Apply Filters</button></div></footer></section></div>}

      {enrichmentTarget && <div className="modal-backdrop" onClick={() => { if (!enrichmentLoading) setEnrichmentTarget(null); }}><section className="save-dialog" role="dialog" aria-modal="true" aria-labelledby="enrich-person-title" onClick={event => event.stopPropagation()}><header><div><h3 id="enrich-person-title">Find contact email</h3><p>{enrichmentTarget.name} · {enrichmentTarget.company}</p></div><IconButton title="Close enrichment dialog" onClick={() => { if (!enrichmentLoading) setEnrichmentTarget(null); }}><X size={17} /></IconButton></header><p className="enrichment-credit-note">Apollo enrichment may use 1–9 credits per person, depending on the data returned. This lookup leaves personal-email and phone enrichment off.</p>{enrichmentResult && <div className="enrichment-result" role="status">{enrichmentResult}</div>}{enrichmentError && <div className="search-error" role="alert">{enrichmentError}</div>}<div className="dialog-actions">{!enrichmentLoading && <button type="button" className="outline-button" onClick={() => setEnrichmentTarget(null)}>{enrichmentResult || enrichmentError ? "Close" : "Cancel"}</button>}{!enrichmentResult && !enrichmentError && <button type="button" className="apply-filters" disabled={!apolloConfigured || enrichmentLoading} onClick={enrichPersonEmail}>{enrichmentLoading ? "Checking Apollo…" : "Enrich email"}</button>}</div></section></div>}
      {personaDialog && <div className="modal-backdrop" onClick={() => setPersonaDialog(false)}><section className="save-dialog" role="dialog" aria-modal="true" aria-labelledby="persona-dialog-title" onClick={event => event.stopPropagation()}><header><div><h3 id="persona-dialog-title">Create a persona</h3><p>Save reusable prospect criteria in this browser.</p></div><IconButton title="Close persona dialog" onClick={() => setPersonaDialog(false)}><X size={17} /></IconButton></header><form className="save-search-form" onSubmit={savePersona}><label className="field-block"><span>Persona name</span><input autoFocus required placeholder="SaaS sales leaders" value={personaDraft.name} onChange={event => setPersonaDraft(current => ({ ...current, name: event.target.value }))} /></label><label className="field-block"><span>Job titles</span><input placeholder="VP of Sales, CRO" value={personaDraft.titles} onChange={event => setPersonaDraft(current => ({ ...current, titles: event.target.value }))} /></label><label className="field-block"><span>Industry</span><input placeholder="Software, Information Technology" value={personaDraft.industry} onChange={event => setPersonaDraft(current => ({ ...current, industry: event.target.value }))} /></label><div className="wm-form-row"><label className="field-block"><span>Location</span><input placeholder="United States, New York" value={personaDraft.location} onChange={event => setPersonaDraft(current => ({ ...current, location: event.target.value }))} /></label><label className="field-block"><span>Company size</span><input placeholder="51-200, 201-500" value={personaDraft.companySize} onChange={event => setPersonaDraft(current => ({ ...current, companySize: event.target.value }))} /></label></div><small className="field-hint">This stores filter criteria only. Applying a persona replaces the current prospect filters.</small><div className="dialog-actions"><button type="button" className="outline-button" onClick={() => setPersonaDialog(false)}>Cancel</button><button type="submit" className="apply-filters">Save persona</button></div></form></section></div>}
      {listDialog && <div className="modal-backdrop" onClick={() => setListDialog(false)}><section className="save-dialog" role="dialog" aria-modal="true" aria-labelledby="add-to-list-title" onClick={event => event.stopPropagation()}><header><div><h3 id="add-to-list-title">Add prospects to a list</h3><p>{filteredProspects.filter(person => selectedPeople.includes(person.id || person.name)).length} selected contacts will be saved in this browser workspace.</p></div><IconButton title="Close dialog" onClick={() => setListDialog(false)}><X size={17} /></IconButton></header><form className="save-search-form" onSubmit={event => { event.preventDefault(); addSelectedContactsToList(); }}><label className="field-block"><span>Destination list</span><select value={selectedList} onChange={event => setSelectedList(event.target.value)}>{workspaceLists.map(list => <option key={list.name} value={list.name}>{list.name}</option>)}<option value="new">Create a new list</option></select></label>{selectedList === "new" && <label className="field-block"><span>New list name</span><input autoFocus required placeholder="Priority prospects" value={newListName} onChange={event => setNewListName(event.target.value)} /></label>}<small className="field-hint">Selected prospects are also saved to the shared People workspace.</small><div className="dialog-actions"><button type="button" className="outline-button" onClick={() => setListDialog(false)}>Cancel</button><button type="submit" className="apply-filters" disabled={selectedList === "new" && !newListName.trim()}>Add to list</button></div></form></section></div>}
      {researchTemplateDialog && <div className="modal-backdrop" onClick={() => setResearchTemplateDialog(false)}><section className="save-dialog research-template-dialog" role="dialog" aria-modal="true" aria-labelledby="research-template-title" onClick={event => event.stopPropagation()}><header><div><h3 id="research-template-title">Choose an AI research template</h3><p>Select a template and review it with Luna before applying research.</p></div><IconButton title="Close dialog" onClick={() => setResearchTemplateDialog(false)}><X size={17} /></IconButton></header><div className="research-template-list" role="radiogroup" aria-label="Research templates">{contactResearchTemplates.map(template => <button type="button" role="radio" aria-checked={selectedResearchTemplate === template.id} className={`research-template-option${selectedResearchTemplate === template.id ? " selected" : ""}`} key={template.id} onClick={() => setSelectedResearchTemplate(template.id)}><span className="research-template-radio">{selectedResearchTemplate === template.id && <span />}</span><span className="research-template-copy"><strong>{template.name}</strong><small>{template.description}</small><em>Reusable field · {template.field}</em></span></button>)}</div><div className="research-template-selection"><strong>{filteredProspects.filter(person => selectedPeople.includes(person.id || person.name)).length} selected contact{filteredProspects.filter(person => selectedPeople.includes(person.id || person.name)).length === 1 ? "" : "s"}</strong><span>{filteredProspects.filter(person => selectedPeople.includes(person.id || person.name)).length ? "Only contacts checked in the results table are included." : "Select contacts in the results table, then reopen this picker."}</span>{resultProvider === "demo" && <span className="research-template-demo">Demo records can be used to shape the prompt, but Luna must not present them as live Apollo research.</span>}</div><div className="dialog-actions"><button type="button" className="outline-button" onClick={() => setResearchTemplateDialog(false)}>Cancel</button><button type="button" className="apply-filters" disabled={!filteredProspects.some(person => selectedPeople.includes(person.id || person.name))} onClick={continueWithResearchTemplate}>Review with Luna <ChevronRight size={14} /></button></div></section></div>}
      {manualContactDialog && <div className="modal-backdrop" onClick={() => setManualContactDialog(false)}><section className="save-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-contact-title" onClick={event => event.stopPropagation()}><header><div><h3 id="manual-contact-title">Add a contact</h3><p>Save a contact to this browser workspace.</p></div><IconButton title="Close dialog" onClick={() => setManualContactDialog(false)}><X size={17} /></IconButton></header><form className="save-search-form" onSubmit={addManualContact}><label className="field-block"><span>Full name</span><input autoFocus required placeholder="Taylor Morgan" value={manualContact.name} onChange={event => setManualContact(current => ({ ...current, name: event.target.value }))} /></label><label className="field-block"><span>Job title</span><input placeholder="VP of Sales" value={manualContact.title} onChange={event => setManualContact(current => ({ ...current, title: event.target.value }))} /></label><label className="field-block"><span>Company</span><input placeholder="Company name" value={manualContact.company} onChange={event => setManualContact(current => ({ ...current, company: event.target.value }))} /></label><div className="wm-form-row"><label className="field-block"><span>Email</span><input type="email" placeholder="taylor@company.com" value={manualContact.email} onChange={event => setManualContact(current => ({ ...current, email: event.target.value }))} /></label><label className="field-block"><span>Location</span><input placeholder="City, State" value={manualContact.location} onChange={event => setManualContact(current => ({ ...current, location: event.target.value }))} /></label></div><div className="wm-form-row"><label className="field-block"><span>Phone</span><input type="tel" placeholder="+1 415 555 0138" value={manualContact.phone} onChange={event => setManualContact(current => ({ ...current, phone: event.target.value }))} /></label><label className="field-block"><span>LinkedIn</span><input placeholder="linkedin.com/in/taylor-morgan" value={manualContact.linkedinUrl} onChange={event => setManualContact(current => ({ ...current, linkedinUrl: event.target.value }))} /></label></div><small className="field-hint">Saved contacts appear in Saved people and the workspace's People and Data enrichment sections.</small><div className="dialog-actions"><button type="button" className="outline-button" onClick={() => setManualContactDialog(false)}>Cancel</button><button type="submit" className="apply-filters">Add contact</button></div></form></section></div>}
      {saveDialog && <div className="modal-backdrop" onClick={() => setSaveDialog(false)}><section className="save-dialog" role="dialog" aria-modal="true" aria-labelledby="save-search-title" onClick={event => event.stopPropagation()}><header><div><h3 id="save-search-title">Save search</h3><p>Save this search so you can return to it later.</p></div><IconButton title="Close dialog" onClick={() => setSaveDialog(false)}><X size={17} /></IconButton></header><form className="save-search-form" onSubmit={event => { event.preventDefault(); saveCurrentSearch(); }}><label className="field-block"><span>Search name</span><input autoFocus placeholder="Name this search" value={searchNameInput} onChange={event => setSearchNameInput(event.target.value)} /></label><div className="dialog-actions"><button type="button" className="outline-button" onClick={() => { setSaveDialog(false); setSearchNameInput(""); }}>Cancel</button><button type="submit" className="apply-filters" disabled={!searchNameInput.trim()}>Save search</button></div></form></section></div>}

      {toast && <div className="toast"><Check size={15} />{toast}</div>}
      <button className="outside-close" aria-label="Dismiss mobile navigation" onClick={() => setSidebarOpen(false)} />
    </div>
  );
}
