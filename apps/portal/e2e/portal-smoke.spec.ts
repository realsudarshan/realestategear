import { expect, test } from "./fixtures/console-monitor";

test("property search and filters navigate with the selected criteria", async ({ page }) => {
  await page.goto("/properties");

  await page.getByLabel("Search").fill("Charlotte");
  await page.getByLabel("Min price").selectOption("300000");
  await page.getByLabel("Max price").selectOption("750000");
  await page.getByLabel("Bedrooms").selectOption("3");
  await page.getByLabel("Bathrooms").selectOption("2");
  await page.getByLabel("Property type").selectOption("SINGLE_FAMILY");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page).toHaveURL((url) => {
    const query = url.searchParams;
    return url.pathname === "/properties"
      && query.get("q") === "Charlotte"
      && query.get("minPrice") === "300000"
      && query.get("maxPrice") === "750000"
      && query.get("bedrooms") === "3"
      && query.get("bathrooms") === "2"
      && query.get("propertyType") === "SINGLE_FAMILY";
  });
  await expect(page.getByLabel("Search")).toHaveValue("Charlotte");
});

test("a property card navigates to its portal detail page", async ({ page }) => {
  await page.goto("/properties");
  await page.getByRole("link", { name: /101 Fairway Drive/ }).click();

  await expect(page).toHaveURL(/\/properties\/101-fairway-drive$/);
  await expect(page.getByRole("heading", { name: "101 Fairway Drive" })).toBeVisible();
  await expect(page.getByText("$625,000")).toBeVisible();
  await expect(page.getByText("A test home beside the fairway.")).toBeVisible();
});

test("the inquiry form blocks invalid required fields in the browser", async ({ page }) => {
  await page.goto("/contact");
  const email = page.getByLabel("Email");
  await email.fill("not-an-email");
  await page.getByRole("button", { name: "Request a callback" }).click();

  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByLabel("Name")).toBeFocused();
  expect(await page.getByLabel("Name").evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  expect(await email.evaluate((input: HTMLInputElement) => input.validity.typeMismatch)).toBe(true);
});

test("the inquiry form exposes an upstream submission failure", async ({ page }) => {
  await page.goto("/contact");
  await page.getByLabel("Name").fill("Jane Smith");
  await page.getByLabel("Email").fill("jane@example.com");
  await page.getByLabel("What are you looking for?").fill("A three-bedroom home near the golf course.");
  await page.getByRole("button", { name: "Request a callback" }).click();

  await expect(page.getByText("Test inquiry service unavailable")).toBeVisible();
});
