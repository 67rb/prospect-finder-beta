const API_ORIGIN = "https://api.apollo.io";
const PEOPLE_SEARCH_PATH = "/api/v1/mixed_people/api_search";
const PEOPLE_ENRICH_PATH = "/api/v1/people/match";
const MAX_BODY_BYTES = 32 * 1024;
const MAX_PAGE_SIZE = 100;
const MAX_PAGES = 500;

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

function buildProviderSearchParams(criteria = {}, page = 1, perPage = 25) {
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
  if (responseStatus === 401) return { status: 401, code: "PROSPECT_DATA_KEY_REJECTED", message: "The data provider could not authenticate this API key. Check that it is active and copied correctly." };
  if (responseStatus === 403) return { status: 403, code: "PROSPECT_DATA_ACCESS_DENIED", message: "This data-provider account or API key does not have access to People API Search. Check the account's API entitlement or key type." };
  if (responseStatus === 429) {
    return { status: 429, code: "PROSPECT_DATA_RATE_LIMITED", message: "The data provider rate limit reached. Wait a moment before searching again." };
  }
  if (responseStatus === 422) {
    return { status: 422, code: "PROSPECT_DATA_INVALID_FILTERS", message: "The data provider could not use one or more search filters. Review the selected values and try again." };
  }
  return { status: 502, code: "PROSPECT_DATA_UPSTREAM_ERROR", message: "The data provider could not complete this search. Try again shortly." };
}

export function dataProviderApiPlugin() {
  return {
    name: "prospect-data-api-proxy",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url || "/", "http://localhost").pathname;
        if (pathname !== "/api/data-provider/status" && pathname !== "/api/data-provider/people/search" && pathname !== "/api/data-provider/people/enrich") return next();

        const apiKey = process.env.PROSPECT_DATA_API_KEY?.trim();
        if (pathname === "/api/data-provider/status") {
          if (request.method !== "GET") return sendJson(response, 405, { error: "Method not allowed." });
          return sendJson(response, 200, { configured: Boolean(apiKey), provider: apiKey ? "live" : "demo" });
        }

        if (request.method !== "POST") return sendJson(response, 405, { error: "Method not allowed." });
        if (!apiKey) {
          return sendJson(response, 503, {
            code: "PROSPECT_DATA_API_KEY_MISSING",
            message: "Connect the data provider by setting PROSPECT_DATA_API_KEY in the local server environment and restarting the preview.",
          });
        }

        try {
          const body = await readJsonBody(request);
          if (pathname === "/api/data-provider/people/enrich") {
            const personId = String(body.personId || "").trim();
            if (!/^[a-zA-Z0-9_-]{6,128}$/.test(personId)) {
              return sendJson(response, 400, { code: "INVALID_PERSON_ID", message: "A valid live person ID is required." });
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
              message: matched ? null : "The data provider did not find an enrichable contact for this person.",
            });
          }
          validateCriteria(body.criteria);
          const params = buildProviderSearchParams(body.criteria, body.page, body.perPage);
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
          if (body.criteria?.companyMode === "past") limitations.push("Past-company filtering is not exposed by the data provider People API Search.");
          if (body.criteria?.companyMode === "past" && (body.criteria?.companyDomains || body.criteria?.excludedCompanyDomains)) limitations.push("the data provider's domain filters can match current or past employers, but cannot restrict domain matches to past employers only.");
          if (body.criteria?.companyDomainOnly) limitations.push("the data provider People API Search has no general known-domain-only flag. Use Company domains to include specific domains, or apply this as a demo-only filter.");
          if (body.criteria?.pastTitleValue) limitations.push("Including past job titles is not exposed by the data provider People API Search.");
          if (body.criteria?.excludedKeywordValue) limitations.push("Excluded company keywords are not exposed by the data provider People API Search.");
          if (body.criteria?.keywordType && body.criteria.keywordType !== "Keywords" && body.criteria.keywordValue) limitations.push("the data provider's q_keywords field is broad and cannot constrain company matches to the selected name or description field.");
          if (Array.isArray(body.criteria?.selectedDepartments) && body.criteria.selectedDepartments.length) limitations.push("Department filters are not exposed by the data provider People API Search.");
          if (body.criteria?.excludedIndustryValue) limitations.push("Industry exclusions by name are not exposed by the data provider People API Search.");
          if (body.criteria?.jobTitleKnowledge && body.criteria.jobTitleKnowledge !== "any") limitations.push("Known or unknown title status is not exposed by the data provider People API Search.");
          if (body.criteria?.industryKnowledge && body.criteria.industryKnowledge !== "not-any-of") limitations.push("Known or unknown industry status is not exposed by the data provider People API Search.");
          if (body.criteria?.locationRadius && body.criteria.locationRadius !== "Any distance") limitations.push("Radius filtering is applied only to local demo records; the data provider People API Search accepts location terms but no radius parameter.");
          if (body.criteria?.companyValue) limitations.push("The company name is included as a broad keyword because this endpoint does not expose exact company-name filtering.");
          if (body.criteria?.keywordType === "Name") limitations.push("Company-name keyword matching is broad; the data provider People API Search has no exact company-name field.");
          return sendJson(response, 200, {
            provider: "live",
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
            return sendJson(response, 504, { code: "PROSPECT_DATA_TIMEOUT", message: "The data provider took too long to respond. Try again." });
          }
          return sendJson(response, 502, { code: "PROSPECT_DATA_CONNECTION_ERROR", message: "Could not reach the data provider. Check your network connection and try again." });
        }
      });
    },
  };
}
