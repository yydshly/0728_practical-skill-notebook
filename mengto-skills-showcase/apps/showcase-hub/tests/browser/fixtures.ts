import { expect, test as base } from "@playwright/test";

export const test = base.extend<{ browserGuard: void }>({
  browserGuard: [
    async ({ page }, use) => {
      const pageErrors: Error[] = [];
      const consoleErrors: string[] = [];
      const missingResponses: string[] = [];

      page.on("pageerror", (error) => pageErrors.push(error));
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("response", (response) => {
        if (response.status() === 404) missingResponses.push(response.url());
      });

      await use();

      expect(pageErrors, "page errors").toEqual([]);
      expect(consoleErrors, "console errors").toEqual([]);
      expect(missingResponses, "404 responses").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
