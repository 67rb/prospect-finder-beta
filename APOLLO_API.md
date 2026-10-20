> **BETA:** This guide describes an experimental prototype; the integration is not production-ready.

# Apollo People API connection

The local Vite server exposes a small server-side proxy for Apollo People API Search. The browser never receives the API key.

1. Create an Apollo API key with access to People API Search.
2. Copy `.env.example` to `.env.local` and set `APOLLO_API_KEY` there.
3. Restart the local preview. The Find People search form will query Apollo; without a key, the interface stays in clearly labeled demo mode.

The proxy calls `POST https://api.apollo.io/api/v1/mixed_people/api_search`, passes the key in the `x-api-key` header, and accepts up to 100 results per page and 500 pages. The UI offers 25, 50, and 100 results per page. It supports current-title inclusion, current and past-title exclusions, person or employer-HQ location, include/exclude employer domains, industry, broad company keywords, seniority, email-status, employee-count ranges, revenue bounds, technologies, active hiring titles/locations/count/date ranges, name, and pagination filters. Employee ranges accept forms such as `1-50; 1,000-5,000` or Apollo's comma-pair format `1,50; 1000,5000`. Apollo's documented People API Search endpoint uses no credits, but eligibility and access can depend on the Apollo account.

An explicit per-person email lookup uses Apollo's People Enrichment endpoint after confirmation in the UI. The proxy sends the Apollo person ID and explicitly leaves personal-email, phone, and waterfall enrichment disabled. Apollo documents enrichment as potentially credit-consuming (1–9 credits per person depending on results and configuration); the confirmation dialog shows this before the request.

Known API boundaries are surfaced in the results UI: People API Search does not return email addresses or phone numbers; exact company-name matching, past-company matching, a general known-domain-only switch, radius search, department selection, excluded company keywords, and several known/unknown states are not exposed by that endpoint. Keyword type selection maps to Apollo's broad `q_keywords` search rather than a field-specific match. Domain filters accept include and exclude lists, but Apollo applies include matches across current or previous employers rather than limiting them to the selected company-history mode. Email enrichment is individual and user-triggered; the prototype does not request personal emails or phone numbers or create records in the Apollo workspace.

The Vite proxy is for the local preview. A production deployment needs a server-side API proxy configured with its own secret manager; the static Sites worker remains unchanged and does not receive the key.
