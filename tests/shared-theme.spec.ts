import { expect, test, type BrowserContext, type Page } from "@playwright/test"

// Theme and contrast are shared with every *.krtmtthw.dev app (Replay included) through cookies on
// krtmtthw.dev (Akari's theme store + /theme-init.js). .dev is HSTS-preloaded, so the browser asks for
// https://krtmtthw.dev/ and Playwright answers from the local build: parent-domain cookies then behave as live.
const PORT = Number(process.env.PORT ?? 4322)
const ORIGIN = "https://krtmtthw.dev"
// A second *.krtmtthw.dev host (its own origin and localStorage) served from the same build: stands in for Lights.
const OTHER = "https://lights.krtmtthw.dev"

async function serveAsProduction(context: BrowserContext) {
  for (const origin of [ORIGIN, OTHER]) {
    await context.route(`${origin}/**`, async (route) => {
      const response = await route.fetch({ url: route.request().url().replace(origin, `http://127.0.0.1:${PORT}`) })
      await route.fulfill({ response })
    })
  }
}

/** Akari's compact theme button (Auto -> Light -> Dark); its name states the mode. */
const themeButton = (page: Page) => page.getByRole("banner").getByRole("button", { name: /^Theme: / })
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
  await expect(themeButton(page)).toHaveAccessibleName("Theme: dark")
})

test("toggling here writes the cookies every *.krtmtthw.dev app reads", async ({ page, context }) => {
  await serveAsProduction(context)
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto(`${ORIGIN}/`)
  await controlsReady(page)
  expect((await context.cookies()).filter((c) => c.name === "theme")).toEqual([])
  await themeButton(page).click() // Auto -> Light
  await themeButton(page).click() // Light -> Dark
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

test("Auto, Light and Dark look and read the same on two *.krtmtthw.dev hosts, and Auto follows the OS live", async ({
  context,
}) => {
  await serveAsProduction(context)
  const site = await context.newPage()
  const other = await context.newPage()
  for (const p of [site, other]) await p.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" })
  const state = async (p: Page) => {
    const html = p.locator("html")
    return {
      name: await themeButton(p).getAttribute("aria-label"),
      icon: await themeButton(p).getAttribute("data-theme-preference"),
      theme: await html.getAttribute("data-theme"),
      dark: await html.evaluate((el) => el.classList.contains("dark")),
      stored: await p.evaluate(() => localStorage.getItem("theme")),
    }
  }
  await site.goto(`${ORIGIN}/`)
  await controlsReady(site)
  const expected = {
    light: { name: "Theme: light", icon: "light", theme: "light", dark: false, stored: "light" },
    dark: { name: "Theme: dark", icon: "dark", theme: "dark", dark: true, stored: "dark" },
    system: { name: "Theme: auto (light)", icon: "system", theme: "light", dark: false, stored: null },
  }
  for (const mode of ["light", "dark", "system"] as const) {
    await themeButton(site).click() // Auto -> Light -> Dark -> Auto
    await expect(themeButton(site)).toHaveAttribute("data-theme-preference", mode)
    const cookie = (await context.cookies(ORIGIN)).find((c) => c.name === "theme")
    expect(cookie?.value ?? null).toBe(expected[mode].stored)
    await other.goto(`${OTHER}/`)
    await controlsReady(other)
    expect(await state(site)).toEqual(expected[mode])
    expect(await state(other)).toEqual(expected[mode])
  }
  // Both on Auto: flipping the OS preference re-themes both, with no reload.
  for (const p of [site, other]) await p.emulateMedia({ colorScheme: "dark" })
  for (const p of [site, other]) {
    await expect(p.locator("html")).toHaveAttribute("data-theme", "dark")
    await expect(themeButton(p)).toHaveAccessibleName("Theme: auto (dark)")
  }
})
