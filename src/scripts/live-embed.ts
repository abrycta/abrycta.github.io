/**
 * Live embeds (LIVE-EMBEDS-PLAN.md, CLAUDE.md rule 6b): the screenshot is the first paint and the fallback; it is
 * upgraded to the app's frozen /embed page once it nears the view, on desktops, tablets and phones alike.
 *
 * - Two modes, never by user-agent:
 *   - desktop (`(min-width: 768px)` and `(hover: hover) and (pointer: fine)`): the iframe renders the app at the
 *     screenshot's fixed viewport (e.g. 1440×900) and is CSS-scaled to the slot, as since the first release;
 *   - compact (everything else: phones, touch tablets, narrow windows): the iframe gets the slot's real size, and
 *     the app lays itself out for it (map over a short caption; its own width decides), never a scaled-down
 *     desktop view.
 *   Either way the slot's size never changes: the iframe sits in an absolute shell over the screenshot.
 * - The screenshot stays (no iframe at all) with Save-Data, `prefers-reduced-motion: reduce`, or a low-memory
 *   device (`navigator.deviceMemory` < 4, where the browser tells).
 * - Loading: only near the view (IntersectionObserver). On touch devices and in compact mode at most one embed is
 *   loaded at a time (the most visible one; iOS Safari kills tabs that hold several WebGL maps) and one that
 *   leaves the view is unloaded, which also stops its animation. On desktops a loaded embed stays and pauses
 *   itself out of view or in a hidden tab (both apps watch their own visibility).
 * - Touch never goes to the frame (`pointer-events: none` for coarse pointers, global.css): the page always scrolls.
 * - Each mode or capability change (resize, rotation, input, Save-Data, motion) is re-checked with matchMedia
 *   listeners; an embed that no longer qualifies is removed and the screenshot is back.
 * - The frame stays invisible over the screenshot until the app posts `akari:embed-ready` (checked: the frame's
 *   own window and the app's origin), then cross-fades in. Messages to it name its origin.
 * - Theme bridge: the shared krtmtthw.dev cookie already reaches the iframe; on every theme-store write here
 *   (Akari's `themestorechange`) the iframe is told to re-read it.
 */
import { readStored, THEME_STORE_EVENT } from "@abrycta/akari/react"

const DESKTOP = ["(min-width: 768px)", "(hover: hover) and (pointer: fine)"]
const TOUCH = "(any-pointer: coarse)"
const NO_DATA = "(prefers-reduced-data: reduce)"
const NO_MOTION = "(prefers-reduced-motion: reduce)"
const STORE = { sharedCookieDomain: "krtmtthw.dev" }
/** Unload fade, as global.css's shell transition. */
const FADE_MS = 300
/** One-at-a-time mode: how long a slot must stay the most visible before it loads (no churn while flicking past). */
const SETTLE_MS = 200

type Mode = "desktop" | "compact"
type Nav = Navigator & { connection?: EventTarget & { saveData?: boolean }; deviceMemory?: number }

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
  mode: Mode | null
  ready: boolean
  /** Within 300 px of the view. */
  near: boolean
  /** How much of it is in the view (0-1). */
  ratio: number
}

/** Whether live embeds run at all here. */
function allowed(): boolean {
  const nav = navigator as Nav
  if (nav.connection?.saveData) return false
  if (matchMedia(NO_DATA).matches || matchMedia(NO_MOTION).matches) return false
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) return false
  return true
}

const modeNow = (): Mode => (DESKTOP.every((q) => matchMedia(q).matches) ? "desktop" : "compact")
/** Touch devices and compact mode load one embed at a time. */
const oneAtATime = () => modeNow() === "compact" || matchMedia(TOUCH).matches

function slotSize(slot: Slot): [number, number] {
  const el = slot.shell ?? slot.root
  return [el.clientWidth, el.clientHeight]
}

function post(slot: Slot, msg: unknown) {
  if (slot.ready) slot.frame?.contentWindow?.postMessage(msg, slot.origin)
}

function postTheme(slot: Slot) {
  const { theme, contrast } = readStored(STORE)
  post(slot, { type: "akari:theme", theme, contrast })
}

