# Apollo Find People Remake

> **BETA — experimental prototype.** This is not an Apollo product or a production prospecting service. Live API use is optional, account-dependent, and not configured in this repository.

An independent, responsive prototype of Apollo's Find People workflow. It recreates the people-search workspace with a filter rail, quick filters, saved searches, result tabs, sorting, and prospect-saving interactions. The Apollo name is used only to identify the service this UI references; this project is not affiliated with Apollo.io.

## What is in this beta

- A browser-based Find People interface with filter controls, quick filters, saved searches, and responsive layouts.
- Fictional sample prospects for a usable demo mode without an API key.
- An optional server-side proxy for Apollo People API Search; the key stays on the local server rather than being sent to the browser.
- A user-confirmed individual enrichment path. It does not request personal email addresses or phone numbers.

## Beta limits

- Without `APOLLO_API_KEY`, searches use sample data; live API access has not been verified in this repository snapshot.
- Apollo account eligibility and endpoint access vary. Search does not provide email addresses or phone numbers.
- Several UI filters are approximations or are not supported by the People API Search endpoint. See [APOLLO_API.md](APOLLO_API.md) for the documented mapping and API boundaries.
- Enrichment may consume Apollo credits. The prototype requires an explicit confirmation before a per-person enrichment request.
- The local Vite proxy is not a production API service. A production deployment needs a protected server-side proxy and managed secrets.

## Run locally

Requirements: Node.js and npm.

```sh
npm install
npm run dev
```

To enable optional API access, copy `.env.example` to `.env.local`, set `APOLLO_API_KEY`, and restart the local server. Never commit `.env.local` or a real API key.
