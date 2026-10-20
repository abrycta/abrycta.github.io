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

/** The header controls island (client:idle) has hydrated, so the toggles respond. */
async function controlsReady(page: Page) {
  await expect(page.getByRole("banner").locator("astro-island")).not.toHaveAttribute("ssr", "")
}
const darkToggle = (page: Page) => page.getByRole("banner").getByRole("button", { name: "Dark mode" })

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
  await controlsReady(page)
  await darkToggle(page).click()
  await expect(darkToggle(page)).toHaveAttribute("aria-pressed", "true")
  await expect(html).toHaveAttribute("data-theme", "dark")
  // The showcase panel's own (segmented) toggle follows the header's.
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

  test("nav has only Projects, which is visible and navigates", async ({ page }) => {
    await page.goto("/")
    const nav = page.getByRole("banner").getByRole("navigation")
    await expect(nav.getByRole("link")).toHaveCount(1)
    await expect(nav.getByRole("link", { name: "Akari" })).toHaveCount(0)
    await nav.getByRole("link", { name: "Projects" }).click()
    await expect(page).toHaveURL(/\/projects\/$/)
    await expect(nav.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page")
    await expect(darkToggle(page)).toBeVisible()
    // The showcase is still reachable without the nav entry.
    await page.goto("/akari/")
    await expect(nav.getByRole("link", { name: "Projects" })).not.toHaveAttribute("aria-current", "page")
  })

  test("theme controls match Typhoon Replay: contrast, then one light/dark toggle", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" })
    await page.goto("/")
    await controlsReady(page)
    const banner = page.getByRole("banner")
    await expect(banner.getByRole("radio")).toHaveCount(0)
    await expect(banner.getByRole("button", { name: "Match system" })).toHaveCount(0)
    await expect(banner.getByRole("button", { name: "Dark mode" })).toHaveCount(1)
    // First visit follows the system (dark here) without storing anything.
    await expect(darkToggle(page)).toHaveAttribute("aria-pressed", "true")
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull()
    const contrast = banner.getByRole("button", { name: "High contrast" })
    await expect(contrast).toHaveAttribute("aria-pressed", "false")
    const order = await banner.getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))
    expect(order.indexOf("High contrast")).toBeLessThan(order.indexOf("Dark mode"))
    // Pressing stores the choice.
    await darkToggle(page).click()
    await expect(darkToggle(page)).toHaveAttribute("aria-pressed", "false")
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("light")
  })

  test("profile links to GitHub and LinkedIn fit without overflow", async ({ page }) => {
    await page.goto("/")
    const banner = page.getByRole("banner")
    const github = banner.getByRole("link", { name: "GitHub" })
    const linkedin = banner.getByRole("link", { name: "LinkedIn" })
    await expect(github).toHaveAttribute("href", "https://github.com/abrycta")
    await expect(linkedin).toHaveAttribute("href", "https://www.linkedin.com/in/kurtmtthw/")
    for (const link of [github, linkedin]) {
      await expect(link).toBeVisible()
      await expect(link).not.toHaveAttribute("target", /.+/)
      const box = (await link.boundingBox())!
      expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    }
    const overflow = await page.evaluate(() => {
      const h = document.querySelector("header")!
      return h.scrollWidth - h.clientWidth
    })
    expect(overflow, "header overflow (px)").toBeLessThanOrEqual(0)
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
  test("has the hero, the live project, projects, principles and toolbox", async ({ page }) => {
    await page.goto("/")
    const main = page.getByRole("main")
    await expect(main.getByText(/enterprise Java systems for Japanese banking clients/)).toBeVisible()
    await expect(main.getByRole("link", { name: "See the projects" })).toHaveAttribute("href", "/projects/")

    for (const name of ["Typhoon Replay", "Projects", "How I build", "What I build with"]) {
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
      "Programming",
      "Backend",
      "Data and ML",
      "Frontend",
      "Infra and quality",
    ])
    await expect(page.locator("#building")).toHaveCount(0)
    await expect(page.locator("#languages")).toHaveCount(0)
    await expect(main.getByRole("heading", { level: 2, name: "Languages" })).toHaveCount(0)
    await expect(main).not.toContainText("JLPT")
    // The Typhoon Replay card keeps its app-languages row.
    await expect(live.locator("dt", { hasText: "Languages" })).toHaveCount(1)
    await expect(page.locator("#research")).toHaveCount(0)
    await expect(page.locator("#contact")).toHaveCount(0)
    await expect(page.locator("#principles h3")).toContainText(["Resilient by design", "Performance first"])
    for (const link of await main.getByRole("link", { name: /github\.com\/abrycta|GitHub @abrycta/ }).all()) {
      await expect(link).toHaveAttribute("href", "https://github.com/abrycta")
    }
    await expect(main.getByRole("link", { name: /GitHub @abrycta/ })).toBeVisible()
    await expect(main.getByRole("link", { name: "LinkedIn", exact: true })).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/kurtmtthw/",
    )
    // The on-page index matches the sections.
    // (Hidden below lg, so located by CSS rather than role.)
    const index = page.locator('nav[aria-label="On this page"] a')
    await expect(index).toHaveCount(4)
    for (const href of await index.evaluateAll((els) => els.map((e) => e.getAttribute("href")))) {
      await expect(page.locator(href!)).toHaveCount(1)
    }
  })

  test("lists every project, in order, linking to its page with a status", async ({ page, request }) => {
    // Same list and order as /projects/.
    await page.goto("/projects/")
    const expected = await page
      .getByRole("main")
      .locator("li h2 a")
      .evaluateAll((els) => els.map((a) => [a.textContent!.trim(), a.getAttribute("href")!]))
    expect(expected.length).toBeGreaterThanOrEqual(4)
    await page.goto("/")
    const cards = page.locator("#projects > ul > li")
    await expect(cards).toHaveCount(expected.length)
    for (const [i, [title, href]] of expected.entries()) {
      const card = cards.nth(i)
      await expect(card.getByRole("heading", { level: 3 })).toHaveText(title)
      await expect(card.getByRole("link", { name: title })).toHaveAttribute("href", href)
      await expect(card.getByText(/^Status: /)).toHaveCount(1)
      expect((await request.get(href)).status()).toBe(200)
    }
    await expect(page.locator("#projects").getByRole("link", { name: "All projects →" })).toHaveAttribute(
      "href",
      "/projects/",
    )
    // The Akari card carries the live preview and the showcase link; the others are plain cards.
    const akari = cards.filter({ has: page.getByRole("link", { name: /^Akari/ }) })
    await expect(akari.locator("astro-island")).toHaveCount(1)
    await expect(akari.getByRole("link", { name: "See the living showcase →" })).toHaveAttribute("href", "/akari/")
    await expect(page.locator("#projects astro-island")).toHaveCount(1)
    await expect(page.locator("#projects img")).toHaveCount(0)
  })

  test("the Akari preview hydrates only when visible, and works inside the card", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    const island = page.locator("#projects astro-island")
    await expect(island).toHaveAttribute("client", "visible")
    await expect(island).toHaveAttribute("ssr", "")
    const preview = page.getByTestId("akari-preview")
    await preview.scrollIntoViewIfNeeded()
    await expect(island).not.toHaveAttribute("ssr", "")
    await preview.getByRole("radio", { name: "Falling" }).click()
    await expect(preview.getByRole("radio", { name: "Falling" })).toHaveAttribute("aria-checked", "true")
    // Clicking the preview must not follow the card's full-size link.
    await expect(page).toHaveURL(/\/$/)
    const box = (await preview.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  })

  test("both Typhoon Replay screenshots are optimised, lazy images with alt text", async ({ page }) => {
    await page.goto("/")
    for (const scheme of ["light", "dark"]) {
      const img = page.locator(`#now-live img[data-theme-shot="${scheme}"]`)
      await expect(img).toHaveAttribute("alt", new RegExp(`^Typhoon Replay's home page: .*in its ${scheme} theme\\.$`))
      await expect(img).toHaveAttribute("srcset", /\.webp 1920w/)
      await expect(img).toHaveAttribute("loading", "lazy")
    }
  })

  // The screenshot follows the active theme: system preference by default, the header toggle when set.
  const shot = (page: Page, scheme: "light" | "dark") => page.locator(`#now-live img[data-theme-shot="${scheme}"]`)
  async function expectShot(page: Page, scheme: "light" | "dark") {
    const other = scheme === "light" ? "dark" : "light"
    await shot(page, scheme).scrollIntoViewIfNeeded()
    await expect(shot(page, scheme)).toBeVisible()
    await expect(shot(page, other)).toBeHidden()
    await expect
      .poll(() => shot(page, scheme).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth))
      .toBeGreaterThan(0)
  }

  for (const scheme of ["light", "dark"] as const) {
    test(`shows the ${scheme} screenshot for a ${scheme} system preference, and never fetches the other`, async ({
      page,
    }) => {
      const other = scheme === "light" ? "dark" : "light"
      const fetched: string[] = []
      page.on("request", (r) => {
        if (/typhoon-replay-home-(light|dark)/.test(r.url())) fetched.push(r.url())
      })
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
      await page.goto("/")
      await expectShot(page, scheme)
      await page.waitForLoadState("networkidle")
      expect(fetched.some((u) => u.includes(`-${scheme}`))).toBe(true)
      expect(
        fetched.filter((u) => u.includes(`-${other}`)),
        "hidden screenshot was fetched",
      ).toEqual([])
    })

    test(`high contrast keeps the ${scheme} screenshot`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, contrast: "more", reducedMotion: "reduce" })
      await page.goto("/")
      await expectShot(page, scheme)
      await page.getByRole("banner").getByRole("button", { name: "High contrast" }).click()
      await expect(page.locator("html")).toHaveAttribute("data-contrast", /more|normal/)
      await expectShot(page, scheme)
    })
  }

  test("the theme toggle swaps the screenshot both ways, overriding the system", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" })
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await expectShot(page, "light")
    await controlsReady(page)
    await darkToggle(page).click()
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
    await expectShot(page, "dark")
    await darkToggle(page).click()
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
    await expectShot(page, "light")
    // Explicit light wins over a dark system preference, and survives a reload.
    await page.emulateMedia({ colorScheme: "dark" })
    await expectShot(page, "light")
    await page.reload()
    await expectShot(page, "light")
    await controlsReady(page)
    await darkToggle(page).click()
    await page.emulateMedia({ colorScheme: "light" })
    await expectShot(page, "dark")
  })

  test("new sections ship no extra JavaScript islands", async ({ page }) => {
    await page.goto("/")
    // Only the header controls and the Akari preview (inside its project card) hydrate.
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
