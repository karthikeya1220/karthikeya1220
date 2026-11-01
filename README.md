# GitHub Streak Badge

Custom GraphQL-based streak badge for GitHub profiles.

## How It Works

- Queries GitHub's GraphQL API for the full contribution calendar (365 days, including private contributions)
- Computes current streak, longest streak, total contributions
- Returns an SVG badge styled in Tokyo Night theme
- Caches for 1 hour (browser) / 24 hours (CDN/edge)
- Supports a custom streak start date via `STREAK_START_DATE` env var

## Why This Exists

Third-party streak services (demolab, Vercel instances) show only 7-9 days for this account because they:
1. Parse the public contribution heatmap SVG (fragile, misses cells)
2. Use the REST events API (only returns 90 days of public events)
3. Cannot see private contributions

This badge uses the **GitHub GraphQL API** directly, which returns the complete 365-day calendar with private contributions, giving the accurate streak.

## Setup

1. Create a new project on Vercel
2. Add environment variables:
   - `GITHUB_TOKEN` — GitHub Personal Access Token with `repo` scope (for GraphQL + private contribution access)
   - `STREAK_START_DATE` (optional) — Custom streak start date in YYYY-MM-DD format. Use this if your streak started before the current calendar window (e.g. `2025-10-17`).
3. Deploy

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Yes | GitHub Personal Access Token with `repo` scope |
| `STREAK_START_DATE` | No | Custom streak start date (YYYY-MM-DD). Default: uses calendar-calculated streak start. |

## Badge URL

After deployment, the badge endpoint is at:

```
https://<your-vercel-app>.vercel.app/api/streak?user=karthikeya1220
```

Use in GitHub README:

```md
![GitHub Streak](https://<your-vercel-app>.vercel.app/api/streak?user=karthikeya1220)
```

## Current Data (as of Nov 1, 2026)

| Metric | Value |
|---|---|
| Current streak | 365 days |
| Streak range | Oct 17, 2025 – Nov 1, 2026 |
| Longest streak | 365 days |
| Longest range | Nov 2, 2025 – Nov 1, 2026 |
| Total contributions | 1,533 (since Oct 17, 2025) |

## Deploy via GitHub Actions

This repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that deploys to Vercel on every push to `main`. Set these secrets in your GitHub repo:

- `VERCEL_TOKEN` — Vercel API token
- `VERCEL_ORG_ID` — Vercel organization ID
- `VERCEL_PROJECT_ID` — Vercel project ID
