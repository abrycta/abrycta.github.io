/**
 * Live embeds (LIVE-EMBEDS-PLAN.md, CLAUDE.md rule 6b): a live project's picture is only its app's /embed iframe,
 * never a screenshot, on every device class. Every embed loads with the page (not lazily, never unloaded) over a
 * placeholder of the slot's exact size, in one of two modes:
 * - desktop (>= 768 px, hover + fine pointer): the app's fixed viewport, CSS-scaled to the slot;
 * - compact (phones, touch tablets, narrow windows): the slot's real size.
 * Embeds move only in view, and on touch devices one at a time (pause/resume messages). Save-Data, reduced motion
 * and low memory change none of that. Touch never reaches the frame.
 * The apps are stubbed: a tiny page that posts `akari:embed-ready` (a little late, so the placeholder shows first)
 * and records what it is sent.
 */
import { devices, expect, test, type BrowserContextOptions, type Page } from "@playwright/test"

const STUB = `<!doctype html><title>stub</title><script>
  window.got = [];
  addEventListener("message", (e) => window.got.push({ origin: e.origin, data: e.data }));
  setTimeout(() => parent.postMessage({ type: "akari:embed-ready" }, "*"), 400);
</script>`

async function open(page: Page, path: string) {
  await page
    .context()
    .route(/^https:\/\/(replay|lights)\.krtmtthw\.dev\/embed/, (r) =>
      r.fulfill({ contentType: "text/html", body: STUB }),
    )
  await page.goto(path)
}

const LIVE = ".live-embed-shell iframe"
const embeds = (page: Page) => page.locator(`[data-live-embed] ${LIVE}`)
/** The pause/resume messages a frame has received, in order. */
const motion = (page: Page, i: number) =>
  page
    .locator(`[data-live-embed] ${LIVE}`)
    .nth(i)
    .contentFrame()
    .locator("html")
    .evaluate(() =>
      (window as unknown as { got: { data: { type: string } }[] }).got
        .map((m) => m.data.type)
        .filter((t) => t === "akari:embed-pause" || t === "akari:embed-resume"),
    )

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

type Mode = "desktop" | "compact"
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
      test(`loads every ${d.mode} embed with the page${d.single ? ", one moving at a time" : ""}`, async ({ page }) => {
        if (d.fine) await finePrimaryPointer(page)
        for (const path of ["/", "/projects/replay/", "/projects/lights/"]) {
          await open(page, path)
          const slots = await page.locator("[data-live-embed]").all()
          // Every embed starts with the page, before any scrolling (no lazy loading), and no screenshot anywhere.
          await expect(embeds(page)).toHaveCount(slots.length)
          for (const slot of slots) {
            await expect(slot.locator("img")).toHaveCount(0)
            // No link to the live app: apps are linked only from their project page.
            await expect(slot.locator("a")).toHaveCount(0)
            await expect(slot.locator(LIVE)).not.toHaveAttribute("loading", /.*/)
          }
          for (const [i, slot] of slots.entries()) {
            await slot.evaluate((el) => el.scrollIntoView({ block: "center" }))
            // Its place on the page (document coordinates, so a scroll in between doesn't count).
            const place = () =>
              slot.evaluate((el) => {
                const r = el.getBoundingClientRect()
                return [r.left + scrollX, r.top + scrollY, r.width, r.height]
              })
            const before = await place()
            await expect(slot).toHaveAttribute("data-embed", "live")
            // The frame replaces the placeholder in place: no layout shift.
            expect(await place()).toEqual(before)
            await expect(embeds(page)).toHaveCount(slots.length) // never unloaded
            // The slot in view moves; on touch devices it is the only one, on desktops off-screen ones are paused.
            await expect(slot).toHaveAttribute("data-embed-motion", "playing")
            await expect.poll(async () => (await motion(page, i)).at(-1)).toBe("akari:embed-resume")
            for (const [j, other] of slots.entries())
              if (
                j !== i &&
                (d.single ||
                  !(await other.evaluate(
                    (el) => el.getBoundingClientRect().bottom > 0 && el.getBoundingClientRect().top < innerHeight,
                  )))
              )
                await expect(other).not.toHaveAttribute("data-embed-motion", "playing")
            const frame = slot.locator(LIVE)
            await expect(frame).toHaveAttribute("title", /^(Replay|Lights): /)
            await expect(frame).toHaveAttribute("sandbox", /allow-scripts/)
            await expect(frame).toHaveAttribute("aria-describedby", /^picture-caption-/)
            await expect(frame).toHaveAttribute("src", /lang=en&pr=(0\.\d+|1(\.\d+)?|2)&paused=1$/)
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

    test("a swipe over the embed scrolls the page, and the embed pauses off-screen", async ({ page }) => {
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
      // Out of view: paused, but still loaded (never unloaded).
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight))
      await expect(slot).toHaveAttribute("data-embed-motion", "paused")
      await expect.poll(async () => (await motion(page, 0)).at(-1)).toBe("akari:embed-pause")
      await expect(embeds(page)).toHaveCount(1)
      await expect(slot).toHaveAttribute("data-embed", "live")
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
      test(`${name} still loads every embed with the page`, async ({ page }) => {
        await page.addInitScript(init)
        await open(page, "/")
        await expect(embeds(page)).toHaveCount(2)
        await expect(page.locator('[data-embed="live"]')).toHaveCount(2)
        await expect(page.locator("[data-live-embed] img")).toHaveCount(0)
      })
  })

  test.describe("normal desktop", () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test("reduced motion still loads the embed (the app shows its still view itself)", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" })
      await open(page, "/projects/replay/")
      await expect(embeds(page)).toHaveCount(1)
      await expect(page.locator('[data-embed="live"]')).toHaveCount(1)
      await expect(page.locator("[data-live-embed] img")).toHaveCount(0)
    })

    test("switches the same frame to compact when the window narrows, and back", async ({ page }) => {
      await open(page, "/projects/replay/")
      const frame = embeds(page)
      await expect(frame).toHaveAttribute("width", "1440")
      await frame.evaluate((f) => ((f as HTMLIFrameElement & { mark?: number }).mark = 1))
      await page.setViewportSize({ width: 700, height: 800 })
      await expect(frame).toHaveAttribute("width", /^6\d\d$/)
      await page.setViewportSize({ width: 1280, height: 800 })
      await expect(frame).toHaveAttribute("width", "1440")
      // Resized, never reloaded: the same element.
      expect(await frame.evaluate((f) => (f as HTMLIFrameElement & { mark?: number }).mark)).toBe(1)
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
