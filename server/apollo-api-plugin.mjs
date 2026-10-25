const API_ORIGIN = "https://api.apollo.io";
const PEOPLE_SEARCH_PATH = "/api/v1/mixed_people/api_search";
const ORGANIZATION_SEARCH_PATH = "/api/v1/mixed_companies/search";
const ORGANIZATION_BULK_ENRICH_PATH = "/api/v1/organizations/bulk_enrich";
const PEOPLE_ENRICH_PATH = "/api/v1/people/match";
const ASSISTANT_TASK_PATH = "/api/v1/agents/task";
const ASSISTANT_POLL_PATH = "/api/v1/agents/poll_task";
const AUTH_HEALTH_PATH = "/api/v1/auth/health";
const MAX_BODY_BYTES = 32 * 1024;
const MAX_PAGE_SIZE = 100;
const MAX_PAGES = 500;
let sessionApiKey = "";

function activeApiKey() {
  return sessionApiKey || process.env.APOLLO_API_KEY?.trim() || "";
}

function values(input) {
  const source = Array.isArray(input) ? input : String(input || "").split(/[,;\n]+/);
  return [...new Set(source.map(value => String(value).trim()).filter(Boolean))];
}

function appendList(params, key, input) {
  for (const value of values(input)) params.append(`${key}[]`, value);
}

function employeeRanges(input) {
  return String(input || "").split(/[;\n]+/).map(range => range.trim()).filter(Boolean)
    .map(range => {
      const hyphenRange = range.match(/^\s*(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)\s*$/);
      const commaRange = range.match(/^\s*(\d+)\s*,\s*(\d+)\s*$/);
      return hyphenRange ? hyphenRange.slice(1).map(value => Number(value.replace(/,/g, ""))) : commaRange ? commaRange.slice(1).map(Number) : [];
    })
    .filter(bounds => bounds.length === 2 && bounds.every(Number.isFinite))
    .map(([minimum, maximum]) => `${Math.min(minimum, maximum)},${Math.max(minimum, maximum)}`);
}

function validateCriteria(criteria = {}) {
  const rawRanges = String(criteria.companySizeRanges || "").split(/[;\n]+/).map(range => range.trim()).filter(Boolean);
  const parsedRanges = employeeRanges(criteria.companySizeRanges);
  if (rawRanges.length && (parsedRanges.length !== rawRanges.length || parsedRanges.some(([minimum, maximum]) => !Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum < 0 || maximum < 0))) {
    throw Object.assign(new Error("Enter employee ranges like 1-50; 51-200."), { statusCode: 400 });
  }
  const minimum = criteria.revenueMinimum === "" || criteria.revenueMinimum == null ? null : Number(criteria.revenueMinimum);
  const maximum = criteria.revenueMaximum === "" || criteria.revenueMaximum == null ? null : Number(criteria.revenueMaximum);
  if ((minimum !== null && (!Number.isFinite(minimum) || minimum < 0)) || (maximum !== null && (!Number.isFinite(maximum) || maximum < 0))) {
    throw Object.assign(new Error("Revenue bounds must be non-negative numbers."), { statusCode: 400 });
  }
  if (minimum !== null && maximum !== null && minimum > maximum) {
    throw Object.assign(new Error("Minimum revenue must not exceed maximum revenue."), { statusCode: 400 });
  }
  const jobsMinimum = criteria.activeJobsMinimum === "" || criteria.activeJobsMinimum == null ? null : Number(criteria.activeJobsMinimum);
  const jobsMaximum = criteria.activeJobsMaximum === "" || criteria.activeJobsMaximum == null ? null : Number(criteria.activeJobsMaximum);
  if ([jobsMinimum, jobsMaximum].some(value => value !== null && (!Number.isInteger(value) || value < 0))) {
    throw Object.assign(new Error("Active job counts must be non-negative whole numbers."), { statusCode: 400 });
  }
  if (jobsMinimum !== null && jobsMaximum !== null && jobsMinimum > jobsMaximum) {
    throw Object.assign(new Error("Minimum active jobs must not exceed the maximum."), { statusCode: 400 });
  }
  const postedAfter = String(criteria.jobPostedAfter || "");
  const postedBefore = String(criteria.jobPostedBefore || "");
  const validDate = value => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
  if (!validDate(postedAfter) || !validDate(postedBefore)) {
    throw Object.assign(new Error("Job posting dates must use YYYY-MM-DD."), { statusCode: 400 });
  }
  if (postedAfter && postedBefore && postedAfter > postedBefore) {
    throw Object.assign(new Error("The earliest job posting date must be on or before the latest date."), { statusCode: 400 });
  }
}

