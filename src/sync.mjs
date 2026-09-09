import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { parse } from "csv-parse/sync";
import { google } from "googleapis";

const required = ["TARGET_URL", "PORTAL_EMAIL", "PORTAL_PASSWORD", "GOOGLE_SHEET_ID", "GOOGLE_SERVICE_ACCOUNT_JSON"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const env = (name, fallback) => process.env[name] || fallback;
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "leader-dna-") );
const downloadPath = path.join(tempDir, "export.csv");
const headless = env("HEADLESS", "true") !== "false";

function parseServiceAccount(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON must be JSON or base64-encoded JSON");
    }
  }
}

function csvRows(csvText) {
  const records = parse(csvText.replace(/^\uFEFF/, ""), {
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
  if (!records.length) return [];
  const [header, ...rows] = records;
  return rows.map((row) => Object.fromEntries(header.map((key, i) => [String(key).trim(), row[i] ?? ""])));
}

function rowKey(row) {
  return JSON.stringify(Object.entries(row).map(([key, value]) => [key, String(value).trim()]));
}

async function exportCsv(page) {
  const button = page.getByText(new RegExp(env("EXPORT_BUTTON_TEXT", "匯出.*CSV"), "i")).first();
  await button.waitFor({ state: "visible", timeout: 30_000 });
  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await button.click();
  const download = await downloadPromise;
  await download.saveAs(downloadPath);
}

async function main() {
  const browser = await chromium.launch({ headless, args: ["--disable-dev-shm-usage"] });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  try {
    await page.goto(process.env.TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const email = page.locator(env("LOGIN_EMAIL_SELECTOR", 'input[type="email"]')).first();
    if (await email.isVisible().catch(() => false)) {
      await email.fill(process.env.PORTAL_EMAIL);
      await page.locator(env("LOGIN_PASSWORD_SELECTOR", 'input[type="password"]')).first().fill(process.env.PORTAL_PASSWORD);
      await page.locator(env("LOGIN_SUBMIT_SELECTOR", 'button[type="submit"]')).first().click();
      await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
    }

    await exportCsv(page);
  } finally {
    await browser.close();
  }

  const csvText = await fs.readFile(downloadPath, "utf8");
  const incoming = csvRows(csvText).slice(0, Number(env("MAX_ROWS", "10000")));
  if (!incoming.length) throw new Error("The exported CSV contains no data rows");

  const serviceAccount = parseServiceAccount(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({ credentials: serviceAccount, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const tab = env("SHEET_TAB", "raw_export");
  const existing = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${tab}!A:ZZ` });
  const existingValues = existing.data.values || [];
  const header = Object.keys(incoming[0]);
  const known = new Set(existingValues.slice(1).map((row) => rowKey(Object.fromEntries(header.map((key, i) => [key, row[i] ?? ""])) )));
  const fresh = incoming.filter((row) => !known.has(rowKey(row)));
  if (!fresh.length) {
    console.log(JSON.stringify({ ok: true, added: 0, totalExported: incoming.length }));
    return;
  }

  if (!existingValues.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [header, ...fresh.map((row) => header.map((key) => row[key] ?? ""))] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${tab}!A:ZZ`,
      valueInputOption: "RAW",
      requestBody: { values: fresh.map((row) => header.map((key) => row[key] ?? "")) },
    });
  }
  console.log(JSON.stringify({ ok: true, added: fresh.length, totalExported: incoming.length }));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

