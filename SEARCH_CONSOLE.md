# Google Search Console Setup

Canonical property for now:

```text
https://lonelyguy.vercel.app/
```

The future custom domain should replace `baseUrl` and `gsc.propertyUrl` in
`site.config.json` after the domain is purchased and verified.

## One-Time Local Setup

1. Enable the Google Search Console API in a Google Cloud project.
2. Install Google Cloud SDK if the `gsc` CLI asks for it:

```powershell
winget install Google.CloudSDK
```

3. Install dependencies:

```powershell
npm install
```

4. Authenticate the CLI:

```powershell
npx gsc auth login
```

5. Add or verify the URL-prefix property in Google Search Console:

```text
https://lonelyguy.vercel.app/
```

This repo keeps the existing HTML-file verification method:

```text
google6cb4e7d9840b7dd9.html
```

6. Optionally store the default property in the CLI config:

```powershell
npx gsc config set defaultSite https://lonelyguy.vercel.app/
```

Do not commit service-account keys, OAuth exports, or raw Search Console
reports. The repo ignores `.seo-reports/` and common local credential filenames.

## Routine Commands

Build and validate the static site:

```powershell
npm run build
npm run seo:validate
```

Submit the sitemap:

```powershell
npm run seo:gsc:submit
```

Inspect sitemap URLs for indexing errors:

```powershell
New-Item -ItemType Directory -Force .seo-reports
npm run seo:gsc:inspect
```

Export the last 28 days of page/query analytics:

```powershell
New-Item -ItemType Directory -Force .seo-reports
npm run seo:gsc:analytics
```

Run a Lighthouse snapshot against the deployed homepage:

```powershell
New-Item -ItemType Directory -Force .seo-reports
npm run perf:lighthouse
```

## Pre-Deploy Checklist

- `npm run build` completes.
- `npm run seo:validate` passes.
- `sitemap.xml`, `robots.txt`, `llms.txt`, `search-index.json`, and
  `site-index.json` are regenerated.
- New important pages appear in `sitemap.xml`.
- The deployed property in Search Console matches `site.config.json`.
