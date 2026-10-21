import { expect, test, type Page } from "@playwright/test"

// Akari's Header strip mirrors a project page's breadcrumb once the page's own has scrolled away (Akari 0.11).
// Runs in both projects (desktop, mobile-360). The full device matrix is run by hand before releases.

const header = (page: Page) => page.locator("header[data-akari-header]")

async function ready(page: Page) {
  await expect(page.locator("astro-island", { has: page.getByRole("banner") })).not.toHaveAttribute("ssr", "")
  await page.evaluate(() => document.fonts.ready)
}

async function scrollAndCheck(page: Page, y: number) {
  await page.evaluate((y) => window.scrollTo(0, y), y)
  const past = await page.evaluate(() => {
    const h = document.querySelector("header[data-akari-header]")!
    const line = h.hasAttribute("data-compact") ? 44 : h.getBoundingClientRect().height
    return document.querySelector('main [data-slot="breadcrumb"]')!.getBoundingClientRect().bottom <= line + 1
  })
  await expect(header(page)).toHaveAttribute("data-crumbs", past ? "pinned" : "ready")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

test("project page: the strip shows the breadcrumb once scrolled past, and back; CLS 0", async ({ page }, info) => {
  await page.goto("/projects/lights/")
  await ready(page)
  await page.evaluate(() => {
    ;(window as unknown as { __cls: number }).__cls = 0
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value
    }).observe({ type: "layout-shift" })
  })
  const h = header(page)
  const restHeight = await h.evaluate((el) => el.getBoundingClientRect().height)
  expect(Math.round(restHeight)).toBe(info.project.name === "desktop" ? 81 : 121)
  await expect(h).toHaveAttribute("data-crumbs", "ready")
  const strip = page.getByRole("navigation", { name: "You are here" })
  await expect(strip).toHaveCount(0) // hidden: out of the accessibility tree

  for (const y of [40, 120, 200, 900, 6000, 0]) await scrollAndCheck(page, y)
  await page.evaluate(() => window.scrollTo(0, 900))
  await expect(h).toHaveAttribute("data-crumbs", "pinned")
  await expect(strip).toBeVisible()
  await expect(strip.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/#projects")
  await expect(strip.locator('[aria-current="page"]')).toHaveText("Lights")
  await expect(page.getByRole("banner").locator("[data-current]")).toHaveCount(1)
  if (info.project.name !== "desktop") {
    // Phones: only the strip stays, at the top of the viewport.
    const top = await page.locator('[data-slot="app-header-strip"]').evaluate((el) => el.getBoundingClientRect().top)
    expect(Math.abs(top)).toBeLessThan(1)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(h).toHaveAttribute("data-crumbs", "ready")
  expect(await h.evaluate((el) => el.getBoundingClientRect().height)).toBe(restHeight)
  expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBe(0)
})

test("anchor jump lands with the breadcrumb in the strip, the heading just under it", async ({ page }) => {
  await page.goto("/projects/lights/#approach")
  await ready(page)
  await expect(header(page)).toHaveAttribute("data-crumbs", "pinned")
  // What stays on screen: the whole Header (81px) on desktop; on phones only the strip, 44px plus its rule (Akari's
  // scroll padding). The heading lands just under it, not hidden and not 77px lower.
  // (Polled: the page is still settling, the browser keeps the target in place as it does.)
  await expect
    .poll(() =>
      page.evaluate(() => {
        const h = document.querySelector("header[data-akari-header]")!
        const strip = h.querySelector('[data-slot="app-header-strip"]')!
        const under = h.hasAttribute("data-compact")
          ? strip.getBoundingClientRect().bottom + 15
          : h.getBoundingClientRect().bottom
        return Math.round(Math.abs(document.getElementById("approach")!.getBoundingClientRect().top - under))
      }),
    )
    .toBeLessThanOrEqual(2)
})

test("home page: the section dot in the nav moves nothing while scrolling (CLS 0)", async ({ page }) => {
  await page.goto("/")
  await ready(page)
  // Count shifts from here on only: the web-font swap at load shifts layout and is not what this checks.
  await page.evaluate(() => {
    const w = window as unknown as { __cls: number; __shifts: string[] }
    w.__cls = 0
    w.__shifts = []
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as {
        value: number
        hadRecentInput: boolean
        sources: { node?: Node }[]
      }[])
        if (!e.hadRecentInput) {
          w.__cls += e.value
          w.__shifts.push(
            e.sources.map((s) => (s.node as Element | undefined)?.outerHTML?.slice(0, 60) ?? "?").join(" ; "),
          )
        }
    }).observe({ type: "layout-shift" })
  })
  const nav = page.getByRole("navigation", { name: "Main" })
  for (const id of ["projects", "practice", "toolbox", "projects"]) {
    await page.evaluate(
      (id) => window.scrollTo(0, document.getElementById(id)!.getBoundingClientRect().top + window.scrollY),
      id,
    )
    await expect(nav.locator("[data-current]")).toHaveAttribute("href", `/#${id}`)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(nav.locator("[data-current]")).toHaveCount(0)
  const { cls, shifts } = await page.evaluate(() => {
    const w = window as unknown as { __cls: number; __shifts: string[] }
    return { cls: w.__cls, shifts: w.__shifts }
  })
  expect(cls, shifts.join("\n")).toBe(0)
})

test.describe("320px phone (1st-gen iPhone SE)", () => {
  test.use({ viewport: { width: 320, height: 568 } })
  test("no project page scrolls sideways; a wide table scrolls in its own box", async ({ page }) => {
    for (const path of [
      "/projects/lights/",
      "/projects/replay/",
      "/projects/kessan-lens/",
      "/projects/akari/",
      "/projects/plumes/",
    ]) {
      await page.goto(path)
      await page.evaluate(() => document.fonts.ready)
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(320)
    }
    await page.goto("/projects/lights/")
    const wrap = page.locator("article .table-wrap").first()
    await expect(wrap).toHaveAttribute("role", "region")
    expect(await wrap.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
  })
})

test("pages without a breadcrumb keep the whole Header, unchanged", async ({ page }) => {
  await page.goto("/about/")
  await ready(page)
  await expect(header(page)).not.toHaveAttribute("data-crumbs")
  await page.evaluate(() => window.scrollTo(0, 900))
  expect(await header(page).evaluate((el) => el.getBoundingClientRect().top)).toBe(0)
})
