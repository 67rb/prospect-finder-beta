# Prospect Finder

Prospect Finder is a beta sales workspace for searching, reviewing, saving, and organizing prospect records. It includes local demo data and can optionally connect to the Apollo API for supported people search and enrichment workflows.

## What is available

- Search and filter the included demo records.
- Save people, searches, and workspace lists in the browser.
- Import and export contact CSV files.
- Optionally connect Apollo for live search and email enrichment. Those actions require a valid provider API key and may use provider credits.

Demo data is illustrative. It is not live research or verified contact data. Without the provider connection, live search and enrichment are unavailable.

## Run locally

Requirements: Node.js and npm.

```sh
npm install
npm run dev
```

For optional Apollo API access, copy `.env.example` to `.env.local` and set `APOLLO_API_KEY`. Keep the key on the server; do not expose it to browser code or commit a populated environment file. See [APOLLO_API.md](APOLLO_API.md) for supported integration behavior.

## Project

This beta uses React and Vite. The local API server is in `server/`, and the Sites-compatible worker is in `worker/`.
