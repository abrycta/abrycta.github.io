import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

const PAGES = [
  { path: "/", heading: "Quiet tools that make data legible." },
  { path: "/projects/", heading: "Things I am building" },
  { path: "/projects/typhoon-replay/", heading: "Typhoon Replay" },
  { path: "/projects/lgu-lights/", heading: "LGU Lights" },
  { path: "/projects/kessan-lens/", heading: "Kessan Lens" },
  { path: "/projects/akari/", heading: "Akari" },
  { path: "/akari/", heading: "Akari" },
]

const THEMES = [
  { name: "light", scheme: "light", contrast: "no-preference" },
  { name: "dark", scheme: "dark", contrast: "no-preference" },
  { name: "high-contrast", scheme: "light", contrast: "more" },
] as const

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text())
  })
  page.on("pageerror", (err) => errors.push(err.message))
  return errors
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle")
  // Hydrate client:visible islands too.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForLoadState("networkidle")
  await page.evaluate(() => window.scrollTo(0, 0))
}

for (const { path, heading } of PAGES) {
  test.describe(path, () => {
    test("renders without console errors or horizontal scroll", async ({ page }) => {
      const errors = collectErrors(page)
      const res = await page.goto(path)
      expect(res?.status()).toBe(200)
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading)
      await expect(page.getByRole("banner").getByRole("link", { name: "Kurt Matthew Nudo" })).toBeVisible()
      await expect(page.getByRole("contentinfo")).toContainText("© 2026 Kurt Matthew Nudo")
      await settle(page)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, "horizontal overflow (px)").toBeLessThanOrEqual(0)
      expect(errors).toEqual([])
    })

    for (const theme of THEMES) {
      test(`axe: no serious/critical violations (${theme.name})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme.scheme, contrast: theme.contrast, reducedMotion: "reduce" })
        await page.goto(path)
        await settle(page)
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze()
        const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
        expect(
          bad.map(
            (v) =>
              `${v.id} (${v.impact}): ${v.nodes
                .map((n) => n.target.join(" "))
                .slice(0, 5)
                .join(" | ")}`,
          ),
        ).toEqual([])
      })
    }
  })
}

test("404 page renders for unknown paths", async ({ page }) => {
  const res = await page.goto("/no-such-page/")
  expect(res?.status()).toBe(404)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nothing here")
})

test("theme and contrast toggles apply to the document and persist", async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto("/akari/")
  await settle(page)
  const html = page.locator("html")
  const header = page.getByRole("banner")
  await header.getByRole("radio", { name: "Dark" }).click()
  await expect(html).toHaveAttribute("data-theme", "dark")
  // The showcase panel's own toggle follows the header's.
  await expect(page.getByRole("main").getByRole("radio", { name: "Dark" }).first()).toHaveAttribute(
    "aria-checked",
    "true",
  )
  await header.getByRole("button", { name: "High contrast" }).click()
  await expect(html).toHaveAttribute("data-contrast", "more")
  await page.reload()
  await expect(html).toHaveAttribute("data-theme", "dark")
  await expect(html).toHaveAttribute("data-contrast", "more")
  expect(errors).toEqual([])
})

test.describe("header", () => {
  test("shows the full name beside the seal, untruncated", async ({ page }) => {
    await page.goto("/projects/")
    const brand = page.getByRole("banner").getByRole("link", { name: "Kurt Matthew Nudo" })
    await expect(brand).toHaveAttribute("href", "/")
    await expect(brand.locator("svg")).toBeVisible()
    const box = await brand.evaluate((el) => {
      const name = el.querySelector("span")!
      const r = name.getBoundingClientRect()
      return {
        clipped: name.scrollWidth > name.clientWidth + 1,
        right: r.right,
        lines: Math.round(r.height / parseFloat(getComputedStyle(name).lineHeight)),
        viewport: document.documentElement.clientWidth,
      }
    })
    expect(box.clipped, "name is clipped").toBe(false)
    expect(box.right, "name runs off screen").toBeLessThanOrEqual(box.viewport)
    // One line on phones from 360px up (it may wrap between words only on narrower screens).
    expect(box.lines, "name wraps").toBe(1)
  })

  test("nav links are visible and navigate", async ({ page }) => {
    await page.goto("/")
    const nav = page.getByRole("banner").getByRole("navigation")
    await expect(nav.getByRole("link", { name: "Akari" })).toBeVisible()
    await nav.getByRole("link", { name: "Projects" }).click()
    await expect(page).toHaveURL(/\/projects\/$/)
    await expect(nav.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page")
    await expect(page.getByRole("banner").getByRole("radio", { name: "Dark" })).toBeVisible()
  })
})

test("skip link moves focus to main content", async ({ page }) => {
  await page.goto("/")
  await page.keyboard.press("Tab")
  const skip = page.getByRole("link", { name: "Skip to content" })
  await expect(skip).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/#main$/)
})

test("dialog opens and closes from the keyboard", async ({ page }) => {
  await page.goto("/akari/")
  await settle(page)
  const trigger = page.getByRole("button", { name: "Open dialog" })
  await trigger.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toBeHidden()
  await expect(page.locator("html")).toHaveAttribute("lang", "en")
})

test.describe("home page", () => {
  test("has the hero, the live project, principles, toolbox, research, languages and contact", async ({ page }) => {
    await page.goto("/")
    const main = page.getByRole("main")
    await expect(main.getByText(/enterprise Java systems for Japanese banking clients/)).toBeVisible()
    await expect(main.getByRole("link", { name: "See the projects" })).toHaveAttribute("href", "/projects/")

    for (const name of [
      "Typhoon Replay",
      "Next on the bench",
      "How I build",
      "What I build with",
      "Satellites and poverty",
      "Two working languages",
      "Say hello",
    ]) {
      await expect(main.getByRole("heading", { level: 2, name })).toBeVisible()
    }

    const live = page.locator("#now-live")
    await expect(live.getByText("Status: Live")).toBeVisible()
    await expect(live.getByRole("link", { name: /Open Typhoon Replay/ })).toHaveAttribute(
      "href",
      "https://typhoon.krtmtthw.dev",
    )
    await expect(live.getByRole("link", { name: "How it's built" })).toHaveAttribute(
      "href",
      "/projects/typhoon-replay/",
    )

    await expect(page.locator("#principles li")).toHaveCount(4)
    await expect(page.locator("#toolbox dt")).toHaveText([
      "Languages",
      "Backend",
      "Data and ML",
      "Frontend",
      "Infra and quality",
    ])
    await expect(page.locator("#building").getByRole("link", { name: "LGU Lights" })).toBeVisible()
    await expect(page.locator("#research").getByRole("link", { name: /LGU Lights/ })).toHaveAttribute(
      "href",
      "/projects/lgu-lights/",
    )
    await expect(page.locator("#languages")).toContainText("English")
    await expect(page.locator("#languages [lang=ja]")).toHaveText("日本語")
    for (const link of await main.getByRole("link", { name: /github\.com\/abrycta|GitHub @abrycta/ }).all()) {
      await expect(link).toHaveAttribute("href", "https://github.com/abrycta")
    }
    await expect(main.getByRole("link", { name: /github\.com\/abrycta/ })).toBeVisible()
  })

  test("the Typhoon Replay screenshot is an optimised image with alt text", async ({ page }) => {
    await page.goto("/")
    const img = page.locator("#now-live img")
    await img.scrollIntoViewIfNeeded()
    await expect(img).toHaveAttribute("alt", /Typhoon Replay's home page: a map of the Philippines/)
    await expect(img).toHaveAttribute("srcset", /\.webp 1920w/)
    await expect(img).toHaveAttribute("loading", "lazy")
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0)
  })

  test("new sections ship no extra JavaScript islands", async ({ page }) => {
    await page.goto("/")
    // Only the header controls and the Akari teaser hydrate.
    await expect(page.locator("astro-island")).toHaveCount(2)
  })
})

test("Typhoon Replay project page is live, with the app and repository links", async ({ page }) => {
  await page.goto("/projects/typhoon-replay/")
  const facts = page.getByRole("complementary", { name: "Project facts" })
  await expect(facts.getByText("Status: Live")).toBeVisible()
  await expect(facts.getByRole("link", { name: "Live replay" })).toHaveAttribute("href", "https://typhoon.krtmtthw.dev")
  await expect(facts.getByRole("link", { name: "Repository" })).toHaveAttribute(
    "href",
    "https://github.com/abrycta/typhoon-replay",
  )
  await expect(facts).not.toContainText("coming soon")
  await expect(page.getByRole("heading", { name: "Where it stands" })).toBeVisible()
})

test("SEO basics: canonical, OG, robots and sitemap", async ({ page, request }) => {
  await page.goto("/projects/typhoon-replay/")
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /^https:\/\/krtmtthw\.dev\/projects\/typhoon-replay\/$/,
  )
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /Typhoon Replay/)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/)
  const robots = await request.get("/robots.txt")
  expect(await robots.text()).toContain("Sitemap:")
  expect((await request.get("/sitemap-index.xml")).status()).toBe(200)
  expect((await request.get("/og.png")).headers()["content-type"]).toContain("image/png")
})
