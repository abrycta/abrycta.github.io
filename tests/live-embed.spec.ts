/**
 * Live embeds (LIVE-EMBEDS-PLAN.md, CLAUDE.md rule 6b): the screenshot is the first paint; near the view it
 * upgrades to the app's /embed iframe on every device class, in one of two modes:
 * - desktop (>= 768 px, hover + fine pointer): the app's fixed viewport, CSS-scaled to the slot;
 * - compact (phones, touch tablets, narrow windows): the slot's real size, one embed at a time.
 * Save-Data, reduced motion and low memory keep the screenshot. Touch never reaches the frame.
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

/** The loaded frames (an unloading one fades out for 300 ms first). */
const LIVE = '.live-embed-shell:not([data-state="leaving"]) iframe'
const embeds = (page: Page) => page.locator(`[data-live-embed] ${LIVE}`)

/** A device descriptor without its browser choice (the matrix runs in Chromium). */
const device = (name: string): BrowserContextOptions => {
  const { defaultBrowserType, ...use } = devices[name]
  void defaultBrowserType
  return use
}

/**
 * A touch screen whose primary pointer is a trackpad or mouse (touch laptop, iPad with a trackpad): hover and a
 * fine primary pointer, plus a coarse one. Chromium's hasTouch emulation makes every pointer coarse, so report
 * what the real device does.
 */
async function finePrimaryPointer(page: Page) {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window)
    window.matchMedia = (q: string) => {
      const m = real(q)
      if (q === "(hover: hover) and (pointer: fine)") Object.defineProperty(m, "matches", { value: true })
      return m
    }
  })
}

type Mode = "desktop" | "compact" | "static"
const MATRIX: { name: string; use: BrowserContextOptions; mode: Mode; single: boolean; fine?: boolean }[] = [
  { name: "iPhone", use: device("iPhone 13"), mode: "compact", single: true },
  { name: "Pixel", use: device("Pixel 7"), mode: "compact", single: true },
  { name: "touch-only iPad", use: device("iPad Pro 11 landscape"), mode: "compact", single: true },
  {
    name: "iPad with a trackpad",
    use: { viewport: { width: 1194, height: 834 }, hasTouch: true },
    mode: "desktop",
    single: true,
    fine: true,
  },
  {
    name: "touch laptop",
    use: { viewport: { width: 1366, height: 768 }, hasTouch: true },
    mode: "desktop",
    single: true,
    fine: true,
  },
  { name: "narrow desktop", use: { viewport: { width: 700, height: 900 } }, mode: "compact", single: true },
  { name: "normal desktop", use: { viewport: { width: 1280, height: 800 } }, mode: "desktop", single: false },
]

