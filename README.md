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

## Automatic execution

The included GitHub Actions workflow can run the synchronizer manually or every hour. In the repository, open **Settings → Secrets and variables → Actions** and add these repository secrets:

```text
TARGET_URL
PORTAL_EMAIL
PORTAL_PASSWORD
GOOGLE_SHEET_ID
GOOGLE_SERVICE_ACCOUNT_JSON
```

Only add the selector secrets when the defaults do not match the website:

```text
LOGIN_EMAIL_SELECTOR
LOGIN_PASSWORD_SELECTOR
LOGIN_SUBMIT_SELECTOR
EXPORT_BUTTON_TEXT
SHEET_TAB
```

Open **Actions → Sync leader DNA data → Run workflow** for the first test. Once the test succeeds, the workflow will run hourly. The included `Dockerfile` can also be used to deploy the same one-shot worker to Zeabur as a scheduled job.

Never log or commit the dashboard password, service-account JSON, student phone numbers, or downloaded CSV.

