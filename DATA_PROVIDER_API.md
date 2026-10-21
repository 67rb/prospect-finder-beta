# Data provider API connection

> **BETA — experimental integration.** The interface and local proxy are a prototype; live access depends on the user's third-party account and has not been verified in this repository snapshot.

The local Vite server makes server-side requests to the fixed API origin declared in <code>server/data-provider-plugin.mjs</code>. The browser never receives the API key.

1. Create an API key for the configured people-search provider.
2. Copy <code>.env.example</code> to <code>.env.local</code> and set <code>PROSPECT_DATA_API_KEY</code>.
3. Restart the local preview. The Find People view uses live data when the key is configured; otherwise, it stays in clearly labeled demo mode.

The proxy uses the provider's people search and enrichment endpoints, sends the key in the <code>x-api-key</code> header, and accepts up to 100 results per page. The UI offers 25, 50, and 100 results per page. Supported search fields include titles, person and employer locations, employer domains, industry, broad company keywords, seniority, email-status, employee-count ranges, revenue bounds, technologies, active hiring fields, name, and pagination. Employee ranges accept forms such as <code>1-50; 1,000-5,000</code> or <code>1,50; 1000,5000</code>. API access, eligibility, and credit rules depend on the account and endpoint.

An explicit per-person email lookup sends the provider person ID after confirmation in the UI. The proxy leaves personal-email, phone, and waterfall enrichment disabled. The provider may charge credits depending on the account and returned data.

Known API boundaries appear in the results UI: live search does not return email addresses or phone numbers; exact company-name matching, past-company matching, a general known-domain-only switch, radius search, department selection, excluded company keywords, and several known/unknown states are not exposed by the configured endpoint. Keyword type selection maps to a broad keyword field rather than a field-specific match. Domain filters may match current or previous employers rather than limiting results to the selected company-history mode. Email enrichment is individual and user-triggered; the prototype does not request personal emails or phone numbers or create records in the connected workspace.
