import { expect, test as base } from "@playwright/test";

type BrowserError = {
  type: "console" | "pageerror";
  text: string;
};

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const errors: BrowserError[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") errors.push({ type: "console", text: message.text() });
    });
    page.on("pageerror", (error) => {
      errors.push({ type: "pageerror", text: error.stack ?? error.message });
    });

    await use(page);

    if (errors.length > 0) {
      await testInfo.attach("browser-errors", {
        body: errors.map((error) => `[${error.type}] ${error.text}`).join("\n"),
        contentType: "text/plain",
      });
    }
    expect(errors, "unexpected browser console or page errors").toEqual([]);
  },
});

export { expect } from "@playwright/test";