function inferPromptFilters(prompt) {
  const titleAliases = [
    ["co-founder", /\bco[ -]?founders?\b/i], ["founder", /\bfounders?\b/i],
    ["chief executive officer", /\bceos?\b|\bchief executive officers?\b/i],
    ["chief technology officer", /\bctos?\b|\bchief technology officers?\b/i],
    ["chief financial officer", /\bcfos?\b|\bchief financial officers?\b/i],
    ["chief operating officer", /\bcoos?\b|\bchief operating officers?\b/i],
    ["chief marketing officer", /\bcmos?\b|\bchief marketing officers?\b/i],
    ["vice president of sales", /\b(?:vps?|vice presidents?) of sales\b/i],
    ["sales manager", /\bsales managers?\b/i], ["sales director", /\bsales directors?\b/i],
    ["marketing director", /\bmarketing directors?\b/i], ["marketing manager", /\bmarketing managers?\b/i],
    ["product manager", /\bproduct managers?\b/i], ["human resources director", /\b(?:hr|human resources) directors?\b/i],
    ["head of growth", /\bheads? of growth\b/i], ["software engineer", /\bsoftware engineers?\b/i],
  ];
  const titles = titleAliases.filter(([, pattern]) => pattern.test(prompt)).map(([title]) => title);
  const locationMatch = prompt.match(/\b(?:in|around|near|based in)\s+(.+?)(?=\s+(?:with|at|from|who|for)\b|[,.!?]|$)/i);
  let remainder = String(prompt || "");
  for (const [, pattern] of titleAliases) remainder = remainder.replace(pattern, " ");
  if (locationMatch) remainder = remainder.replace(locationMatch[0], " ");
  remainder = remainder.replace(/\b(?:find|show|search for|looking for|people|prospects|prospect|contacts|in|around|near|based|with|at|from|who|for|and|the|a|an|any|my|me|please|give me)\b/gi, " ");
  const keywords = remainder.replace(/[^\p{L}\p{N}\s_-]/gu, " ").replace(/\s+/g, " ").trim();
  return { titles, locations: locationMatch ? [locationMatch[1].trim()] : [], keywords };
}

function buildApolloSearchParams(criteria = {}, page = 1, perPage = 25) {
  const params = new URLSearchParams();
  const inferred = inferPromptFilters(String(criteria.prompt || ""));
  const titles = values(criteria.titleValue).length ? values(criteria.titleValue) : inferred.titles;
  const excludedTitles = values(criteria.excludedTitleValue);
  const excludedPastTitles = values(criteria.excludedPastTitleValue);
  const locations = values(criteria.locationValue).length ? values(criteria.locationValue) : inferred.locations;
  const excludedLocations = values(criteria.excludedLocationValue);
  const industries = values(criteria.industryValue).map(value => value.toLowerCase());
  const includedKeywords = values(criteria.keywordValue);
  const seniorityMap = {
    Owner: ["owner", "founder"], Founder: "founder", Partner: "partner", "C-suite": "c_suite", VP: "vp", Head: "head", Director: "director",
    Manager: "manager", Senior: "senior", Entry: "entry", Intern: "intern",
  };
  const selectedSeniority = values(criteria.selectedManagementLevels)
    .flatMap(value => Array.isArray(seniorityMap[value]) ? seniorityMap[value] : [seniorityMap[value]])
    .filter(Boolean);
  const emailStatusMap = {
    Verified: "verified", Unverified: "unverified", Unavailable: "unavailable",
  };
  const selectedEmailStatuses = values(criteria.selectedQuick)
    .map(value => emailStatusMap[value]).filter(Boolean);
  const selectedQuick = values(criteria.selectedQuick);
  const quickTitles = selectedQuick.filter(value => ["founder", "sales manager", "marketing director"].includes(value));
  const quickIndustries = selectedQuick.filter(value => ["Information Technology & Services", "Marketing & Advertising", "Retail"].includes(value));
  const quickLocations = selectedQuick.filter(value => ["United States", "Canada"].includes(value));

  appendList(params, "person_titles", [...titles, ...quickTitles]);
  appendList(params, "person_not_titles", excludedTitles);
  appendList(params, "person_not_past_titles", excludedPastTitles);
  appendList(params, criteria.accountHq ? "organization_locations" : "person_locations", [...locations, ...quickLocations]);
  appendList(params, criteria.accountHq ? "organization_not_locations" : "person_not_locations", excludedLocations);
  appendList(params, "q_organization_domains_list", values(criteria.companyDomains));
  appendList(params, "not_organization_websites_list", values(criteria.excludedCompanyDomains));
  appendList(params, "organization_industries", [...industries, ...quickIndustries].map(value => value.toLowerCase()));
  appendList(params, "person_seniorities", selectedSeniority);
  appendList(params, "contact_email_status", selectedEmailStatuses);
  appendList(params, "organization_num_employees_ranges", employeeRanges(criteria.companySizeRanges));
  appendList(params, "q_organization_job_titles", values(criteria.activeJobTitles));
  appendList(params, "organization_job_locations", values(criteria.activeJobLocations));
  if (criteria.activeJobsMinimum !== "" && criteria.activeJobsMinimum != null) params.set("organization_num_jobs_range[min]", String(Math.floor(Number(criteria.activeJobsMinimum))));
  if (criteria.activeJobsMaximum !== "" && criteria.activeJobsMaximum != null) params.set("organization_num_jobs_range[max]", String(Math.floor(Number(criteria.activeJobsMaximum))));
  if (criteria.jobPostedAfter) params.set("organization_job_posted_at_range[min]", String(criteria.jobPostedAfter));
  if (criteria.jobPostedBefore) params.set("organization_job_posted_at_range[max]", String(criteria.jobPostedBefore));
  if (Number.isFinite(Number(criteria.revenueMinimum)) && Number(criteria.revenueMinimum) > 0) params.set("revenue_range[min]", String(Math.floor(Number(criteria.revenueMinimum))));
  if (Number.isFinite(Number(criteria.revenueMaximum)) && Number(criteria.revenueMaximum) > 0) params.set("revenue_range[max]", String(Math.floor(Number(criteria.revenueMaximum))));
  appendList(params, "currently_using_any_of_technology_uids", values(criteria.technologyValue).map(value => value.toLowerCase().replace(/[ .]+/g, "_")));

  const hasStructuredPromptFilters = titles.length || locations.length || industries.length || selectedSeniority.length || quickTitles.length || quickLocations.length || quickIndustries.length;
  const keywordParts = [hasStructuredPromptFilters ? inferred.keywords : criteria.prompt, criteria.companyValue, ...includedKeywords]
    .map(value => String(value || "").trim()).filter(Boolean);
  if (keywordParts.length) params.set("q_keywords", [...new Set(keywordParts)].join(" "));
  if (String(criteria.searchText || "").trim()) params.set("q_person_name", String(criteria.searchText).trim());
  if (criteria.includeSimilarTitles === false && titles.length) params.set("include_similar_titles", "false");
  params.set("page", String(Math.min(MAX_PAGES, Math.max(1, Math.floor(Number(page) || 1)))));
  params.set("per_page", String(Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(perPage) || 25)))));
  return params;
}

