import { expect, test, type BrowserContext, type Page } from "@playwright/test"

// Theme and contrast are shared with every *.krtmtthw.dev app (Replay included) through cookies on
// krtmtthw.dev (Akari's theme store + /theme-init.js). .dev is HSTS-preloaded, so the browser asks for
// https://krtmtthw.dev/ and Playwright answers from the local build: parent-domain cookies then behave as live.
const PORT = Number(process.env.PORT ?? 4322)
const ORIGIN = "https://krtmtthw.dev"

async function serveAsProduction(context: BrowserContext) {
  await context.route(`${ORIGIN}/**`, async (route) => {
    const response = await route.fetch({ url: route.request().url().replace(ORIGIN, `http://127.0.0.1:${PORT}`) })
    await route.fulfill({ response })
  })
}

const darkToggle = (page: Page) => page.getByRole("banner").getByRole("button", { name: "Dark mode" })
async function controlsReady(page: Page) {
  await expect(page.locator("astro-island", { has: page.getByRole("banner") })).not.toHaveAttribute("ssr", "")
}

test("a parent-domain cookie (set by another app) controls the theme on load", async ({ page, context }) => {
  await serveAsProduction(context)
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" })
  await context.addCookies([
    { name: "theme", value: "dark", domain: ".krtmtthw.dev", path: "/", secure: true, sameSite: "Lax" },
    { name: "contrast", value: "more", domain: ".krtmtthw.dev", path: "/", secure: true, sameSite: "Lax" },
  ])
  // Record <html> once the document is parsed: theme-init.js in <head> runs before any island.
  await page.addInitScript(() => {
    document.addEventListener("readystatechange", () => {
      if (document.readyState === "interactive" && !("__beforeApp" in window))
        Object.assign(window, {
          __beforeApp: {
            theme: document.documentElement.dataset.theme,
            contrast: document.documentElement.dataset.contrast,
          },
        })
    })
  })
  await page.goto(`${ORIGIN}/`)
  expect(await page.evaluate(() => (window as unknown as { __beforeApp: unknown }).__beforeApp)).toEqual({
    theme: "dark",
    contrast: "more",
  })
  await controlsReady(page)
  await expect(darkToggle(page)).toHaveAttribute("aria-pressed", "true")
})

test("toggling here writes the cookies every *.krtmtthw.dev app reads", async ({ page, context }) => {
  await serveAsProduction(context)
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto(`${ORIGIN}/`)
  await controlsReady(page)
  expect((await context.cookies()).filter((c) => c.name === "theme")).toEqual([])
  await darkToggle(page).click()
  await page.getByRole("banner").getByRole("button", { name: "High contrast" }).click()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
  const cookies = Object.fromEntries((await context.cookies()).map((c) => [c.name, c]))
  expect(cookies.theme).toMatchObject({
    value: "dark",
    domain: ".krtmtthw.dev",
    path: "/",
    secure: true,
    sameSite: "Lax",
  })
  expect(cookies.contrast).toMatchObject({ value: "more", domain: ".krtmtthw.dev" })
})