test.describe("live embeds", () => {
  test.beforeEach(() => test.skip(test.info().project.name !== "desktop", "own device matrix"))

  for (const d of MATRIX) {
    test.describe(d.name, () => {
      test.use(d.use)
      test(`upgrades to the ${d.mode} embed${d.single ? ", one at a time" : ""}`, async ({ page }) => {
        if (d.fine) await finePrimaryPointer(page)
        for (const path of ["/", "/projects/replay/", "/projects/lights/"]) {
          await open(page, path)
          const slots = await page.locator("[data-live-embed]").all()
          for (const [i, slot] of slots.entries()) {
            // No link to the live app on the picture: apps are linked only from their project page.
            await expect(slot.locator("img")).toHaveCount(2)
            await expect(slot.locator("a")).toHaveCount(0)
            await slot.evaluate((el) => el.scrollIntoView({ block: "center" }))
            // Its place on the page (document coordinates, so a scroll in between doesn't count).
            const place = () =>
              slot.evaluate((el) => {
                const r = el.getBoundingClientRect()
                return [r.left + scrollX, r.top + scrollY, r.width, r.height]
              })
            const before = await place()
            await expect(slot).toHaveAttribute("data-embed", "live")
            // The iframe fills the slot: no layout shift.
            expect(await place()).toEqual(before)
            // One at a time: only the slot in view holds a frame; desktops keep every loaded one.
            await expect(embeds(page)).toHaveCount(d.single ? 1 : i + 1)
            const frame = slot.locator(LIVE)
            await expect(frame).toHaveAttribute("title", /, live: /)
            await expect(frame).toHaveAttribute("sandbox", /allow-scripts/)
            await expect(frame).toHaveAttribute("aria-describedby", /^picture-caption-/)
            await expect(frame).toHaveAttribute("src", /lang=en&pr=(0\.\d+|1(\.\d+)?|2)$/)
            const box = await frame.evaluate((f: HTMLIFrameElement) => ({
              width: Number(f.width),
              shell: f.parentElement!.clientWidth,
              transform: f.style.transform,
              touch: getComputedStyle(f).pointerEvents,
            }))
            if (d.mode === "compact") {
              // The slot's real size, never a scaled-down desktop view.
              expect(box.width).toBe(box.shell)
              expect(box.transform).toBe("")
            } else {
              expect([1280, 1440]).toContain(box.width)
              expect(box.transform).toMatch(/^scale\(0\.\d+\)$/)
            }
            // Touch never goes to the frame, so the page always scrolls; mice keep the frame.
            expect(box.touch).toBe(d.use.hasTouch ? "none" : "auto")
          }
        }
      })
    })
  }

  test.describe("iPhone", () => {
    test.use(device("iPhone 13"))

    test("a swipe over the embed scrolls the page, and the embed unloads off-screen", async ({ page }) => {
      await open(page, "/projects/lights/")
      const slot = page.locator("[data-live-embed]")
      await slot.evaluate((el) => el.scrollIntoView({ block: "center" }))
      await expect(slot).toHaveAttribute("data-embed", "live")
      const box = (await slot.boundingBox())!
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
      // What a finger lands on is the page's own picture, not the frame.
      expect(await page.evaluate(([px, py]) => document.elementFromPoint(px!, py!)?.tagName, [x, y])).not.toBe("IFRAME")
      // Swipe once over the embed and once over plain text: the embed must scroll the page as far as text does.
      // (Headless Linux Chromium ignores synthetic touch scrolls everywhere, so there both read 0; macOS moves both.)
      const cdp = await page.context().newCDPSession(page)
      const swipe = async (px: number, py: number) => {
        const from = await page.evaluate(() => scrollY)
        await cdp.send("Input.synthesizeScrollGesture", {
          x: Math.round(px),
          y: Math.round(py),
          yDistance: -300,
          gestureSourceType: "touch",
          speed: 1200,
        })
        await page.waitForTimeout(500)
        return (await page.evaluate(() => scrollY)) - from
      }
      const overEmbed = await swipe(x, y)
      const text = page.locator("main p").nth(3)
      await text.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }))
      await page.waitForTimeout(300)
      const t = (await text.boundingBox())!
      const view = page.viewportSize()!
      const overText = await swipe(view.width / 2, Math.min(Math.max(t.y + t.height / 2, 10), view.height - 10))
      expect(overEmbed).toBeGreaterThanOrEqual(overText - 50)
      // Out of view (and its 300 px margin): the frame is dropped, the screenshot is back.
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight))
      await expect(embeds(page)).toHaveCount(0)
      await expect(slot).toHaveAttribute("data-embed", "static")
    })

    for (const { name, init } of [
      {
        name: "Save-Data",
        init: () =>
          Object.defineProperty(navigator, "connection", {
            value: Object.assign(new EventTarget(), { saveData: true }),
          }),
      },
      { name: "low memory", init: () => Object.defineProperty(navigator, "deviceMemory", { value: 2 }) },
    ])
      test(`${name} keeps the screenshot`, async ({ page }) => {
        await page.addInitScript(init)
        await open(page, "/projects/lights/")
        await page.locator("[data-live-embed]").evaluate((el) => el.scrollIntoView({ block: "center" }))
        await page.waitForTimeout(800)
        await expect(embeds(page)).toHaveCount(0)
      })
  })

  test.describe("normal desktop", () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test("reduced motion keeps the screenshot, and the embed comes when it is turned off", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" })
      await open(page, "/projects/replay/")
      await page.waitForTimeout(800)
      await expect(embeds(page)).toHaveCount(0)
      await page.emulateMedia({ reducedMotion: "no-preference" })
      await expect(embeds(page)).toHaveCount(1)
    })

    test("switches to the compact embed when the window narrows, and back", async ({ page }) => {
      await open(page, "/projects/replay/")
      const frame = embeds(page)
      await expect(frame).toHaveAttribute("width", "1440")
      await page.setViewportSize({ width: 700, height: 800 })
      await expect(frame).toHaveAttribute("width", /^6\d\d$/)
      await page.setViewportSize({ width: 1280, height: 800 })
      await expect(frame).toHaveAttribute("width", "1440")
    })

    test("passes theme changes to the embed, to its origin only", async ({ page }) => {
      await open(page, "/projects/replay/")
      await expect(page.locator('[data-embed="live"]')).toHaveCount(1)
      await page
        .getByRole("banner")
        .getByRole("button", { name: /^Theme: / })
        .click()
      const frame = page.frameLocator(`[data-live-embed] ${LIVE}`)
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
