/**
 * Live embeds (LIVE-EMBEDS-PLAN.md, CLAUDE.md rule 6b): the screenshot is the first paint; capable
 * devices (>= 768 px, hover + fine pointer, no Save-Data) upgrade to the app's /embed iframe.
 * The apps are stubbed: a tiny page that posts `akari:embed-ready` and records what it is sent.
 */
import { devices, expect, test, type BrowserContextOptions, type Page } from "@playwright/test"

const STUB = `<!doctype html><title>stub</title><script>
  window.got = [];
  addEventListener("message", (e) => window.got.push({ origin: e.origin, data: e.data }));
  parent.postMessage({ type: "akari:embed-ready" }, "*");
</script>`

async function open(page: Page, path: string) {
  await page
    .context()
    .route(/^https:\/\/(replay|lights)\.krtmtthw\.dev\/embed/, (r) =>
      r.fulfill({ contentType: "text/html", body: STUB }),
    )
  await page.goto(path)
}

const embeds = (page: Page) => page.locator("[data-live-embed] iframe")

async function scrollAll(page: Page) {
  for (const slot of await page.locator("[data-live-embed]").all()) await slot.scrollIntoViewIfNeeded()
}

/** A device descriptor without its browser choice (the matrix runs in Chromium). */
const device = (name: string): BrowserContextOptions => {
  const { defaultBrowserType, ...use } = devices[name]
  void defaultBrowserType
  return use
}
const iPhone = device("iPhone 13")
const pixel = device("Pixel 7")
const iPad = device("iPad Pro 11 landscape")

const MATRIX: { name: string; use: BrowserContextOptions; live: boolean }[] = [
  { name: "iPhone", use: iPhone, live: false },
  { name: "Pixel", use: pixel, live: false },
  { name: "touch-only iPad", use: iPad, live: false },
  { name: "iPad with a mouse", use: { viewport: { width: 1194, height: 834 }, hasTouch: false }, live: true },
  { name: "touch laptop", use: { viewport: { width: 1366, height: 768 }, hasTouch: true }, live: true },
  { name: "narrow desktop", use: { viewport: { width: 700, height: 900 } }, live: false },
  { name: "normal desktop", use: { viewport: { width: 1280, height: 800 } }, live: true },
]

test.describe("live embeds", () => {
  test.beforeEach((_fixtures, info) => test.skip(info.project.name !== "desktop", "own device matrix"))

  for (const d of MATRIX) {
    test.describe(d.name, () => {
      test.use(d.use)
      test(`${d.live ? "upgrades to the live embed" : "keeps the screenshot and the link out"}`, async ({ page }) => {
        // A touch laptop's primary pointer is its trackpad (hover, fine pointer) while it also has a touch
        // screen. Chromium's hasTouch emulation makes every pointer coarse, so report what the real device does.
        if (d.name === "touch laptop")
          await page.addInitScript(() => {
            const real = window.matchMedia.bind(window)
            window.matchMedia = (q: string) => {
              const m = real(q)
              if (q === "(hover: hover) and (pointer: fine)") Object.defineProperty(m, "matches", { value: true })
              return m
            }
          })
        for (const path of ["/", "/projects/replay/", "/projects/lights/"]) {
          await open(page, path)
          await scrollAll(page)
          await page.waitForTimeout(300)
          const slots = page.locator("[data-live-embed]")
          for (const slot of await slots.all()) {
            await expect(slot.locator("img")).toHaveCount(2)
            await expect(slot.locator("[data-live-link]")).toHaveAttribute("target", "_blank")
          }
          if (!d.live) {
            await expect(embeds(page)).toHaveCount(0)
            continue
          }
          await expect(embeds(page)).toHaveCount(path === "/" ? 2 : 1)
          await expect(page.locator('[data-live-embed][data-embed="live"]')).toHaveCount(path === "/" ? 2 : 1)
          const frame = embeds(page).first()
          await expect(frame).toHaveAttribute("title", /, live: /)
          await expect(frame).toHaveAttribute("sandbox", /allow-scripts/)
          await expect(frame).toHaveAttribute("aria-describedby", /^picture-caption-/)
          await expect(frame).toHaveAttribute("src", /lang=en/)
          // The live link is the embed's own once it is live.
          await expect(page.locator('[data-embed="live"] [data-live-link]').first()).toBeHidden()
        }
      })
    })
  }

  test.describe("normal desktop", () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test("drops the embed when the window narrows and brings it back", async ({ page }) => {
      await open(page, "/projects/replay/")
      await expect(embeds(page)).toHaveCount(1)
      await page.setViewportSize({ width: 700, height: 800 })
      await expect(embeds(page)).toHaveCount(0)
      await page.setViewportSize({ width: 1280, height: 800 })
      await expect(embeds(page)).toHaveCount(1)
    })

    test("Save-Data keeps the screenshot", async ({ page }) => {
      await page.addInitScript(() =>
        Object.defineProperty(navigator, "connection", { value: Object.assign(new EventTarget(), { saveData: true }) }),
      )
      await open(page, "/projects/lights/")
      await page.waitForTimeout(500)
      await expect(embeds(page)).toHaveCount(0)
    })

    test("passes theme changes to the embed, to its origin only", async ({ page }) => {
      await open(page, "/projects/replay/")
      await expect(page.locator('[data-embed="live"]')).toHaveCount(1)
      await page
        .getByRole("banner")
        .getByRole("button", { name: /^Theme: / })
        .click()
      const frame = page.frameLocator("[data-live-embed] iframe")
      await expect
        .poll(() =>
          frame
            .locator("html")
            .evaluate(() =>
              (window as unknown as { got: { data: { type: string; theme?: string } }[] }).got
                .filter((m) => m.data.type === "akari:theme")
                .map((m) => m.data.theme),
            ),
        )
        .toContain("light")
    })
  })
})