function buildApolloOrganizationSearchParams(criteria = {}, page = 1, perPage = 25) {
  const params = new URLSearchParams();
  const append = (key, input) => appendList(params, key, input);
  const companyName = String(criteria.companyName || "").trim();
  if (companyName) params.set("q_organization_name", companyName);
  append("q_organization_keyword_tags", criteria.keywords);
  append("q_not_organization_keyword_tags", criteria.excludedKeywords);
  append("organization_industries", values(criteria.industries).map(value => value.toLowerCase()));
  append("organization_locations", criteria.locations ? [criteria.locations] : []);
  append("organization_not_locations", criteria.excludedLocations ? [criteria.excludedLocations] : []);
  append("q_organization_domains_list", criteria.companyDomains);
  append("not_organization_websites_list", criteria.excludedDomains);
  append("organization_num_employees_ranges", employeeRanges(criteria.companySizeRanges));
  append("lookalike_organization_ids", criteria.lookalikeOrganizationIds);
  append("currently_using_any_of_technology_uids", values(criteria.technologies).map(value => value.toLowerCase().replace(/[ .]+/g, "_")));
  append("q_organization_job_titles", criteria.activeJobTitles);
  append("organization_job_locations", criteria.activeJobLocations);
  for (const [key, value] of [
    ["revenue_range[min]", criteria.revenueMinimum], ["revenue_range[max]", criteria.revenueMaximum],
    ["organization_num_jobs_range[min]", criteria.activeJobsMinimum], ["organization_num_jobs_range[max]", criteria.activeJobsMaximum],
    ["latest_funding_amount_range[min]", criteria.latestFundingMinimum], ["latest_funding_amount_range[max]", criteria.latestFundingMaximum],
    ["total_funding_range[min]", criteria.totalFundingMinimum], ["total_funding_range[max]", criteria.totalFundingMaximum],
    ["organization_headcount_growth_range[min]", criteria.headcountGrowthMinimum], ["organization_headcount_growth_range[max]", criteria.headcountGrowthMaximum],
  ]) {
    if (value !== "" && value != null) params.set(key, String(Math.floor(Number(value))));
  }
  if (criteria.jobPostedAfter) params.set("organization_job_posted_at_range[min]", String(criteria.jobPostedAfter));
  if (criteria.jobPostedBefore) params.set("organization_job_posted_at_range[max]", String(criteria.jobPostedBefore));
  if (criteria.latestFundingDateAfter) params.set("latest_funding_date_range[min]", String(criteria.latestFundingDateAfter));
  if (criteria.latestFundingDateBefore) params.set("latest_funding_date_range[max]", String(criteria.latestFundingDateBefore));
  if (criteria.headcountGrowthPeriod) params.set("organization_headcount_growth_past_n_months", String(criteria.headcountGrowthPeriod));
  params.set("page", String(Math.min(MAX_PAGES, Math.max(1, Math.floor(Number(page) || 1)))));
  params.set("per_page", String(Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(perPage) || 25)))));
  return params;
}

