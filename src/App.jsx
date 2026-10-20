import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowDownUp, Bell, BriefcaseBusiness, Building2, CalendarDays,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardList,
  Clock3, ContactRound, Database, FileUp, Filter, Folder,
  Home, LayoutGrid, ListFilter, LockKeyhole, Mail, MapPin, Menu,
  PanelLeftClose, Phone, Plus, Search, Settings, SlidersHorizontal,
  Sparkles, Star, Users, Workflow, Wrench, X, Zap, DollarSign, ShieldCheck, UserRound,
} from "lucide-react";

const navGroups = [
  { title: "Prospect and enrich", icon: Search, items: [["People", Users, "/people"], ["Companies", Building2, "/companies"], ["Lists", ListFilter, "/lists"], ["Data enrichment", Database, "/enrichment-status/data-health-center"]] },
  { title: "Engage", icon: Workflow, items: [["Sequences", Workflow, "/sequences"], ["Emails", Mail, "/emails"], ["Calls", Phone, "/phone-calls"], ["Tasks", ClipboardList, "/tasks"]] },
  { title: "Win deals", icon: DollarSign, items: [["Meetings", CalendarDays, "/meetings"], ["Conversations", ContactRound, "/conversations/recordings"], ["Deals", BriefcaseBusiness, "/opportunities?"]] },
  { title: "Tools and automation", icon: Wrench, items: [["Workflows", Workflow, "/plays"], ["Analytics", Activity, "/analytics"]] },
];

const quickFilters = [
  { label: "Locations", items: ["United States", "Canada"] },
  { label: "Email Status", items: ["Verified", "Unverified", "Unavailable"] },
  { label: "Job Titles", items: ["founder", "sales manager", "marketing director"] },
  { label: "Industry", items: ["Information Technology & Services", "Marketing & Advertising", "Retail"] },
];

const globalQuickLinks = ["Find people", "Find companies", "Sequences", "Lists"];
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

const sampleProspects = [
  { id: "demo-maya-patel", name: "Maya Patel", role: "VP of Sales", pastRole: "Regional Sales Manager", company: "Northstar Labs", pastCompany: "Summit CRM", domain: "northstarlabs.example", pastDomain: "summitcrm.example", location: "San Francisco, CA", hqLocation: "San Francisco, CA", coordinates: [37.7749, -122.4194], hqCoordinates: [37.7749, -122.4194], country: "United States", industry: "Information Technology & Services", keywords: "b2b saas sales automation", description: "Sales software for growing teams", employeeCount: 180, revenue: 24000000, technologies: ["salesforce", "hubspot"], activeJobs: 8, openJobTitles: ["Sales Development Representative", "Account Executive"], openJobLocations: ["San Francisco, CA"], lastJobPostedAt: "2025-02-18", status: "Verified", createdAt: "2025-01-12", initials: "MP", color: "coral" },
  { id: "demo-jordan-lee", name: "Jordan Lee", role: "Founder & CEO", pastRole: "Product Lead", company: "Brightline", pastCompany: "Northstar Labs", domain: "brightline.example", pastDomain: "northstarlabs.example", location: "New York, NY", hqLocation: "New York, NY", coordinates: [40.7128, -74.006], hqCoordinates: [40.7128, -74.006], country: "United States", industry: "Information Technology & Services", keywords: "cloud software analytics", description: "Cloud analytics for modern companies", employeeCount: 42, revenue: 6000000, technologies: ["google_analytics", "salesforce"], activeJobs: 1, openJobTitles: ["Product Designer"], openJobLocations: ["New York, NY"], lastJobPostedAt: "2025-02-02", status: "Verified", createdAt: "2025-01-13", initials: "JL", color: "blue" },
  { id: "demo-sofia-martinez", name: "Sofia Martinez", role: "Marketing Director", pastRole: "Marketing Manager", company: "Pioneer Cloud", pastCompany: "Brightline", domain: "pioneercloud.example", pastDomain: "brightline.example", location: "Austin, TX", hqLocation: "Austin, TX", coordinates: [30.2672, -97.7431], hqCoordinates: [30.2672, -97.7431], country: "United States", industry: "Marketing & Advertising", keywords: "marketing demand generation", description: "Marketing services and campaign management", employeeCount: 280, revenue: 48000000, technologies: ["hubspot", "marketo"], activeJobs: 14, openJobTitles: ["Marketing Coordinator", "Demand Generation Manager"], openJobLocations: ["Austin, TX", "Remote"], lastJobPostedAt: "2025-02-20", status: "Unverified", createdAt: "2025-01-14", initials: "SM", color: "purple" },
  { id: "demo-ethan-chen", name: "Ethan Chen", role: "Head of Growth", pastRole: "Demand Generation Manager", company: "Atlas Systems", pastCompany: "Pioneer Cloud", domain: "", pastDomain: "pioneercloud.example", location: "Seattle, WA", hqLocation: "Portland, OR", coordinates: [47.6062, -122.3321], hqCoordinates: [45.5152, -122.6784], country: "United States", industry: "Information Technology & Services", keywords: "growth technology operations", description: "Business systems and growth technology", employeeCount: 680, revenue: 120000000, technologies: ["salesforce", "workday"], activeJobs: 3, openJobTitles: ["Data Engineer", "Operations Analyst"], openJobLocations: ["Portland, OR"], lastJobPostedAt: "2025-01-28", status: "Verified", createdAt: "2025-01-15", initials: "EC", color: "green" },
];

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
      return person && typeof person.id === "string" && typeof person.name === "string" ? person : null;
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeApolloPerson(person) {
  const personId = person.id || person.person_id;
  const firstName = String(person.first_name || "").trim();
  const lastName = String(person.last_name_obfuscated || person.last_name || "").trim();
  const name = [firstName, lastName].filter(Boolean).join(" ") || "Apollo prospect";
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

const promptStopWords = new Set("a an and any are at be best by can company companies find for from give in into looking me of on people professional professionals prospect prospects right search show the to use with who that this those these apollo ai email emails status contacts contact individuals specialist specialists talent".split(" "));

function getPromptTerms(prompt) {
  return [...new Set((prompt.toLowerCase().match(/[a-z0-9]+/g) || []).filter(term => term.length > 1 && !/^\d+$/.test(term) && !promptStopWords.has(term)))];
}

function promptTermMatches(text, term) {
  const variants = [term];
  if (term.endsWith("ies") && term.length > 4) variants.push(`${term.slice(0, -3)}y`);
  if (term.endsWith("s") && term.length > 3) variants.push(term.slice(0, -1));
  return variants.some(variant => text.includes(variant));
}

function getFilterValues(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/[,;\n]+/);
  return values.map(item => String(item).trim().toLowerCase()).filter(Boolean);
}

