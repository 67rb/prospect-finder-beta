import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const checks = [];
const errors = [];
let currentCheck = "Open preview";
let failure = null;
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error") errors.push(`${message.text()} ${message.location().url || ""}`.trim()); });
const artifactPath = filename => fileURLToPath(new URL(filename, import.meta.url));

const rows = () => page.locator("tbody tr");
const savedTab = () => page.getByRole("tab", { name: /Saved/ });
const assertRows = async count => {
  await page.waitForFunction(expected => document.querySelectorAll("tbody tr").length === expected, count);
  assert.equal(await rows().count(), count);
};
const clearFilters = () => page.getByRole("button", { name: "Clear all", exact: true }).click();
const searchAll = async () => {
  await page.getByRole("combobox", { name: "Use Apollo AI to find the right prospects" }).fill("Find people");
  await page.getByRole("button", { name: "Search with Apollo AI" }).click();
  await page.locator("table").waitFor();
};
const step = async (name, action) => {
  currentCheck = name;
  await action();
  checks.push(name);
  console.log("PASS", name);
};

try {
  await page.goto(process.env.APOLLO_PREVIEW_URL || "http://127.0.0.1:5173/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await step("People tabs support keyboard navigation", async () => {
    await page.getByRole("tab", { name: /Total/ }).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.getByRole("tab", { name: /Net New/ }).getAttribute("aria-selected"), "true");
    await page.keyboard.press("End");
    assert.equal(await savedTab().getAttribute("aria-selected"), "true");
    await page.keyboard.press("Home");
    assert.equal(await page.getByRole("tab", { name: /Total/ }).getAttribute("aria-selected"), "true");
  });
  await step("Initial screen and sample search", async () => {
    await searchAll();
    await assertRows(4);
  });
  await step("Prompt terms and text search combine", async () => {
    await page.getByRole("button", { name: "Back to search", exact: true }).click();
    await page.getByRole("combobox", { name: "Use Apollo AI to find the right prospects" }).fill("Find founders in New York");
    await page.getByRole("button", { name: "Search with Apollo AI" }).click();
    await assertRows(1);
    assert.match(await rows().first().innerText(), /Jordan Lee/);
    await page.getByPlaceholder("Search people", { exact: true }).fill("Maya");
    await assertRows(0);
    await page.getByPlaceholder("Search people", { exact: true }).fill("");
    await assertRows(1);
    await page.getByRole("button", { name: "Back to search", exact: true }).click();
    await searchAll();
  });
  await step("Selecting a row does not save it", async () => {
    await page.getByRole("checkbox", { name: "Select Maya Patel", exact: true }).check();
    assert.equal(await savedTab().locator(".count-tab-badge").innerText(), "0");
  });
  await step("Save, reload, and remove a person", async () => {
    await page.getByRole("button", { name: "Save Jordan Lee", exact: true }).click();
    assert.equal(await savedTab().locator(".count-tab-badge").innerText(), "1");
    await page.getByRole("tab", { name: /Net New/ }).click();
    await assertRows(3);
    assert.doesNotMatch(await page.locator("tbody").innerText(), /Jordan Lee/);
    await savedTab().click();
    await assertRows(1);
    assert.match(await rows().first().innerText(), /Jordan Lee/);
    await page.reload();
    await savedTab().click();
    await assertRows(1);
    await page.getByRole("button", { name: "Remove Jordan Lee from saved people", exact: true }).click();
    await assertRows(0);
    await page.getByRole("button", { name: "Back to search", exact: true }).click();
    await searchAll();
  });
  await step("Multiple current titles use OR matching", async () => {
    await page.getByRole("button", { name: "Job Titles", exact: true }).click();
    await page.getByPlaceholder("Add job titles", { exact: true }).fill("Founder, VP of Sales");
    await assertRows(2);
    await page.getByRole("checkbox", { name: "Select all visible people", exact: true }).check();
    await clearFilters();
    await assertRows(4);
    assert.equal(await page.locator('tbody input[type="checkbox"]:checked').count(), 2);
    assert.equal(await savedTab().locator(".count-tab-badge").innerText(), "0");
  });
  await step("Department and management level combine", async () => {
    await page.locator("summary").filter({ hasText: "Departments & Job Function" }).click();
    await page.getByLabel("Marketing", { exact: true }).check();
    await assertRows(2);
    await page.locator("summary").filter({ hasText: "Management Level" }).click();
    await page.getByLabel("Director", { exact: true }).check();
    await assertRows(1);
    assert.match(await rows().first().innerText(), /Sofia Martinez/);
  });
  await step("Saved search restores its criteria", async () => {
    await page.getByRole("button", { name: "Save as new search", exact: true }).click();
    await page.getByPlaceholder("Name this search").fill("Marketing leaders");
    await page.getByRole("button", { name: "Save search", exact: true }).click();
    await page.locator(".view-button").click();
    await page.locator(".view-result").filter({ hasText: "Default view" }).click();
    assert.equal(await page.locator("table").count(), 0);
    await page.locator(".view-button").click();
    await page.locator(".saved-view-row .view-result").filter({ hasText: "Marketing leaders" }).click();
    await assertRows(1);
    assert.equal(await page.getByLabel("Director", { exact: true }).isChecked(), true);
  });
  await step("Starred search persists across reload", async () => {
    await page.locator(".view-button").click();
    await page.getByRole("button", { name: "Star Marketing leaders", exact: true }).click();
    await page.getByRole("button", { name: "Starred", exact: true }).click();
    assert.equal(await page.locator(".saved-view-row").count(), 1);
    await page.reload();
    await page.locator(".view-button").click();
    await page.getByRole("button", { name: "Starred", exact: true }).click();
    assert.equal(await page.locator(".saved-view-row").count(), 1);
    await page.locator(".saved-view-row .view-result").click();
    await assertRows(1);
    await clearFilters();
  });
  await step("Cancel does not rename a saved search", async () => {
    await page.getByRole("button", { name: "Save as new search", exact: true }).click();
    await page.getByPlaceholder("Name this search").fill("Discarded name");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.match(await page.locator(".view-button").innerText(), /Marketing leaders/);
    await page.locator(".view-button").click();
    await page.getByRole("textbox", { name: "Search saved views", exact: true }).fill("no matching search");
    assert.equal(await page.locator(".saved-view-row").count(), 0);
    await page.getByRole("textbox", { name: "Search saved views", exact: true }).fill("Marketing");
    assert.equal(await page.locator(".saved-view-row").count(), 1);
    await page.keyboard.press("Escape");
  });
  await step("Similar titles and known/unknown criteria filter results", async () => {
    await page.getByRole("button", { name: "Job Titles", exact: true }).click();
    await page.getByPlaceholder("Add job titles", { exact: true }).fill("sales manager");
    await assertRows(0);
    await page.getByLabel("Include similar titles", { exact: true }).check();
    await assertRows(1);
    await page.getByRole("button", { name: "Advanced", exact: true }).click();
    await page.getByRole("button", { name: "Is unknown", exact: true }).click();
    await assertRows(0);
    await page.getByRole("button", { name: "Is known", exact: true }).click();
    await assertRows(1);
    await clearFilters();
    await assertRows(4);
    await page.getByRole("button", { name: "Industry & Keywords", exact: true }).click();
    await page.locator("summary").filter({ hasText: "Advanced settings" }).click();
    await page.getByRole("button", { name: "Is unknown", exact: true }).click();
    await assertRows(0);
    await page.getByRole("button", { name: "Is known", exact: true }).click();
    await assertRows(4);
    await clearFilters();
  });
  await step("Global search shortcut, query, and Escape work", async () => {
    const shortcut = process.platform === "darwin" ? "Meta+k" : "Control+k";
    await page.keyboard.press(shortcut);
    const dialog = page.getByRole("dialog", { name: "Search Apollo", exact: true });
    await dialog.waitFor();
    await dialog.getByRole("textbox").fill("people");
    assert.equal(await dialog.locator(".command-suggestions button").count(), 1);
    await page.keyboard.press("Escape");
    assert.equal(await dialog.count(), 0);
    await page.keyboard.press(shortcut);
    await dialog.getByRole("textbox").fill("people");
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("table").count(), 0);
  });
  await step("Escape discards staged filter choices", async () => {
    await page.getByRole("button", { name: "View 60+ Filters", exact: true }).click();
    await page.getByRole("button", { name: "Company Size", exact: true }).click();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".filters-dialog").count(), 0);
    await page.getByRole("button", { name: "View 60+ Filters", exact: true }).click();
    assert.equal(await page.locator(".modal-filter-grid button.selected").count(), 0);
    await page.keyboard.press("Escape");
  });
  await page.reload();
  currentCheck = "Desktop and mobile captures";
  await page.screenshot({ path: artifactPath("local-desktop.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: artifactPath("local-mobile.png"), fullPage: true, animations: "disabled" });
  currentCheck = "No browser console errors";
  assert.deepEqual(errors, []);
  checks.push("No browser console errors");
} catch (error) {
  failure = { check: currentCheck, message: error.message };
  console.error("FAIL", currentCheck, error.message);
  await page.screenshot({ path: artifactPath("local-failure.png"), fullPage: true });
  process.exitCode = 1;
} finally {
  writeFileSync(new URL("local-flow-results.json", import.meta.url), JSON.stringify({ timestamp: new Date().toISOString(), checks, errors, failure }, null, 2));
  await browser.close();
}