function validateOrganizationCriteria(criteria = {}) {
  const lookalikeIds = values(criteria.lookalikeOrganizationIds);
  if (lookalikeIds.length > 5 || lookalikeIds.some(id => !/^[a-zA-Z0-9_-]{6,128}$/.test(id))) {
    throw Object.assign(new Error("Choose up to five valid Apollo companies as lookalike seeds."), { statusCode: 400 });
  }
  const ranges = String(criteria.companySizeRanges || "").split(/[;\n]+/).map(range => range.trim()).filter(Boolean);
  const parsed = employeeRanges(criteria.companySizeRanges);
  if (ranges.length && (parsed.length !== ranges.length || parsed.some(([min, max]) => !Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 0))) {
    throw Object.assign(new Error("Enter employee ranges like 1-50; 51-200."), { statusCode: 400 });
  }
  const numeric = [criteria.revenueMinimum, criteria.revenueMaximum, criteria.activeJobsMinimum, criteria.activeJobsMaximum, criteria.latestFundingMinimum, criteria.latestFundingMaximum, criteria.totalFundingMinimum, criteria.totalFundingMaximum]
    .filter(value => value !== "" && value != null).map(Number);
  if (numeric.some(value => !Number.isInteger(value) || value < 0)) {
    throw Object.assign(new Error("Revenue, funding, and active-job bounds must be non-negative whole numbers."), { statusCode: 400 });
  }
  for (const key of ["activeJobsMinimum", "activeJobsMaximum"]) {
    const value = criteria[key];
    if (value !== "" && value != null && !Number.isInteger(Number(value))) {
      throw Object.assign(new Error("Active job counts must be whole numbers."), { statusCode: 400 });
    }
  }
  if (criteria.revenueMinimum !== "" && criteria.revenueMinimum != null && criteria.revenueMaximum !== "" && criteria.revenueMaximum != null && Number(criteria.revenueMinimum) > Number(criteria.revenueMaximum)) {
    throw Object.assign(new Error("Minimum revenue must not exceed the maximum."), { statusCode: 400 });
  }
  if (criteria.activeJobsMinimum !== "" && criteria.activeJobsMinimum != null && criteria.activeJobsMaximum !== "" && criteria.activeJobsMaximum != null && Number(criteria.activeJobsMinimum) > Number(criteria.activeJobsMaximum)) {
    throw Object.assign(new Error("Minimum active jobs must not exceed the maximum."), { statusCode: 400 });
  }
  for (const [minimumKey, maximumKey, label] of [["latestFundingMinimum", "latestFundingMaximum", "Latest funding"], ["totalFundingMinimum", "totalFundingMaximum", "Total funding"]]) {
    const minimum = criteria[minimumKey]; const maximum = criteria[maximumKey];
    if (minimum !== "" && minimum != null && maximum !== "" && maximum != null && Number(minimum) > Number(maximum)) {
      throw Object.assign(new Error(`${label} minimum must not exceed the maximum.`), { statusCode: 400 });
    }
  }
  const growth = [criteria.headcountGrowthMinimum, criteria.headcountGrowthMaximum].filter(value => value !== "" && value != null).map(Number);
  if (growth.some(value => !Number.isInteger(value) || value < -100 || value > 10000)) {
    throw Object.assign(new Error("Headcount growth must be a whole percentage between -100 and 10,000."), { statusCode: 400 });
  }
  if (growth.length || criteria.headcountGrowthPeriod) {
    if (!growth.length || !["6", "12", "24"].includes(String(criteria.headcountGrowthPeriod || ""))) {
      throw Object.assign(new Error("Choose a 6, 12, or 24 month period and at least one headcount growth bound."), { statusCode: 400 });
    }
  }
  if (criteria.headcountGrowthMinimum !== "" && criteria.headcountGrowthMinimum != null && criteria.headcountGrowthMaximum !== "" && criteria.headcountGrowthMaximum != null && Number(criteria.headcountGrowthMinimum) > Number(criteria.headcountGrowthMaximum)) {
    throw Object.assign(new Error("Minimum headcount growth must not exceed the maximum."), { statusCode: 400 });
  }
  const dates = [criteria.jobPostedAfter, criteria.jobPostedBefore, criteria.latestFundingDateAfter, criteria.latestFundingDateBefore].map(value => String(value || ""));
  const validDate = value => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
  if (dates.some(value => !validDate(value)) || (dates[0] && dates[1] && dates[0] > dates[1])) {
    throw Object.assign(new Error("Job posting dates must be valid YYYY-MM-DD dates in ascending order."), { statusCode: 400 });
  }
  if (dates[2] && dates[3] && dates[2] > dates[3]) {
    throw Object.assign(new Error("Latest funding dates must be in ascending order."), { statusCode: 400 });
  }
  if (criteria.companyName && String(criteria.companyName).length > 200) {
    throw Object.assign(new Error("Company name must be 200 characters or fewer."), { statusCode: 400 });
  }
}