function normalizeDomain(value) {
  return String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[\/@?#]/, 1)[0];
}

function ApolloMark() {
  return <img className="apollo-mark" src="/assets/apollo-mark.svg" alt="Apollo" />;
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
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(Object.fromEntries(navGroups.map(({ title }) => [title, title !== "Tools and automation"])));
  const [activeNav, setActiveNav] = useState("Prospect and enrich-People-0");
  const [activeCountTab, setActiveCountTab] = useState("Total");
  const [showFilters, setShowFilters] = useState(true);
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
  const [aiPrompt, setAiPrompt] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [apolloConfigured, setApolloConfigured] = useState(false);
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
  const [sortField, setSortField] = useState("Relevance");
  const [sortDirection, setSortDirection] = useState("Descending");
  const [toast, setToast] = useState("");
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [savedPeople, setSavedPeople] = useState(readSavedPeople);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/apollo/status")
      .then(response => response.ok ? response.json() : null)
      .then(status => { if (!cancelled) { setApolloConfigured(Boolean(status?.configured)); setApolloStatusLoaded(true); } })
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
    try {
      window.localStorage.setItem("apollo-prototype-saved-searches", JSON.stringify(savedSearches));
    } catch {
      // Keep saved searches available for this session if browser storage is unavailable.
    }
  }, [savedSearches]);

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
      else if (saveDialog) setSaveDialog(false);
      else if (filtersModal) { setPendingModalSelected(modalSelected); setFiltersModal(false); }
      else if (settingsOpen) setSettingsOpen(false);
      else if (openMenu) setOpenMenu("");
      else if (sidebarOpen) setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [saveDialog, filtersModal, settingsOpen, openMenu, sidebarOpen, modalSelected, enrichmentTarget, enrichmentLoading]);

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
    const quickStatuses = selectedQuick.filter(value => ["Verified", "Unverified", "Unavailable"].includes(value));
    const quickTitles = selectedQuick.filter(value => ["founder", "sales manager", "marketing director"].includes(value));
    const quickIndustries = selectedQuick.filter(value => ["Information Technology & Services", "Marketing & Advertising", "Retail"].includes(value));
    const includesAny = (text, values) => {
      const terms = getFilterValues(values);
      return !terms.length || terms.some(value => text.includes(value));
    };

    if (resultProvider === "apollo") {
      return source.filter(person => {
        if (!needle) return true;
        return `${person.name} ${person.role} ${person.company} ${person.location}`.toLowerCase().includes(needle);
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
      const allText = `${person.name} ${role} ${pastRole} ${company} ${location} ${person.country} ${industry} ${person.status}`.toLowerCase();

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
      if (resultProvider !== "apollo" && quickStatuses.length && !quickStatuses.includes(person.status)) return false;
      if (!includesAny(titleSearchText, quickTitles)) return false;
      if (!includesAny(industry, quickIndustries)) return false;
      return true;
    }).sort((a, b) => {
      if (sortField === "Relevance") return 0;
      const fields = { "First name": "name", "Last name": "name", Company: "company", Location: "location", "Created date": "createdAt" };
      const field = fields[sortField] || "name";
      const left = (field === "name" && sortField === "Last name" ? a.name.split(" ").at(-1) : a[field]).toLowerCase();
      const right = (field === "name" && sortField === "Last name" ? b.name.split(" ").at(-1) : b[field]).toLowerCase();
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
    setSavedPeople(current => isSaved
      ? current.filter(saved => saved.id !== person.id && saved.name !== person.name)
      : [...current, person]);
    notify(isSaved ? `${person.name} removed from saved people` : `${person.name} saved`);
  };
  const openPersonEnrichment = (person) => {
    setEnrichmentTarget(person);
    setEnrichmentResult("");
    setEnrichmentError("");
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
  const runPeopleSearch = async (event, overrides = {}) => {
    event?.preventDefault?.();
    const prompt = String(overrides.prompt ?? aiPrompt).trim();
    const nextSearchText = String(overrides.searchText ?? searchText).trim();
    const page = Math.min(500, Math.max(1, Number(overrides.page) || 1));
    const perPage = Math.min(100, Math.max(1, Number(overrides.perPage) || resultsPerPage));
    if (page === 1 && !prompt && !nextSearchText && activeFilterCount === 0 && !overrides.allowEmpty) return;
    const requestId = ++peopleSearchRequest.current;
    setSubmittedPrompt(prompt || (nextSearchText ? `Name: ${nextSearchText}` : "People search"));
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
      notify("Showing demo records. Add an Apollo API key to search live prospects.");
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
          criteria: {
            prompt,
            searchText: nextSearchText,
            titleValue,
            excludedTitleValue,
            pastTitleValue,
            excludedPastTitleValue,
            companyValue,
            companyMode,
            companyDomains,
            excludedCompanyDomains,
            companyDomainOnly,
            companySizeRanges,
            revenueMinimum,
            revenueMaximum,
            technologyValue,
            activeJobTitles,
            activeJobLocations,
            activeJobsMinimum,
            activeJobsMaximum,
            jobPostedAfter,
            jobPostedBefore,
            locationValue,
            excludedLocationValue,
            locationRadius,
            accountHq,
            industryValue,
            excludedIndustryValue,
            jobTitleKnowledge,
            industryKnowledge,
            keywordValue,
            excludedKeywordValue,
            keywordType,
            includeSimilarTitles,
            selectedManagementLevels,
            selectedDepartments,
            selectedQuick,
          },
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
    if (item === "Find people") {
      setActiveNav("Prospect and enrich-People-0");
      setActiveCountTab("Total");
      setSubmittedPrompt("");
      setAiPrompt("");
      return;
    }
    notify(`${item} is outside this Find people prototype`);
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

  const matchesModalFilter = (item, categoryName) => {
    const inCategory = modalCategory === "All" || categoryName === modalCategory;
    const inSearch = !filterModalQuery || item.toLowerCase().includes(filterModalQuery.toLowerCase());
    return inCategory && inSearch;
  };

  const applyAdvancedFilters = () => {
    const destinations = {
      "Job Titles": "Job Titles",
      "Management Level": "Job Titles",
      "Departments & Job Function": "Job Titles",
      Location: "Location",
      "Company Location": "Location",
      "Email Status": "Email Status",
      Company: "Company",
      "Company Size": "Company",
      Revenue: "Company",
      Technologies: "Company",
      Hiring: "Company",
      Industry: "Industry & Keywords",
      Keywords: "Industry & Keywords",
    };
    const destination = pendingModalSelected.map(item => destinations[item]).find(Boolean);
    const unsupported = pendingModalSelected.filter(item => !destinations[item] && item !== "Name");
    setModalSelected(pendingModalSelected);
    setFiltersModal(false);
    if (pendingModalSelected.some(item => ["Company Size", "Revenue", "Technologies", "Hiring"].includes(item))) setCompanyAttributesOpen(true);
    if (pendingModalSelected.includes("Company Location")) setAccountHq(true);
    if (destination) setOpenFilter(destination);
    if (pendingModalSelected.includes("Name")) window.setTimeout(() => document.querySelector(".people-search-field input")?.focus(), 0);
    if (unsupported.length) notify(`${unsupported.length} selected filter${unsupported.length === 1 ? " is" : "s are"} not available in this prototype yet.`);
    else if (destination || pendingModalSelected.includes("Name")) notify("Choose values in the selected filter controls.");
    else notify("No supported filter selected.");
  };

  const showingSavedPeople = activeCountTab === "Saved";
  const showingResults = Boolean(submittedPrompt) || showingSavedPeople;
  const visibleGlobalLinks = globalQuickLinks.filter(item => item.toLowerCase().includes(globalSearchQuery.trim().toLowerCase()));
  const normalizedViewQuery = viewSearchQuery.trim().toLowerCase();
  const visibleSavedSearches = savedSearches.filter(search => {
    const matchesQuery = !normalizedViewQuery || search.name.toLowerCase().includes(normalizedViewQuery);
    const matchesTab = viewSearchTab === "All searches" || viewSearchTab === "Your searches" || (viewSearchTab === "Starred" && search.starred);
    return matchesQuery && matchesTab;
  });
  const showDefaultView = viewSearchTab === "All searches" && (!normalizedViewQuery || "default view".includes(normalizedViewQuery));

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} onClick={() => openMenu && setOpenMenu("")}>
      <aside className={`sidebar ${sidebarOpen ? "mobile-open" : ""}`} onClick={event => event.stopPropagation()}>
        <div className="brand-row">
            <a href="#/home" className="brand-link" aria-label="Apollo home"><ApolloMark /></a>
          <button className="collapse-sidebar" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setSidebarCollapsed(value => !value)}><PanelLeftClose size={16} /></button>
        </div>
        <div className="side-scroll">
          <div className="top-home-row">
            <a className={`side-link home-link ${activeNav === "Home" ? "active" : ""}`} href="#/home" onClick={() => setActiveNav("Home")}><Home size={16} /><span>Home</span></a>
            <button className="side-utility-button" aria-label="Open dialer" title="Open dialer" onClick={() => notify("Dialer opened")}><Phone size={15} /></button>
          </div>
          <a className="side-link top-ai-link" href="#/assistant" onClick={() => notify("AI Assistant is outside this Find people prototype")}><Sparkles size={16} /><span>AI Assistant</span></a>
          <div className="nav-separator" aria-hidden="true" />
          {navGroups.map(({ title, icon: GroupIcon, items }) => (
            <section className="nav-group" key={title}>
              <button className="nav-group-heading" onClick={() => toggleGroup(title)}><GroupIcon size={16} /><span>{title}</span><ChevronDown className={expandedGroups[title] ? "chevron-up" : ""} size={14} /></button>
              {expandedGroups[title] && <div className="nav-subitems">{items.map(([label, ItemIcon, route], index) => {
                const key = `${title}-${label}-${index}`;
                return <a key={key} className={`side-link nav-subitem ${activeNav === key ? "active" : ""}`} href={`#${route}`} onClick={() => { setActiveNav(key); notify(`${label} is outside this Find people prototype`); }}><ItemIcon size={15} /><span>{label}</span></a>;
              })}</div>}
            </section>
          ))}
        </div>
        <div className="side-bottom">
          <a className="upgrade-button" href="#/settings/plans/upgrade?source=side_nav_growth_cta&family=Upgrade" onClick={() => notify("Upgrade options are part of Apollo billing")}>Upgrade</a>
          {!onboardingDismissed && <div className="onboarding-card-shell">
            <a className="onboarding-card" href="#/onboarding-hub/queue" onClick={() => notify("Onboarding hub is outside this Find people prototype")}>
              <span className="onboarding-title">Onboarding hub</span>
              <span className="onboarding-progress"><span className="onboarding-progress-track"><b /></span><span className="onboarding-completion">0% Completed</span></span>
            </a>
            <button className="onboarding-dismiss" aria-label="Dismiss onboarding hub" title="Dismiss onboarding hub" onClick={() => setOnboardingDismissed(true)}><X size={15} /></button>
          </div>}
          <a className="side-link" href="#/settings/deliverability-suite/overview"><Mail size={16} /><span>Email setup and health</span></a>
          <button className="side-link"><Settings size={16} /><span>Admin Settings</span><ChevronRight size={14} /></button>
        </div>
      </aside>

      <section className="workspace" onClick={event => event.stopPropagation()}>
        <header className="global-header">
          <button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(value => !value)}><Menu size={20} /></button>
          <button className="global-search" onClick={() => { setGlobalSearchQuery(""); toggleMenu("global-search"); }}><Search size={14} /><span>Search or ask a question in Apollo</span><span className="global-shortcut"><kbd>⌘</kbd><kbd>K</kbd></span></button>
          <div className="header-actions">
            <div className="menu-anchor"><button className="credits-button" aria-label="Apollo API connection status" onClick={event => { event.stopPropagation(); toggleMenu("credits"); }}><Database className="credits-mobile-icon" size={16} /><span>{!apolloStatusLoaded ? "Checking…" : apolloConfigured ? "API key set" : "Demo mode"}</span></button>{openMenu === "credits" && <div className="popover compact-popover" onClick={event => event.stopPropagation()}><strong>Apollo connection</strong><p>{!apolloStatusLoaded ? "Checking the local server…" : apolloConfigured ? "An API key is configured for live People Search." : "Searches currently use local sample prospects."}</p><small>{apolloConfigured ? "Search access will be checked when you run a query. This preview does not read your Apollo credit balance." : "Set APOLLO_API_KEY in .env.local and restart the preview to enable live search."}</small></div>}</div>
            <button className="assistant-button" onClick={() => notify("Apollo AI Assistant opened")}><Sparkles size={16} /><span className="assistant-label">AI Assistant<span className="assistant-button-tail" /></span></button>
            <IconButton className="mobile-extra-icon" title="Open dialer" onClick={() => notify("Dialer opened")}><Phone size={16} /></IconButton>
            <div className="header-utility-group">
              <IconButton title="Activity & notifications" onClick={() => toggleMenu("notifications")}><Bell size={16} /></IconButton>
              <IconButton className="mobile-extra-icon" title="Settings" onClick={() => setSettingsOpen(true)}><Settings size={16} /></IconButton>
              <div className="profile-slot"><div className="menu-anchor"><button className="avatar-button" title="Your profile" onClick={event => { event.stopPropagation(); toggleMenu("profile"); }}><span className="avatar-initials">RB</span></button>{openMenu === "profile" && <div className="popover compact-popover profile-popover" onClick={event => event.stopPropagation()}><strong>Robert Berry</strong><span>Account settings</span><span>Preferences</span><span>Sign out</span></div>}</div></div>
            </div>
          </div>
        </header>

        <div className="page-title-row">
          <h1>Find people</h1>
          <div className="menu-anchor"><button className="outline-button" onClick={event => { event.stopPropagation(); toggleMenu("import"); }}>Import <ChevronDown size={14} /></button>{openMenu === "import" && <div className="popover menu-list" onClick={event => event.stopPropagation()}><button onClick={() => { setOpenMenu(""); notify("Single contact import opened"); }}><UserRound size={15} /> Single contact</button><button onClick={() => { setOpenMenu(""); notify("CSV import opened"); }}><FileUp size={15} /> CSV</button></div>}</div>
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
            <div className="menu-anchor research-anchor"><button className="outline-button research-button" onClick={event => { event.stopPropagation(); toggleMenu("research"); }}><Sparkles size={14} /> Research with AI <ChevronDown size={13} /></button>{openMenu === "research" && <div className="popover menu-list" onClick={event => event.stopPropagation()}>{["Run custom AI prompt", "Generate AI formula", "Use Apollo Assistant", "Start with a template"].map((item, index) => <button key={item} onClick={() => { setOpenMenu(""); notify(`${item} opened`); }}>{index === 0 ? <Sparkles size={15} /> : index === 1 ? <Zap size={15} /> : index === 2 ? <Users size={15} /> : <Folder size={15} />}{item}</button>)}</div>}</div>
            <div className="menu-anchor workflow-anchor"><button className="outline-button" onClick={event => { event.stopPropagation(); toggleMenu("workflow"); }}><Zap size={14} /> Create workflow <ChevronDown size={13} /></button>{openMenu === "workflow" && <div className="popover menu-list" onClick={event => event.stopPropagation()}>{["Auto-add to sequence", "Auto-add to lists", "Auto-update records", "Create from scratch"].map(item => <button key={item} onClick={() => { setOpenMenu(""); notify(`${item} workflow setup opened`); }}><Workflow size={15} />{item}</button>)}</div>}</div>
            <button className="outline-button save-search" onClick={() => { setSearchNameInput(""); setSaveDialog(true); }}>Save as new search</button>
            <div className="menu-anchor sort-anchor"><button className="sort-button" onClick={event => { event.stopPropagation(); toggleMenu("sort"); }}><ArrowDownUp size={16} /> {sortField} <ChevronDown size={13} /></button>{openMenu === "sort" && <div className="popover sort-popover" onClick={event => event.stopPropagation()}><span>Sort by</span><select value={sortField} onChange={event => setSortField(event.target.value)}><option>Relevance</option><option>First name</option><option>Last name</option><option>Company</option><option>Location</option><option>Created date</option></select><select value={sortDirection} onChange={event => setSortDirection(event.target.value)}><option>Descending</option><option>Ascending</option></select><button onClick={() => setOpenMenu("")}>Apply</button></div>}</div>
            <button className="outline-button settings-button" onClick={() => setSettingsOpen(true)}><Settings size={16} /> Search settings</button>
          </div>
        </div>

        <div className={`people-workspace ${showFilters ? "" : "filters-hidden"}`}>
          {showFilters && <aside className="filter-panel">
            <div className="count-tabs"><div className="count-tabs-segment" role="tablist" aria-label="People list">{[["Total", "249.6M"], ["Net New", "249.6M"], ["Saved", savedPeople.length]].map(([label, count], index) => <button key={label} id={`people-tab-${index}`} role="tab" aria-selected={activeCountTab === label} aria-controls="people-results" tabIndex={activeCountTab === label ? 0 : -1} className={activeCountTab === label ? "count-tab selected" : "count-tab"} onClick={() => setActiveCountTab(label)} onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const tabs = Array.from(event.currentTarget.parentElement.querySelectorAll('[role="tab"]')); const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; tabs[nextIndex].focus(); tabs[nextIndex].click(); }}><span className="count-tab-content"><span className="count-tab-label">{label}</span><span className="count-tab-badge-row"><small className="count-tab-badge">{count}</small></span></span></button>)}</div></div>
            <div className="accordion-list">
              <section className={`filter-accordion ${openFilter === "Job Titles" ? "expanded" : ""}`}><button className="accordion-trigger" onClick={() => setOpenFilter(openFilter === "Job Titles" ? "" : "Job Titles")}><BriefcaseBusiness size={16} /><span>Job Titles{titleValue && <small className="filter-chip">{titleValue}</small>}</span><ChevronDown size={14} /></button>{openFilter === "Job Titles" && <div className="accordion-content"><div className="mode-toggle"><button className={!advancedTitles ? "selected" : ""} onClick={() => setAdvancedTitles(false)}>Simple</button><button className={advancedTitles ? "selected" : ""} onClick={() => setAdvancedTitles(true)}>Advanced</button></div>{advancedTitles ? <><div className="known-row">{[["known", "Is known"], ["unknown", "Is unknown"]].map(([value, label]) => <button key={value} className={jobTitleKnowledge === value ? "selected" : ""} aria-pressed={jobTitleKnowledge === value} onClick={() => setJobTitleKnowledge(current => current === value ? "any" : value)}>{label}</button>)}</div><FilterField label="Job titles" placeholder="Search job titles" value={titleValue} onChange={event => setTitleValue(event.target.value)} /><p className="field-hint">Include people with any of these job titles.</p></> : <><FilterField label="Include" placeholder="Add job titles" value={titleValue} onChange={event => setTitleValue(event.target.value)} hint="Use exact match to find specific titles." /><label className="check-line"><input type="checkbox" checked={includeSimilarTitles} onChange={event => setIncludeSimilarTitles(event.target.checked)} /> Include similar titles</label><FilterField label="Exclude" placeholder="Add titles to exclude" value={excludedTitleValue} onChange={event => setExcludedTitleValue(event.target.value)} /></>}<details><summary>Past job titles <ChevronDown size={13} /></summary><FilterField label="Include past titles" placeholder="Add past titles" value={pastTitleValue} onChange={event => setPastTitleValue(event.target.value)} /><FilterField label="Exclude past titles" placeholder="Add past titles to exclude" value={excludedPastTitleValue} onChange={event => setExcludedPastTitleValue(event.target.value)} /></details><details><summary>Management Level <ChevronDown size={13} /></summary><div className="option-grid">{managementLevels.map(item => <label key={item}><input type="checkbox" checked={selectedManagementLevels.includes(item)} onChange={event => { const checked = event.target.checked; setSelectedManagementLevels(current => checked ? [...current, item] : current.filter(value => value !== item)); }} />{item}</label>)}</div></details><details><summary>Departments &amp; Job Function <ChevronDown size={13} /></summary><div className="option-grid">{departments.map(item => <label key={item}><input type="checkbox" checked={selectedDepartments.includes(item)} onChange={event => { const checked = event.target.checked; setSelectedDepartments(current => checked ? [...current, item] : current.filter(value => value !== item)); }} />{item}</label>)}</div></details><button className="persona-button" onClick={() => notify("Persona builder opened")}>Create New Persona</button><small className="persona-hint">What’s a Persona?</small></div>}</section>
              <section className={`filter-accordion ${openFilter === "Email Status" ? "expanded" : ""}`}><button className="accordion-trigger" onClick={() => setOpenFilter(openFilter === "Email Status" ? "" : "Email Status")}><Mail size={16} /><span>Email Status</span><ChevronDown size={14} /></button>{openFilter === "Email Status" && <div className="accordion-content"><div className="option-grid">{["Verified", "Unverified", "Unavailable"].map(item => <label key={item}><input type="checkbox" checked={selectedQuick.includes(item)} onChange={() => toggleQuick(item)} />{item}</label>)}</div><small className="field-hint">Apollo People API Search filters by email status but does not return email addresses.</small></div>}</section>
              <section className="filter-accordion locked"><button className="accordion-trigger" onClick={() => notify("People Lookalikes is an advanced Apollo feature")}><Users size={16} /><span>People Lookalikes</span><LockKeyhole size={13} /></button></section>
              <section className={`filter-accordion ${openFilter === "Company" ? "expanded" : ""}`}><button className="accordion-trigger" onClick={() => setOpenFilter(openFilter === "Company" ? "" : "Company")}><Building2 size={16} /><span>Company{companyValue && <small className="filter-chip">{companyValue}</small>}</span><ChevronDown size={14} /></button>{openFilter === "Company" && <div className="accordion-content"><h4>Specific companies</h4><div className="radio-line"><label><input type="radio" name="company-mode" checked={companyMode === "current"} onChange={() => setCompanyMode("current")} /> Current company</label><label><input type="radio" name="company-mode" checked={companyMode === "past"} onChange={() => setCompanyMode("past")} /> Past company</label></div><FilterField label="Is any of" placeholder="Search companies" value={companyValue} onChange={event => setCompanyValue(event.target.value)} /><button className="add-field" onClick={() => setCompanyValue(value => value ? `${value}, ` : "")}>+ Add another company</button><FilterField label="Company domains" placeholder="example.com, acme.io" value={companyDomains} onChange={event => setCompanyDomains(event.target.value)} hint="Match people associated with any listed employer domain." /><FilterField label="Exclude company domains" placeholder="competitor.com" value={excludedCompanyDomains} onChange={event => setExcludedCompanyDomains(event.target.value)} hint="Apollo excludes every known domain for a matching company." /><label className="check-line"><input type="checkbox" checked={companyDomainOnly} onChange={event => setCompanyDomainOnly(event.target.checked)} /> Only show companies with a known domain</label><details open={companyAttributesOpen} onToggle={event => setCompanyAttributesOpen(event.currentTarget.open)}><summary>Company attributes <ChevronDown size={13} /></summary><div className="company-attribute-fields"><FilterField label="Employee count ranges" placeholder="1-50; 51-200" value={companySizeRanges} onChange={event => setCompanySizeRanges(event.target.value)} hint="Separate multiple ranges with semicolons." /><div className="revenue-range-fields"><FilterField label="Revenue from ($)" placeholder="Minimum" type="number" min="0" value={revenueMinimum} onChange={event => setRevenueMinimum(event.target.value)} /><FilterField label="Revenue to ($)" placeholder="Maximum" type="number" min="0" value={revenueMaximum} onChange={event => setRevenueMaximum(event.target.value)} /></div><FilterField label="Technologies used" placeholder="Salesforce, HubSpot" value={technologyValue} onChange={event => setTechnologyValue(event.target.value)} hint="Match companies using any listed technology." /><div className="revenue-range-fields"><FilterField label="Active jobs from" placeholder="Minimum" type="number" min="0" value={activeJobsMinimum} onChange={event => setActiveJobsMinimum(event.target.value)} /><FilterField label="Active jobs to" placeholder="Maximum" type="number" min="0" value={activeJobsMaximum} onChange={event => setActiveJobsMaximum(event.target.value)} /></div><FilterField label="Titles in active job postings" placeholder="Sales manager, analyst" value={activeJobTitles} onChange={event => setActiveJobTitles(event.target.value)} /><FilterField label="Active job locations" placeholder="New York, Remote" value={activeJobLocations} onChange={event => setActiveJobLocations(event.target.value)} /><div className="revenue-range-fields"><FilterField label="Jobs posted after" type="date" value={jobPostedAfter} onChange={event => setJobPostedAfter(event.target.value)} /><FilterField label="Jobs posted before" type="date" value={jobPostedBefore} onChange={event => setJobPostedBefore(event.target.value)} /></div></div></details></div>}</section>
              <section className={`filter-accordion ${openFilter === "Location" ? "expanded" : ""}`}><button className="accordion-trigger" onClick={() => setOpenFilter(openFilter === "Location" ? "" : "Location")}><MapPin size={16} /><span>Location{locationValue && <small className="filter-chip">{locationValue}</small>}</span><ChevronDown size={14} /></button>{openFilter === "Location" && <div className="accordion-content"><div className="mode-toggle"><button className={!accountHq ? "selected" : ""} onClick={() => setAccountHq(false)}>Contact</button><button className={accountHq ? "selected" : ""} onClick={() => setAccountHq(true)}>Account HQ</button></div><FilterField label={accountHq ? "Headquarters" : "Include locations"} placeholder="City, state, country or ZIP" value={locationValue} onChange={event => setLocationValue(event.target.value)} /><FilterField label="Exclude locations" placeholder="Search locations" value={excludedLocationValue} onChange={event => setExcludedLocationValue(event.target.value)} /><label className="field-block"><span>Radius</span><select value={locationRadius} onChange={event => setLocationRadius(event.target.value)}><option>Any distance</option><option>10 miles</option><option>25 miles</option><option>50 miles</option><option>100 miles</option></select></label>{accountHq && <small className="field-hint">Apollo searches company headquarters when Account HQ is selected.</small>}</div>}</section>
              <section className={`filter-accordion ${openFilter === "Industry & Keywords" ? "expanded" : ""}`}><button className="accordion-trigger" onClick={() => setOpenFilter(openFilter === "Industry & Keywords" ? "" : "Industry & Keywords")}><Building2 size={16} /><span>Industry &amp; Keywords{keywordValue && <small className="filter-chip">{keywordValue}</small>}</span><ChevronDown size={14} /></button>{openFilter === "Industry & Keywords" && <div className="accordion-content"><FilterField label="Search industries" placeholder="Add industries" value={industryValue} onChange={event => setIndustryValue(event.target.value)} /><details open><summary>Company Keywords <ChevronDown size={13} /></summary><FilterField label="Include keywords" placeholder="Enter keywords" value={keywordValue} onChange={event => setKeywordValue(event.target.value)} /><FilterField label="Exclude keywords" placeholder="Enter keywords to exclude" value={excludedKeywordValue} onChange={event => setExcludedKeywordValue(event.target.value)} /><label className="field-block"><span>Type of Keywords</span><select value={keywordType} onChange={event => setKeywordType(event.target.value)}><option>Name</option><option>Keywords</option><option>Company description</option></select></label></details><details><summary>Advanced settings <ChevronDown size={13} /></summary><div className="known-row">{[["not-any-of", "Is not any of"], ["known", "Is known"], ["unknown", "Is unknown"]].map(([value, label]) => <button key={value} className={industryKnowledge === value ? "selected" : ""} aria-pressed={industryKnowledge === value} onClick={() => setIndustryKnowledge(value)}>{label}</button>)}</div><FilterField label="Exclude industries" placeholder="Search industries to exclude" value={excludedIndustryValue} onChange={event => setExcludedIndustryValue(event.target.value)} /></details></div>}</section>
            </div>
            <div className="filter-footer"><button className="clear-button" disabled={!activeFilterCount} onClick={clearFilters}><span>Clear all</span></button><button className="outline-button view-filters-button" onClick={() => { setPendingModalSelected(modalSelected); setFiltersModal(true); }}>View 60+ Filters</button></div>
          </aside>}

          <main id="people-results" role="tabpanel" aria-labelledby={`people-tab-${["Total", "Net New", "Saved"].indexOf(activeCountTab)}`} className={`main-stage ${showingResults ? "results-mode" : ""}`}>
            {showingResults ? <div className="results-view"><div className="results-heading"><div><div className="eyebrow">{showingSavedPeople ? "Saved people" : resultProvider === "apollo" ? "Apollo people search" : "Demo prospect search"}</div><h2>{showingSavedPeople ? "Your saved people" : "People matching your search"}</h2>{!showingSavedPeople && <p>“{submittedPrompt}” <span>· {resultProvider === "apollo" ? "Live Apollo data" : "4 local example records"}</span></p>}</div><div className="results-heading-actions">{!showingSavedPeople && <button className="apply-filters" disabled={searchLoading} onClick={() => runPeopleSearch(null, { page: 1, prompt: aiPrompt, allowEmpty: true })}>Apply filters</button>}<button className="outline-button" onClick={() => { setActiveCountTab("Total"); if (!showingSavedPeople) { setSubmittedPrompt(""); setAiPrompt(""); } }}>Back to search</button></div></div>{resultProvider === "demo" && !showingSavedPeople && <div className="data-connection-note">Demo mode · Set <code>APOLLO_API_KEY</code> in <code>.env.local</code> and restart to search Apollo live.</div>}{searchError && <div className="search-error" role="alert">{searchError}</div>}{resultProvider === "apollo" && !showingSavedPeople && <div className="data-connection-note">Apollo People API Search · emails and phone numbers are not included in this endpoint.</div>}{searchLimitations.map((limitation, index) => <div className="search-limitation" key={`${index}-${limitation}`}>{limitation}</div>)}<div className="results-toolbar"><strong>{resultProvider === "apollo" && !showingSavedPeople ? `${liveTotal.toLocaleString()} people` : `${filteredProspects.length} people`}</strong><span>{showingSavedPeople ? "Saved in this browser" : resultProvider === "apollo" ? "People API Search returns net-new prospects" : "Local demo records · no Apollo data loaded"}</span></div><div className="table-wrap"><table><thead><tr><th><input type="checkbox" aria-label="Select all visible people" checked={filteredProspects.length > 0 && filteredProspects.every(person => selectedPeople.includes(person.id || person.name))} onChange={event => { const visibleIds = filteredProspects.map(person => person.id || person.name); setSelectedPeople(current => event.target.checked ? [...new Set([...current, ...visibleIds])] : current.filter(id => !visibleIds.includes(id))); }} /></th><th>Name</th><th>Company</th><th>Location</th><th>Email</th><th>Actions</th></tr></thead><tbody>{filteredProspects.map(person => { const isSaved = savedPeople.some(saved => saved.id === person.id || saved.name === person.name); const rowId = person.id || person.name; return <tr key={rowId}><td><input type="checkbox" checked={selectedPeople.includes(rowId)} onChange={() => setSelectedPeople(current => current.includes(rowId) ? current.filter(id => id !== rowId) : [...current, rowId])} aria-label={`Select ${person.name}`} /></td><td><div className="person-cell"><span className={`person-avatar ${person.color}`}>{person.initials}</span><div><strong>{person.name}</strong><small>{person.role}</small></div></div></td><td><strong>{person.company}</strong></td><td>{person.location}</td><td>{person.email ? <div className="email-cell"><span className={`status-pill ${person.status === "Verified" || person.status === "Email available" ? "verified" : "unverified"}`}><ShieldCheck size={13} />{person.status}</span><a href={`mailto:${person.email}`}>{person.email}</a></div> : <div className="email-cell"><span className={`status-pill ${person.status === "Verified" || person.status === "Email available" ? "verified" : "unverified"}`}><ShieldCheck size={13} />{person.status}</span>{person.source === "apollo" && person.canEnrich && !person.enrichmentAttempted && <button className="row-action enrich-action" onClick={() => openPersonEnrichment(person)}>Find email</button>}{person.enrichmentAttempted && <small>No email found</small>}</div>}</td><td><button className="row-action" aria-pressed={isSaved} aria-label={isSaved ? `Remove ${person.name} from saved people` : `Save ${person.name}`} onClick={() => toggleSavedPerson(person)}>{isSaved ? <Check size={15} /> : <Plus size={15} />}{isSaved ? "Saved" : "Save"}</button></td></tr>; })}</tbody></table>{searchLoading && <div className="empty-results">Searching Apollo…</div>}{!searchLoading && filteredProspects.length === 0 && <div className="empty-results">{searchError ? "Search did not complete." : showingSavedPeople ? "You haven’t saved any people yet." : "No prospects match this search."}</div>}</div>{resultProvider === "apollo" && !showingSavedPeople && (liveHasMore || searchPage > 1) && <div className="results-pagination"><span>Page {searchPage} · {liveTotal.toLocaleString()} matches</span><label className="page-size-control">Rows per page <select aria-label="Rows per page" value={resultsPerPage} onChange={event => runPeopleSearch(null, { page: 1, perPage: Number(event.target.value), allowEmpty: true })}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label><div><button className="outline-button" disabled={searchPage <= 1 || searchLoading} onClick={() => runPeopleSearch(null, { page: searchPage - 1 })}>Previous</button><button className="outline-button" disabled={!liveHasMore || searchLoading} onClick={() => runPeopleSearch(null, { page: searchPage + 1 })}>Next</button></div></div>}</div> : <div className="ai-search-card-wrap">
              <div className="ai-search-intro">
                <div className="ai-search-heading"><h2>Use Apollo AI to find the right prospects</h2></div>
                <form className={`ai-prompt-form${aiPrompt.trim() ? " has-prompt" : ""}`} onSubmit={submitPrompt}><span className="ai-prompt-icon"><Sparkles size={18} /></span><span className="ai-prompt-field"><input value={aiPrompt} onChange={event => setAiPrompt(event.target.value)} placeholder="Example: Seeking" aria-label="Use Apollo AI to find the right prospects" role="combobox" aria-expanded="false" autoComplete="off" /></span><button type="submit" aria-label="Search with Apollo AI"><ChevronRight size={16} /></button></form>
              </div>
              <section className="quick-filters-card"><div className="quick-filters-content"><h3>Quick filters</h3><div className="quick-grid">{quickFilters.map(group => <div className="quick-group" key={group.label}><h4>{group.label}</h4><div className="quick-chips">{group.items.map(item => <button key={item} className={`quick-chip ${selectedQuick.includes(item) ? "selected" : ""}`} onClick={() => toggleQuick(item)}>{selectedQuick.includes(item) && <Check size={11} />}<span>{item}</span></button>)}</div></div>)}</div></div><div className="advanced-lock-row"><div className="advanced-lock-content"><div className="advanced-lock-main"><span className="lock-tile"><LockKeyhole size={15} /></span><div className="advanced-lock-copy"><span className="advanced-lock-label">Unlock advanced filters:</span><div className="advanced-lock-options"><button onClick={() => notify("Revenue is an advanced Apollo filter")}><DollarSign size={13} />Revenue</button><button onClick={() => notify("Funding is an advanced Apollo filter")}><Database size={13} />Funding</button><button onClick={() => notify("Company Lookalikes is an advanced Apollo filter")}><Building2 size={13} />Company Lookalikes</button></div></div></div><a className="upgrade-cta" href="#/settings/plans/upgrade?upgradeOrigin=advanced_filters">View plans</a></div></div></section>
            </div>}
          </main>
        </div>
        <button className="help-launcher" aria-label="Help"><CircleHelp size={26} /></button>
      </section>

      {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}

      {openMenu === "global-search" && <div className="modal-backdrop" onClick={() => setOpenMenu("")}><section className="command-dialog" role="dialog" aria-modal="true" aria-label="Search Apollo" onClick={event => event.stopPropagation()}><form className="command-input" onSubmit={event => { event.preventDefault(); runGlobalSearch(visibleGlobalLinks[0]); }}><Search size={17} /><input autoFocus value={globalSearchQuery} onChange={event => setGlobalSearchQuery(event.target.value)} placeholder="Search Apollo or jump to..." aria-label="Search Apollo or jump to" /><kbd>ESC</kbd></form><div className="command-suggestions"><small>QUICK LINKS</small>{visibleGlobalLinks.map(item => <button type="button" key={item} onClick={() => runGlobalSearch(item)}>{item === "Find people" ? <Users size={16} /> : item === "Find companies" ? <Building2 size={16} /> : item === "Sequences" ? <Workflow size={16} /> : <ListFilter size={16} />}{item}<ChevronRight size={14} /></button>)}{visibleGlobalLinks.length === 0 && <p className="command-empty">No results found.</p>}</div></section></div>}

      {settingsOpen && <div className="drawer-scrim" onClick={() => setSettingsOpen(false)}><aside className="settings-drawer" onClick={event => event.stopPropagation()}><header><h3>Search settings</h3><IconButton title="Close drawer" onClick={() => setSettingsOpen(false)}><X size={17} /></IconButton></header><h4>Fields</h4><button className="drawer-row"><ListFilter size={16} /><span>Fields</span><small>14</small><ChevronRight size={14} /></button><h4>Applied filters</h4><button className="drawer-row"><Filter size={16} /><span>Filters</span><small>{activeFilterCount}</small><ChevronRight size={14} /></button></aside></div>}

      {filtersModal && <div className="modal-backdrop" onClick={() => { setPendingModalSelected(modalSelected); setFiltersModal(false); }}><section className="filters-dialog" onClick={event => event.stopPropagation()}><header className="filters-modal-header"><div><h2>Search filters</h2><span>Find the right people with more than 60 filters</span></div><IconButton title="Close filters" onClick={() => { setPendingModalSelected(modalSelected); setFiltersModal(false); }}><X size={18} /></IconButton></header><div className="modal-search-row"><div className="modal-filter-search"><Search size={15} /><input value={filterModalQuery} onChange={event => setFilterModalQuery(event.target.value)} placeholder="Search filters" /></div><button className="type-select" onClick={() => toggleMenu("filter-type")}>Type: All <ChevronDown size={13} /></button>{openMenu === "filter-type" && <div className="filter-type-menu">{["All", "Person Info", "Company Info", "Engagement Activity", "Conversation", "Created Source", "Misc"].map(item => <button key={item} onClick={() => { setModalCategory(item); setOpenMenu(""); }}>{item}</button>)}</div>}</div><div className="filters-dialog-body"><aside className="pinned-filters"><h4>Pinned filters</h4><button onClick={() => setModalCategory("Person Info")}><UserRound size={14} /> Person Info</button><button onClick={() => setModalCategory("Company Info")}><Building2 size={14} /> Company Info</button><button onClick={() => setModalCategory("Engagement Activity")}><Activity size={14} /> Engagement Activity</button><button onClick={() => setModalCategory("All")}><Star size={14} /> All filters</button></aside><div className="filter-categories">{filterCategories.map(({ name, count, icon: CategoryIcon, items }) => <section className="modal-category" key={name}><button className="modal-category-heading" onClick={() => setModalCategory(modalCategory === name ? "All" : name)}><CategoryIcon size={16} /><span>{name}</span><small>{count}</small><ChevronDown size={14} /></button>{(modalCategory === "All" || modalCategory === name) && <div className="modal-filter-grid">{items.filter(item => matchesModalFilter(item, name)).map(item => <button key={item} className={pendingModalSelected.includes(item) ? "selected" : ""} onClick={() => toggleModalFilter(item)}>{pendingModalSelected.includes(item) && <Check size={13} />}{item}<Plus size={13} /></button>)}</div>}</section>)}</div></div><footer className="filters-modal-footer"><span>{pendingModalSelected.length ? `${pendingModalSelected.length} filter${pendingModalSelected.length > 1 ? "s" : ""} selected` : "Showing filters for people"}</span><div><button className="clear-button" onClick={() => setPendingModalSelected([])}>Clear all</button><button className="apply-filters" onClick={applyAdvancedFilters}>Apply Filters</button></div></footer></section></div>}

      {enrichmentTarget && <div className="modal-backdrop" onClick={() => { if (!enrichmentLoading) setEnrichmentTarget(null); }}><section className="save-dialog" role="dialog" aria-modal="true" aria-labelledby="enrich-person-title" onClick={event => event.stopPropagation()}><header><div><h3 id="enrich-person-title">Find contact email</h3><p>{enrichmentTarget.name} · {enrichmentTarget.company}</p></div><IconButton title="Close enrichment dialog" onClick={() => { if (!enrichmentLoading) setEnrichmentTarget(null); }}><X size={17} /></IconButton></header><p className="enrichment-credit-note">Apollo enrichment may use 1–9 credits per person, depending on the data returned. This lookup leaves personal-email and phone enrichment off.</p>{enrichmentResult && <div className="enrichment-result" role="status">{enrichmentResult}</div>}{enrichmentError && <div className="search-error" role="alert">{enrichmentError}</div>}<div className="dialog-actions">{!enrichmentLoading && <button type="button" className="outline-button" onClick={() => setEnrichmentTarget(null)}>{enrichmentResult || enrichmentError ? "Close" : "Cancel"}</button>}{!enrichmentResult && !enrichmentError && <button type="button" className="apply-filters" disabled={!apolloConfigured || enrichmentLoading} onClick={enrichPersonEmail}>{enrichmentLoading ? "Checking Apollo…" : "Enrich email"}</button>}</div></section></div>}
      {saveDialog && <div className="modal-backdrop" onClick={() => setSaveDialog(false)}><section className="save-dialog" role="dialog" aria-modal="true" aria-labelledby="save-search-title" onClick={event => event.stopPropagation()}><header><div><h3 id="save-search-title">Save search</h3><p>Save this search so you can return to it later.</p></div><IconButton title="Close dialog" onClick={() => setSaveDialog(false)}><X size={17} /></IconButton></header><form className="save-search-form" onSubmit={event => { event.preventDefault(); saveCurrentSearch(); }}><label className="field-block"><span>Search name</span><input autoFocus placeholder="Name this search" value={searchNameInput} onChange={event => setSearchNameInput(event.target.value)} /></label><div className="dialog-actions"><button type="button" className="outline-button" onClick={() => { setSaveDialog(false); setSearchNameInput(""); }}>Cancel</button><button type="submit" className="apply-filters" disabled={!searchNameInput.trim()}>Save search</button></div></form></section></div>}

      {toast && <div className="toast"><Check size={15} />{toast}</div>}
      <button className="outside-close" aria-label="Dismiss mobile navigation" onClick={() => setSidebarOpen(false)} />
    </div>
  );
}
