/**
 * Live embeds (LIVE-EMBEDS-PLAN.md): the screenshot is the first paint and the fallback; on capable
 * devices it is upgraded to the app's frozen /embed page once it scrolls near the view.
 *
 * - Capable (CLAUDE.md rule 6b): `(min-width: 768px)`, `(hover: hover) and (pointer: fine)` and no
 *   Save-Data. Never user-agent. Re-checked on resize, rotation and input changes (matchMedia
 *   listeners); when a device stops qualifying, the iframe is removed and the screenshot is back.
 * - The iframe renders the app at the screenshot's fixed viewport (e.g. 1440×900) and is CSS-scaled
 *   to the slot, so the slot's size never changes. It stays invisible over the screenshot until the
 *   app posts `akari:embed-ready`, then fades in (instantly with reduced motion).
 * - Theme bridge: the shared krtmtthw.dev cookie already reaches the iframe; on every theme-store write
 *   here (Akari's `themestorechange`) the iframe is told to re-read it.
 */
import { readStored, THEME_STORE_EVENT } from "@abrycta/akari/react"

const CAPABLE = ["(min-width: 768px)", "(hover: hover) and (pointer: fine)"]
const NO_DATA_SAVER = "(prefers-reduced-data: reduce)"
const STORE = { sharedCookieDomain: "krtmtthw.dev" }

interface Slot {
  root: HTMLElement
  src: string
  origin: string
  width: number
  height: number
  title: string
  describedBy: string
  frame: HTMLIFrameElement | null
  shell: HTMLElement | null
  ready: boolean
  visible: boolean
}

function capable(): boolean {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (conn?.saveData) return false
  if (matchMedia(NO_DATA_SAVER).matches) return false
  return CAPABLE.every((q) => matchMedia(q).matches)
}

function scaleOf(slot: Slot): number {
  const w = slot.shell?.clientWidth ?? slot.root.clientWidth
  return w > 0 ? w / slot.width : 1
}

function post(slot: Slot, msg: unknown) {
  if (slot.ready) slot.frame?.contentWindow?.postMessage(msg, slot.origin)
}

function postTheme(slot: Slot) {
  const { theme, contrast } = readStored(STORE)
  post(slot, { type: "akari:theme", theme, contrast })
}

function layout(slot: Slot) {
  if (!slot.frame) return
  const scale = scaleOf(slot)
  slot.frame.style.transform = `scale(${scale})`
  post(slot, { type: "akari:embed-scale", scale })
}

function mount(slot: Slot) {
  if (slot.frame) return
  const shell = document.createElement("div")
  shell.className = "live-embed-shell"
  shell.dataset.state = "loading"
  const frame = document.createElement("iframe")
  // A device pixel ratio for the scaled-down frame: enough for a sharp map, no more.
  const pr = Math.min(2, Math.max(0.5, Math.ceil((scaleOf(slot) * devicePixelRatio) / 0.25) * 0.25))
  const url = new URL(slot.src)
  url.searchParams.set("lang", "en")
  url.searchParams.set("pr", String(pr))
  frame.src = url.href
  frame.title = slot.title
  frame.width = String(slot.width)
  frame.height = String(slot.height)
  frame.referrerPolicy = "strict-origin-when-cross-origin"
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox")
  frame.setAttribute("aria-describedby", slot.describedBy)
  frame.dataset.akariEmbed = ""
  shell.append(frame)
  slot.root.append(shell)
  slot.frame = frame
  slot.shell = shell
  layout(slot)
}

function unmount(slot: Slot) {
  slot.shell?.remove()
  slot.frame = null
  slot.shell = null
  slot.ready = false
  slot.root.dataset.embed = "static"
}

function init() {
  const roots = [...document.querySelectorAll<HTMLElement>("[data-live-embed]")]
  if (!roots.length) return
  const slots: Slot[] = roots.map((root) => ({
    root,
    src: root.dataset.embedSrc!,
    origin: new URL(root.dataset.embedSrc!).origin,
    width: Number(root.dataset.embedWidth),
    height: Number(root.dataset.embedHeight),
    title: root.dataset.embedTitle!,
    describedBy: root.dataset.embedDescribedby!,
    frame: null,
    shell: null,
    ready: false,
    visible: false,
  }))

  const update = () => {
    const ok = capable()
    for (const s of slots) {
      if (ok && s.visible) mount(s)
      else if (!ok && s.frame) unmount(s)
    }
  }

  // Load only when the slot nears the view; once mounted the iframe stays (repeat views are cached).
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const s = slots.find((x) => x.root === e.target)
        if (s && e.isIntersecting) s.visible = true
      }
      update()
    },
    { rootMargin: "300px 0px" },
  )
  for (const s of slots) io.observe(s.root)

  for (const q of [...CAPABLE, NO_DATA_SAVER, "(any-hover: hover)", "(any-pointer: fine)", "(orientation: portrait)"])
    matchMedia(q).addEventListener("change", update)
  ;(navigator as Navigator & { connection?: EventTarget }).connection?.addEventListener?.("change", update)

  const ro = new ResizeObserver(() => slots.forEach(layout))
  for (const s of slots) ro.observe(s.root)

  window.addEventListener("message", (e) => {
    const s = slots.find((x) => x.frame && e.source === x.frame.contentWindow && e.origin === x.origin)
    if (!s || (e.data as { type?: string } | null)?.type !== "akari:embed-ready") return
    s.ready = true
    s.shell!.dataset.state = "ready"
    s.root.dataset.embed = "live"
    layout(s)
    postTheme(s)
  })
  window.addEventListener(THEME_STORE_EVENT, () => slots.forEach(postTheme))
  update()
}

init()