function layout(slot: Slot) {
  const frame = slot.frame
  if (!frame) return
  const [w, h] = slotSize(slot)
  if (slot.mode === "compact") {
    // The real size: the app lays out for it (rotation and resizes reflow it, never scale it).
    if (w > 0 && frame.width !== String(w)) frame.width = String(w)
    if (h > 0 && frame.height !== String(h)) frame.height = String(h)
    frame.style.transform = ""
    return
  }
  const scale = w > 0 ? w / slot.width : 1
  frame.style.transform = `scale(${scale})`
  post(slot, { type: "akari:embed-scale", scale })
}

function mount(slot: Slot, mode: Mode) {
  if (slot.frame) return
  const shell = document.createElement("div")
  shell.className = "live-embed-shell"
  shell.dataset.state = "loading"
  shell.dataset.mode = mode
  slot.root.append(shell) // first, so the shell's size is known below
  const frame = document.createElement("iframe")
  const [w, h] = slotSize({ ...slot, shell })
  // Device pixels for the map canvas: desktop, enough for the scaled-down frame; compact, the screen's, at most 2.
  const pr =
    mode === "desktop"
      ? Math.min(2, Math.max(0.5, Math.ceil(((w / slot.width) * devicePixelRatio) / 0.25) * 0.25))
      : Math.min(2, Math.max(1, Math.round(devicePixelRatio * 4) / 4))
  const url = new URL(slot.src)
  url.searchParams.set("lang", "en")
  url.searchParams.set("pr", String(pr))
  frame.src = url.href
  frame.title = slot.title
  frame.width = String(mode === "desktop" ? slot.width : w)
  frame.height = String(mode === "desktop" ? slot.height : h)
  frame.referrerPolicy = "strict-origin-when-cross-origin"
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox")
  frame.setAttribute("aria-describedby", slot.describedBy)
  frame.dataset.akariEmbed = ""
  shell.append(frame)
  slot.frame = frame
  slot.shell = shell
  slot.mode = mode
  layout(slot)
}

function unmount(slot: Slot) {
  const shell = slot.shell
  slot.frame = null
  slot.shell = null
  slot.mode = null
  slot.ready = false
  slot.root.dataset.embed = "static"
  if (!shell) return
  // Fade back to the screenshot underneath, then drop the frame (and its WebGL context).
  shell.dataset.state = "leaving"
  shell.querySelector("iframe")?.removeAttribute("data-akari-embed")
  setTimeout(() => shell.remove(), FADE_MS)
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
    mode: null,
    ready: false,
    near: false,
    ratio: 0,
  }))

  let pending: ReturnType<typeof setTimeout> | undefined
  const update = () => {
    clearTimeout(pending)
    if (!allowed()) return slots.forEach((s) => s.frame && unmount(s))
    const mode = modeNow()
    const single = oneAtATime()
    for (const s of slots) if (s.frame && (s.mode !== mode || (single && !s.near))) unmount(s)
    if (!single) return slots.forEach((s) => s.near && mount(s, mode))

    // One at a time: the most visible slot (else the nearest one coming up); the loaded one keeps its place
    // unless another is clearly more in view.
    const current = slots.find((s) => s.frame)
    const best = [...slots].sort((a, b) => b.ratio - a.ratio)[0]!
    let pick = best.ratio > 0 ? best : slots.find((s) => s.near)
    if (current && current.ratio > 0 && pick && pick.ratio - current.ratio < 0.25) pick = current
    for (const s of slots) if (s !== pick && s.frame) unmount(s)
    if (!pick || pick.frame) return
    const chosen = pick
    pending = setTimeout(() => {
      if (allowed() && chosen.near && !slots.some((s) => s.frame)) mount(chosen, modeNow())
    }, SETTLE_MS)
  }

  const near = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const s = slots.find((x) => x.root === e.target)
        if (s) s.near = e.isIntersecting
      }
      update()
    },
    { rootMargin: "300px 0px" },
  )
  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const s = slots.find((x) => x.root === e.target)
        if (s) s.ratio = e.isIntersecting ? e.intersectionRatio : 0
      }
      update()
    },
    { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
  )
  for (const s of slots) {
    near.observe(s.root)
    seen.observe(s.root)
  }

  for (const q of [
    ...DESKTOP,
    TOUCH,
    NO_DATA,
    NO_MOTION,
    "(any-hover: hover)",
    "(any-pointer: fine)",
    "(orientation: portrait)",
  ])
    matchMedia(q).addEventListener("change", update)
  ;(navigator as Nav).connection?.addEventListener?.("change", update)

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
