import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

const PAGES = [
  { path: "/", heading: "Quiet tools that make data legible." },
  { path: "/projects/", heading: "Things I am building" },
  { path: "/projects/lights/", heading: "Lights" },
  { path: "/projects/replay/", heading: "Replay" },
  { path: "/projects/kessan-lens/", heading: "Kessan Lens" },
  { path: "/projects/akari/", heading: "Akari" },
  { path: "/akari/", heading: "Akari" },
  { path: "/about/", heading: "Full-stack developer migrating Japanese enterprise systems." },
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

/** The header island (Akari's Header, client:idle) has hydrated, so the toggles respond. */
async function controlsReady(page: Page) {
  await expect(page.locator("astro-island", { has: page.getByRole("banner") })).not.toHaveAttribute("ssr", "")
}
/** Akari's compact theme button (Auto -> Light -> Dark); its name states the mode, e.g. "Theme: auto (dark)". */
const themeButton = (page: Page) => page.getByRole("banner").getByRole("button", { name: /^Theme: / })

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
  await themeButton(page).click() // Auto -> Light
  await themeButton(page).click() // Light -> Dark
  await expect(themeButton(page)).toHaveAccessibleName("Theme: dark")
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
  test("is Akari's Header, unmodified (drift guard), marking the current page", async ({ page }) => {
    await page.goto("/about/")
    await expect(page.locator("header[data-akari-header]")).toHaveCount(1)
    await expect(page.getByRole("banner")).toHaveAttribute("data-akari-header", "")
    const nav = page.getByRole("banner").getByRole("navigation", { name: "Main" })
    await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page")
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)
  })

  // Route table: at most one current nav item (the dot, data-current) with the right aria-current, and no other
  // link on the page says "current page" (breadcrumb spans are not links).
  const CURRENT: [string, string | null, string | null][] = [
    ["/", null, null],
    ["/#practice", "Practice", "location"],
    ["/#toolbox", "Toolbox", "location"],
    ["/about/", "About", "page"],
    ["/projects/", "Projects", "true"],
    ["/projects/replay/", "Projects", "true"],
    ["/akari/", "Projects", "true"],
    ["/no-such-page/", null, null],
  ]
  for (const [path, label, aria] of CURRENT) {
    test(`current item on ${path}`, async ({ page }) => {
      await page.goto(path)
      await controlsReady(page)
      const current = page.getByRole("banner").locator("[data-current]")
      await expect(current).toHaveCount(label ? 1 : 0)
      if (label) {
        await expect(current).toHaveText(label)
        await expect(current).toHaveAttribute("aria-current", aria!)
      }
      await expect(page.locator('a[aria-current="page"]')).toHaveCount(aria === "page" ? 1 : 0)
    })
  }

  test("the dot follows the home-page section while scrolling", async ({ page }) => {
    await page.goto("/")
    await controlsReady(page)
    const current = page.getByRole("banner").locator("[data-current]")
    await expect(current).toHaveCount(0)
    await page
      .locator("#practice")
      .evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 60))
    await expect(current).toHaveText("Practice")
    await expect(current).toHaveAttribute("aria-current", "location")
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(current).toHaveCount(0)
  })

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

  test("nav sits right of the name, under the strip, with anchors to the home sections", async ({ page }) => {
    await page.goto("/projects/replay/")
    const banner = page.getByRole("banner")
    const nav = banner.getByRole("navigation")
    const links = nav.getByRole("link")
    await expect(links).toHaveText(["Projects", "Practice", "Toolbox", "About"])
    expect(await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")))).toEqual([
      "/#projects",
      "/#practice",
      "/#toolbox",
      "/about/",
    ])
    const brand = (await banner.getByRole("link", { name: "Kurt Matthew Nudo" }).boundingBox())!
    const first = (await links.first().boundingBox())!
    const toggle = (await themeButton(page).boundingBox())!
    // The theme controls live in the utility strip above the main row.
    expect(toggle.y + toggle.height).toBeLessThanOrEqual(brand.y)
    if (page.viewportSize()!.width >= 640) {
      // Desktop: the main row, the nav right-aligned after the name.
      expect(first.x).toBeGreaterThan(brand.x + brand.width)
      expect(Math.abs(first.y + first.height / 2 - (brand.y + brand.height / 2))).toBeLessThan(4)
    } else {
      // Phones: the nav takes its own row under the name, starting at the left edge.
      expect(first.y).toBeGreaterThan(brand.y)
      expect(first.x).toBeLessThanOrEqual(brand.x + 1)
    }
    await links.nth(1).click()
    await expect(page).toHaveURL(/\/#practice$/)
    await expect(page.locator("#practice")).toBeInViewport()
  })

  test("theme controls: one Auto/Light/Dark button, then high contrast to its right", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" })
    await page.goto("/")
    await controlsReady(page)
    const banner = page.getByRole("banner")
    await expect(banner.getByRole("radio")).toHaveCount(0)
    await expect(themeButton(page)).toHaveCount(1)
    // First visit is Auto: follows the system (dark here) without storing anything.
    await expect(themeButton(page)).toHaveAccessibleName("Theme: auto (dark)")
    await expect(themeButton(page)).not.toHaveAttribute("aria-pressed")
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull()
    const contrast = banner.getByRole("button", { name: "High contrast" })
    await expect(contrast).toHaveAttribute("aria-pressed", "false")
    const order = await banner.getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))
    expect(order.indexOf("Theme: auto (dark)")).toBe(order.indexOf("High contrast") - 1)
    // Auto -> Light stores the choice; Light -> Dark -> Auto clears it again.
    await themeButton(page).click()
    await expect(themeButton(page)).toHaveAccessibleName("Theme: light")
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("light")
    await themeButton(page).click()
    await themeButton(page).click()
    await expect(themeButton(page)).toHaveAccessibleName("Theme: auto (dark)")
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull()
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
  test("has the hero, eyebrows, projects without demo links, principles and toolbox", async ({ page }) => {
    await page.goto("/")
    const main = page.getByRole("main")
    await expect(main.getByText(/full-stack developer at IBM, migrating Japanese banking systems/)).toBeVisible()
    await expect(main.getByRole("link", { name: "See the projects" })).toHaveAttribute("href", "#projects")

    for (const name of ["Projects", "How I build", "What I build with"]) {
      await expect(main.getByRole("heading", { level: 2, name })).toBeVisible()
    }

    // Monospace eyebrows above each section title.
    for (const [id, eyebrow] of [
      ["projects", "Work"],
      ["practice", "Practice"],
      ["toolbox", "Toolbox"],
    ]) {
      await expect(page.locator(`#${id} .eyebrow`).first()).toHaveText(eyebrow)
    }
    // No demo links on the home page: each project links to its page only.
    await expect(main.locator('a[href^="https://replay.krtmtthw.dev"]')).toHaveCount(0)
    await expect(main.locator('a[href="/akari/"]')).toHaveCount(0)

    await expect(page.locator("#practice li")).toHaveCount(4)
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
    await expect(page.locator("#research")).toHaveCount(0)
    await expect(page.locator("#contact")).toHaveCount(0)
    await expect(page.locator("#toolbox dd").first()).toContainText("Rust")
    await expect(page.locator("#practice h3")).toContainText(["Built to keep working", "Fast on an ordinary phone"])
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
    await expect(index).toHaveCount(3)
    for (const href of await index.evaluateAll((els) => els.map((e) => e.getAttribute("href")))) {
      await expect(page.locator(href!)).toHaveCount(1)
    }
  })

  test("lists every project as an open row, in order, with the same facts", async ({ page, request }) => {
    const expected = [
      ["Lights", "/projects/lights/"],
      ["Replay", "/projects/replay/"],
      ["Kessan Lens", "/projects/kessan-lens/"],
      ["Akari", "/projects/akari/"],
    ]
    // Same list and order as /projects/.
    await page.goto("/projects/")
    expect(
      await page
        .getByRole("main")
        .locator("li h2 a")
        .evaluateAll((els) => els.map((a) => a.getAttribute("href"))),
    ).toEqual(expected.map(([, href]) => href))
    await page.goto("/")
    const rows = page.getByTestId("project-rows").locator(":scope > li")
    await expect(rows).toHaveCount(4)
    for (const [i, [title, href]] of expected.entries()) {
      const row = rows.nth(i)
      await expect(row.getByRole("heading", { level: 3 })).toHaveText(new RegExp(`^${title}`))
      await expect(row.getByRole("link", { name: title, exact: true })).toHaveAttribute("href", href)
      await expect(row.getByText(/^Status: /)).toHaveCount(1)
      await expect(row.locator("dt")).toHaveText(["Data", "Languages", "So far"])
      await expect(row.getByRole("link", { name: `Read the project page about ${title}` })).toHaveAttribute(
        "href",
        href,
      )
      await expect(row.locator("figure figcaption")).toHaveCount(1)
      // Every link in a row goes to its project page.
      for (const h of await row.getByRole("link").evaluateAll((els) => els.map((e) => e.getAttribute("href"))))
        expect(h).toBe(href)
      expect((await request.get(href)).status()).toBe(200)
    }
    for (const i of [0, 1, 2]) await expect(rows.nth(i).locator('[data-picture="shot"] img')).toHaveCount(2)
    // Kessan Lens is shelved: its picture is the prototype design, captioned as such.
    await expect(rows.nth(2).locator("figcaption")).toContainText("Prototype design (illustrative figures")
    await expect(rows.nth(2).locator("img").first()).toHaveAttribute("alt", /^Prototype design of Kessan Lens/)
    await expect(rows.nth(3).locator('[data-picture="live"] astro-island')).toHaveCount(1)
    await expect(rows.nth(3)).toContainText("A live Akari component: switch the trend.")
    await expect(page.locator("#projects astro-island")).toHaveCount(1)
  })

  test("the Akari preview hydrates only when visible, and works inside its row", async ({ page }) => {
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
    // Clicking the preview must not navigate.
    await expect(page).toHaveURL(/\/$/)
    const box = (await preview.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  })

  test("both Replay screenshots are optimised, lazy images with alt text", async ({ page }) => {
    await page.goto("/")
    for (const scheme of ["light", "dark"]) {
      const img = page.locator(
        `[data-testid="project-rows"] > li:nth-child(2) [data-picture="shot"] img[data-theme-shot="${scheme}"]`,
      )
      await expect(img).toHaveAttribute("alt", new RegExp(`^Replay's storm page .*in its ${scheme} theme\\.$`))
      await expect(img).toHaveAttribute("srcset", /\.webp 1920w/)
      await expect(img).toHaveAttribute("loading", "lazy")
    }
  })

  // The screenshot follows the active theme: system preference by default, the header toggle when set.
  const shot = (page: Page, scheme: "light" | "dark") =>
    page.locator(
      `[data-testid="project-rows"] > li:nth-child(2) [data-picture="shot"] img[data-theme-shot="${scheme}"]`,
    )
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
    await themeButton(page).click() // Auto -> Light
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
    await themeButton(page).click() // Light -> Dark
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
    await expectShot(page, "dark")
    await themeButton(page).click() // Dark -> Auto: follows the system again, live
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
    await expectShot(page, "light")
    await page.emulateMedia({ colorScheme: "dark" })
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
    await expectShot(page, "dark")
    // Explicit light wins over a dark system preference, and survives a reload.
    await themeButton(page).click()
    await expectShot(page, "light")
    await page.reload()
    await expectShot(page, "light")
    await controlsReady(page)
    await themeButton(page).click() // Light -> Dark
    await page.emulateMedia({ colorScheme: "light" })
    await expectShot(page, "dark")
  })

  test("new sections ship no extra JavaScript islands", async ({ page }) => {
    await page.goto("/")
    // Only the header controls and the Akari preview (in its project row) hydrate.
    await expect(page.locator("astro-island")).toHaveCount(2)
  })
})

