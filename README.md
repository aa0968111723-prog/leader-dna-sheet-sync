# Leader DNA → Google Sheets synchronizer

This is a one-shot worker. Each run opens the authorized partner dashboard with Playwright, downloads the CSV export, removes rows already present in Google Sheets, and appends only new rows.

## Required setup

1. Use a dedicated read-only dashboard account approved by the site owner.
2. Create a private Google Sheet and a Google Cloud service account with the Google Sheets API enabled. Share the sheet with the service account email as Editor.
3. Add the variables in `.env.example` to the deployment's secret/environment-variable settings. Keep credentials out of Git.
4. Confirm the login and export selectors. The defaults are only guesses; the website's actual HTML must be checked once.

## Local check

```bash
npm install
npm run check
npm run sync
```

## Deploy

Deploy this repository as a private Zeabur service using the included `Dockerfile`. Run it as a scheduled/cron job so the container runs `npm run sync` once per schedule and exits. Start with once daily; change to hourly only after a successful test.

Never log or commit the dashboard password, service-account JSON, student phone numbers, or downloaded CSV.