function validateOrganizationEnrichmentDetails(input) {
  if (!Array.isArray(input) || !input.length || input.length > 10) {
    throw Object.assign(new Error("Select between one and ten companies to enrich."), { statusCode: 400 });
  }
  return input.map((company, index) => {
    const detail = {};
    for (const key of ["domain", "linkedin_url", "name", "website"]) {
      const value = String(company?.[key] || "").trim();
      if (value) {
        if (value.length > 500) throw Object.assign(new Error(`Company ${index + 1} has an identifier that is too long.`), { statusCode: 400 });
        detail[key] = value;
      }
    }
    if (!detail.domain && !detail.linkedin_url && !detail.name && !detail.website) {
      throw Object.assign(new Error(`Company ${index + 1} needs a name, domain, website, or LinkedIn URL.`), { statusCode: 400 });
    }
    return detail;
  });
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Search request is too large."), { statusCode: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw Object.assign(new Error("Search request must be valid JSON."), { statusCode: 400 });
  }
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function toSafeError(responseStatus) {
  if (responseStatus === 401) return { status: 401, code: "APOLLO_KEY_REJECTED", message: "Apollo could not authenticate this API key. Check that it is active and copied correctly." };
  if (responseStatus === 403) return { status: 403, code: "APOLLO_ACCESS_DENIED", message: "This Apollo account or API key does not have access to People API Search. Check the account's API entitlement or key type." };
  if (responseStatus === 429) {
    return { status: 429, code: "APOLLO_RATE_LIMITED", message: "Apollo rate limit reached. Wait a moment before searching again." };
  }
  if (responseStatus === 422) {
    return { status: 422, code: "APOLLO_INVALID_FILTERS", message: "Apollo could not use one or more search filters. Review the selected values and try again." };
  }
  return { status: 502, code: "APOLLO_UPSTREAM_ERROR", message: "Apollo could not complete this search. Try again shortly." };
}