test("Replay project page: live demo button, facts at a glance, numbered sections", async ({ page }) => {
  await page.goto("/projects/replay/")
  const main = page.getByRole("main")
  await expect(main.getByRole("link", { name: "Open the live demo" })).toHaveAttribute(
    "href",
    "https://replay.krtmtthw.dev",
  )
  await expect(main.getByRole("link", { name: "Source on GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/abrycta/typhoon-replay",
  )
  const glance = page.getByRole("complementary", { name: "At a glance" })
  await expect(glance.locator("dt")).toHaveText(["Status", "Data", "Languages", "So far", "Updated"])
  await expect(glance.getByRole("link", { name: "Live demo" })).toHaveAttribute("href", "https://replay.krtmtthw.dev")
  await expect(glance.getByRole("link", { name: "Repository" })).toHaveAttribute(
    "href",
    "https://github.com/abrycta/typhoon-replay",
  )
  await expect(page.locator(".numbered h2")).toHaveText(["Problem", "Approach", "Architecture", "Where it stands"])
  await expect(page.getByRole("link", { name: "Next: Kessan Lens" })).toHaveAttribute("href", "/projects/kessan-lens/")
  await expect(page.getByRole("link", { name: "All projects" })).toHaveAttribute("href", "/#projects")
})

test("planned project pages show a note instead of a demo button", async ({ page }) => {
  await page.goto("/projects/kessan-lens/")
  const actions = page.getByTestId("project-actions")
  await expect(actions).toContainText("Demo when live")
  await expect(actions.getByRole("link")).toHaveCount(0)
  await expect(page.getByRole("main")).not.toContainText("Filipino")
})

test("SEO basics: canonical, OG, robots and sitemap", async ({ page, request }) => {
  await page.goto("/projects/replay/")
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /^https:\/\/krtmtthw\.dev\/projects\/replay\/$/,
  )
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /Replay/)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/)
  const robots = await request.get("/robots.txt")
  expect(await robots.text()).toContain("Sitemap:")
  expect((await request.get("/sitemap-index.xml")).status()).toBe(200)
  expect((await request.get("/og.png")).headers()["content-type"]).toContain("image/png")
})
