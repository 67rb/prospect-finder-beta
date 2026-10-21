# Prospect Finder

> **BETA — experimental prototype.** This is an independent prospect-search interface preview, not a production prospecting service. Live data access is optional, account-dependent, and has not been verified in this repository snapshot.

Prospect Finder is a responsive people-search workspace with filters, saved searches, result tabs, sorting, and prospect-saving interactions. It uses fictional sample prospects in demo mode and an optional server-side connection to a third-party people-search API. The interface is an independent prototype and does not imply endorsement or affiliation with a data provider.

## What is in this beta

- A browser-based prospect search interface with filter controls, quick filters, saved searches, and responsive layouts.
- Fictional sample prospects for demo mode without an API key.
- An optional server-side API proxy; the key stays on the local server rather than being sent to the browser.
- A user-confirmed individual email-enrichment path. It does not request personal email addresses or phone numbers.

## Beta limits

- Without <code>PROSPECT_DATA_API_KEY</code>, searches use sample data; live API access has not been verified in this repository snapshot.
- Search fields, eligibility, and returned data depend on the connected provider. The live search endpoint does not return email addresses or phone numbers.
- Several UI filters are approximations or are not supported by the connected search endpoint. See [DATA_PROVIDER_API.md](DATA_PROVIDER_API.md) for the documented mapping and API boundaries.
- Enrichment may consume provider credits. The prototype requires explicit confirmation before each per-person lookup.
- The local Vite proxy is not a production API service. A production deployment needs a protected server-side proxy and managed secrets.

## Run locally

Requirements: Node.js and npm.

~~~sh
npm install
npm run dev
~~~

To enable optional API access, copy <code>.env.example</code> to <code>.env.local</code>, set <code>PROSPECT_DATA_API_KEY</code>, and restart the local server. Never commit <code>.env.local</code> or a real API key.