export function apolloApiPlugin() {
  return {
    name: "apollo-api-proxy",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url || "/", "http://localhost").pathname;
        if (pathname !== "/api/apollo/status" && pathname !== "/api/apollo/connect" && pathname !== "/api/apollo/disconnect" && pathname !== "/api/apollo/people/search" && pathname !== "/api/apollo/companies/search" && pathname !== "/api/apollo/companies/enrich" && pathname !== "/api/apollo/people/enrich" && pathname !== "/api/apollo/assistant/task" && pathname !== "/api/apollo/assistant/poll") return next();

        const apiKey = activeApiKey();
        if (pathname === "/api/apollo/status") {
          if (request.method !== "GET") return sendJson(response, 405, { error: "Method not allowed." });
          return sendJson(response, 200, { configured: Boolean(apiKey), provider: apiKey ? "apollo" : "demo", source: sessionApiKey ? "session" : process.env.APOLLO_API_KEY?.trim() ? "environment" : null });
        }

        if (request.method !== "POST") return sendJson(response, 405, { error: "Method not allowed." });
        if (pathname === "/api/apollo/connect" || pathname === "/api/apollo/disconnect") {
          const origin = request.headers.origin;
          if (origin) {
            try {
              if (new URL(origin).host !== String(request.headers.host || "")) return sendJson(response, 403, { code: "LOCAL_ORIGIN_ONLY", message: "Apollo keys can only be managed from this local workspace." });
            } catch {
              return sendJson(response, 403, { code: "LOCAL_ORIGIN_ONLY", message: "Apollo keys can only be managed from this local workspace." });
            }
          }
          try {
            if (pathname === "/api/apollo/disconnect") {
              sessionApiKey = "";
              const fallbackKey = process.env.APOLLO_API_KEY?.trim() || "";
              return sendJson(response, 200, { configured: Boolean(fallbackKey), provider: fallbackKey ? "apollo" : "demo", source: fallbackKey ? "environment" : null });
            }
            const body = await readJsonBody(request);
            const candidate = String(body.apiKey || "").trim();
            if (candidate.length < 12 || candidate.length > 2048 || /[\r\n]/.test(candidate)) {
              return sendJson(response, 400, { code: "INVALID_API_KEY_FORMAT", message: "Paste the Apollo API key exactly as shown in Apollo." });
            }
            const upstream = await fetch(`${API_ORIGIN}${AUTH_HEALTH_PATH}`, {
              method: "GET",
              headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "Accept": "application/json", "x-api-key": candidate },
              signal: AbortSignal.timeout(12_000),
            });
            if (!upstream.ok) {
              const status = upstream.status === 401 ? 401 : upstream.status === 403 ? 403 : upstream.status === 429 ? 429 : 502;
              const message = status === 401 ? "Apollo rejected this API key. Check that it is active and copied correctly." : status === 403 ? "Apollo could not validate this key with the current account or API access." : status === 429 ? "Apollo rate limited the key check. Wait a moment and retry." : "Apollo could not validate the key right now. Try again shortly.";
              return sendJson(response, status, { code: status === 401 ? "APOLLO_KEY_REJECTED" : status === 403 ? "APOLLO_KEY_ACCESS_DENIED" : status === 429 ? "APOLLO_RATE_LIMITED" : "APOLLO_HEALTH_CHECK_FAILED", message });
            }
            const health = await upstream.json();
            if (health.healthy !== true || health.is_logged_in !== true) {
              return sendJson(response, 401, { code: "APOLLO_KEY_UNHEALTHY", message: "Apollo did not confirm this API key is ready. Check the key and account, then try again." });
            }
            sessionApiKey = candidate;
            return sendJson(response, 200, { configured: true, provider: "apollo", source: "session", validated: true });
          } catch (error) {
            const status = Number(error?.statusCode) || 502;
            return sendJson(response, status, { code: "APOLLO_CONNECTION_ERROR", message: error?.name === "TimeoutError" ? "Apollo's key check timed out. Try again." : error?.message || "Could not update the Apollo connection." });
          }
        }
        if (!apiKey) {
          return sendJson(response, 503, {
            code: "APOLLO_API_KEY_MISSING",
            message: "Connect Apollo by setting APOLLO_API_KEY in the local server environment and restarting the preview.",
          });
        }

        try {
          const body = await readJsonBody(request);
          if (pathname === "/api/apollo/assistant/task" || pathname === "/api/apollo/assistant/poll") {
            const isPoll = pathname.endsWith("/poll");
            const taskId = String(body.taskId || "").trim();
            const instruction = String(body.instruction || "").trim();
            if ((taskId && !/^[a-zA-Z0-9_-]{8,128}$/.test(taskId)) || (!isPoll && !instruction) || (isPoll && !taskId)) {
              return sendJson(response, 400, { code: "INVALID_ASSISTANT_TASK", message: isPoll ? "A valid Apollo assistant task ID is required." : "An instruction is required to run Apollo Assistant." });
            }
            if (instruction.length > 20_000) {
              return sendJson(response, 413, { code: "ASSISTANT_INSTRUCTION_TOO_LARGE", message: "Keep Apollo Assistant instructions under 20,000 characters." });
            }
            const cursor = body.cursor == null ? null : Number(body.cursor);
            if (isPoll && cursor !== null && (!Number.isInteger(cursor) || cursor < 0)) {
              return sendJson(response, 400, { code: "INVALID_ASSISTANT_CURSOR", message: "The Apollo Assistant message cursor must be a non-negative whole number." });
            }
            const upstreamBody = isPoll
              ? { task_id: taskId, ...(cursor == null ? {} : { cursor }) }
              : { ...(taskId ? { task_id: taskId } : {}), instruction };
            const upstream = await fetch(`${API_ORIGIN}${isPoll ? ASSISTANT_POLL_PATH : ASSISTANT_TASK_PATH}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
                "Accept": "application/json",
                "x-api-key": apiKey,
              },
              body: JSON.stringify(upstreamBody),
              signal: AbortSignal.timeout(25_000),
            });
            if (!upstream.ok) {
              const status = upstream.status;
              const mapped = status === 401
                ? { status: 401, code: "APOLLO_KEY_REJECTED", message: "Apollo could not authenticate this API key. Check that it is active and copied correctly." }
                : status === 403
                  ? { status: 403, code: "APOLLO_ASSISTANT_ACCESS_DENIED", message: "This API key cannot access Apollo Assistant tasks, or this task belongs to a different Apollo user." }
                  : status === 422
                    ? { status: 422, code: "APOLLO_ASSISTANT_TASK_INVALID", message: "Apollo could not find or continue this assistant task. Start a new conversation and try again." }
                    : status === 429
                      ? { status: 429, code: "APOLLO_RATE_LIMITED", message: "Apollo rate limit reached. Wait before sending or polling again." }
                      : { status: 502, code: "APOLLO_ASSISTANT_ERROR", message: "Apollo Assistant could not process this request. Try again shortly." };
              return sendJson(response, mapped.status, mapped);
            }
            return sendJson(response, 200, await upstream.json());
          }
          if (pathname === "/api/apollo/people/enrich") {
            const personId = String(body.personId || "").trim();
            if (!/^[a-zA-Z0-9_-]{6,128}$/.test(personId)) {
              return sendJson(response, 400, { code: "INVALID_PERSON_ID", message: "A valid Apollo person ID is required." });
            }
            const params = new URLSearchParams({
              id: personId,
              reveal_personal_emails: "false",
              reveal_phone_number: "false",
              run_waterfall_email: "false",
              run_waterfall_phone: "false",
            });
            const upstream = await fetch(`${API_ORIGIN}${PEOPLE_ENRICH_PATH}?${params}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
                "Accept": "application/json",
                "x-api-key": apiKey,
              },
              body: "{}",
              signal: AbortSignal.timeout(20_000),
            });
            if (!upstream.ok) {
              const mapped = toSafeError(upstream.status);
              return sendJson(response, mapped.status, { code: mapped.code, message: mapped.message });
            }
            const data = await upstream.json();
            const person = data.person || null;
            const matched = Boolean(person && person.match_confidence !== "none");
            return sendJson(response, 200, {
              matched,
              matchConfidence: person?.match_confidence || "none",
              email: typeof person?.email === "string" ? person.email : null,
              emailStatus: person?.email_status || null,
              message: matched ? null : "Apollo did not find an enrichable contact for this person.",
            });
          }
          if (pathname === "/api/apollo/companies/search") {
            validateOrganizationCriteria(body.criteria);
            const page = Math.min(MAX_PAGES, Math.max(1, Math.floor(Number(body.page) || 1)));
            const perPage = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(body.perPage) || 25)));
            const params = buildApolloOrganizationSearchParams(body.criteria, page, perPage);
            const upstream = await fetch(`${API_ORIGIN}${ORGANIZATION_SEARCH_PATH}?${params}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
                "Accept": "application/json",
                "x-api-key": apiKey,
              },
              body: "{}",
              signal: AbortSignal.timeout(20_000),
            });
            if (!upstream.ok) {
              const status = upstream.status;
              const mapped = status === 401
                ? { status: 401, code: "APOLLO_KEY_REJECTED", message: "Apollo could not authenticate this API key. Check that it is active and copied correctly." }
                : status === 403
                  ? { status: 403, code: "APOLLO_ORGANIZATION_ACCESS_DENIED", message: "This Apollo account or API key cannot use Organization Search. Check the account's API access and eligibility." }
                  : status === 422
                    ? { status: 422, code: "APOLLO_INVALID_FILTERS", message: "Apollo could not use one or more company search filters. Review the values and try again." }
                    : status === 429
                      ? { status: 429, code: "APOLLO_RATE_LIMITED", message: "Apollo rate limit reached. Wait a moment before searching again." }
                      : { status: 502, code: "APOLLO_UPSTREAM_ERROR", message: "Apollo could not complete this company search. Try again shortly." };
              return sendJson(response, mapped.status, { code: mapped.code, message: mapped.message });
            }
            const data = await upstream.json();
            const organizations = Array.isArray(data.organizations) ? data.organizations : [];
            const total = Number(data.total_entries ?? data.pagination?.total_entries ?? data.total) || organizations.length;
            return sendJson(response, 200, {
              provider: "apollo",
              organizations,
              total,
              page,
              perPage,
              hasMore: page < MAX_PAGES && page * perPage < total,
              creditCost: 1,
            });
          }
          if (pathname === "/api/apollo/companies/enrich") {
            const details = validateOrganizationEnrichmentDetails(body.companies);
            const upstream = await fetch(`${API_ORIGIN}${ORGANIZATION_BULK_ENRICH_PATH}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
                "Accept": "application/json",
                "x-api-key": apiKey,
              },
              body: JSON.stringify({ details }),
              signal: AbortSignal.timeout(20_000),
            });
            if (!upstream.ok) {
              const status = upstream.status;
              const mapped = status === 401
                ? { status: 401, code: "APOLLO_KEY_REJECTED", message: "Apollo could not authenticate this API key. Check that it is active and copied correctly." }
                : status === 403
                  ? { status: 403, code: "APOLLO_ORGANIZATION_ENRICH_ACCESS_DENIED", message: "This Apollo account or API key cannot use Organization Enrichment. Check API access and account eligibility." }
                  : status === 400
                    ? { status: 400, code: "APOLLO_ORGANIZATION_ENRICH_INVALID", message: "Apollo could not accept this company enrichment request. Check the selected companies and try again." }
                  : status === 422
                    ? { status: 422, code: "APOLLO_ORGANIZATION_ENRICH_INVALID", message: "Apollo could not match or enrich one or more companies. Check their names, domains, websites, and LinkedIn URLs." }
                    : status === 429
                      ? { status: 429, code: "APOLLO_RATE_LIMITED", message: "Apollo rate limit reached. Wait a moment before enriching companies again." }
                      : { status: 502, code: "APOLLO_UPSTREAM_ERROR", message: "Apollo could not complete company enrichment. Try again shortly." };
              return sendJson(response, mapped.status, { code: mapped.code, message: mapped.message });
            }
            const data = await upstream.json();
            const organizations = Array.isArray(data.organizations)
              ? data.organizations
              : Array.isArray(data.matches)
                ? data.matches
                : data.organization ? [data.organization] : [];
            return sendJson(response, 200, { provider: "apollo", organizations, requested: details.length, creditCost: organizations.length });
          }
          validateCriteria(body.criteria);
          const params = buildApolloSearchParams(body.criteria, body.page, body.perPage);
          const upstream = await fetch(`${API_ORIGIN}${PEOPLE_SEARCH_PATH}?${params}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache",
              "Accept": "application/json",
              "x-api-key": apiKey,
            },
            body: "{}",
            signal: AbortSignal.timeout(20_000),
          });

          if (!upstream.ok) {
            const mapped = toSafeError(upstream.status);
            return sendJson(response, mapped.status, { code: mapped.code, message: mapped.message });
          }

          const data = await upstream.json();
          const currentPage = Math.min(MAX_PAGES, Math.max(1, Math.floor(Number(body.page) || 1)));
          const perPage = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(body.perPage) || 25)));
          const total = Number(data.total_entries) || 0;
          const limitations = ["People API Search does not return email addresses or phone numbers."];
          if (body.criteria?.companyMode === "past") limitations.push("Past-company filtering is not exposed by Apollo People API Search.");
          if (body.criteria?.companyMode === "past" && (body.criteria?.companyDomains || body.criteria?.excludedCompanyDomains)) limitations.push("Apollo's domain filters can match current or past employers, but cannot restrict domain matches to past employers only.");
          if (body.criteria?.companyDomainOnly) limitations.push("Apollo People API Search has no general known-domain-only flag. Use Company domains to include specific domains, or apply this as a demo-only filter.");
          if (body.criteria?.pastTitleValue) limitations.push("Including past job titles is not exposed by Apollo People API Search.");
          if (body.criteria?.excludedKeywordValue) limitations.push("Excluded company keywords are not exposed by Apollo People API Search.");
          if (body.criteria?.keywordType && body.criteria.keywordType !== "Keywords" && body.criteria.keywordValue) limitations.push("Apollo's q_keywords field is broad and cannot constrain company matches to the selected name or description field.");
          if (Array.isArray(body.criteria?.selectedDepartments) && body.criteria.selectedDepartments.length) limitations.push("Department filters are not exposed by Apollo People API Search.");
          if (body.criteria?.excludedIndustryValue) limitations.push("Industry exclusions by name are not exposed by Apollo People API Search.");
          if (body.criteria?.jobTitleKnowledge && body.criteria.jobTitleKnowledge !== "any") limitations.push("Known or unknown title status is not exposed by Apollo People API Search.");
          if (body.criteria?.industryKnowledge && body.criteria.industryKnowledge !== "not-any-of") limitations.push("Known or unknown industry status is not exposed by Apollo People API Search.");
          if (body.criteria?.locationRadius && body.criteria.locationRadius !== "Any distance") limitations.push("Radius filtering is applied only to local demo records; Apollo People API Search accepts location terms but no radius parameter.");
          if (body.criteria?.companyValue) limitations.push("The company name is included as a broad keyword because this endpoint does not expose exact company-name filtering.");
          if (body.criteria?.keywordType === "Name") limitations.push("Company-name keyword matching is broad; Apollo People API Search has no exact company-name field.");
          return sendJson(response, 200, {
            provider: "apollo",
            people: Array.isArray(data.people) ? data.people : [],
            total,
            page: currentPage,
            perPage,
            hasMore: currentPage < MAX_PAGES && currentPage * perPage < total,
            limitations,
          });
        } catch (error) {
          if (error?.statusCode) return sendJson(response, error.statusCode, { code: "INVALID_REQUEST", message: error.message });
          if (error?.name === "TimeoutError" || error?.name === "AbortError") {
            return sendJson(response, 504, { code: "APOLLO_TIMEOUT", message: "Apollo took too long to respond. Try again." });
          }
          return sendJson(response, 502, { code: "APOLLO_CONNECTION_ERROR", message: "Could not reach Apollo. Check your network connection and try again." });
        }
      });
    },
  };
}
