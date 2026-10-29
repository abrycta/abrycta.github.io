/**
 * Live embeds (CLAUDE.md rule 6b, LIVE-EMBEDS-PLAN.md): a live project's picture is only its app's /embed page in
 * an iframe, on every device; there is no screenshot. ProjectPicture.astro renders the slot (a quiet placeholder in
 * the picture's exact 16:10 box) and this script fills it.
 *
 * - Loading: every embed starts as the page loads, with no lazy loading and no near-the-view wait (Save-Data, low
 *   memory and reduced motion included), and is never unloaded. Why the script creates the iframe rather than the
 *   HTML holding one: the iframe's URL carries the pixel ratio (`pr`) and `paused=1`, and its size depends on the
 *   mode, all known only here; an iframe in the HTML would load once at the wrong size (the compact layout and
 *   its data pack on a desktop) and then again. This module runs as soon as the HTML is parsed, so the frame
 *   starts as early as a markup iframe would. Without JavaScript, the <noscript> iframe in the slot takes over.
 * - Two modes, never by user-agent:
 *   - desktop (`(min-width: 768px)` and `(hover: hover) and (pointer: fine)`): the app at its fixed desktop
 *     frame (e.g. 1440×900), CSS-scaled to the slot;
 *   - compact (everything else: phones, touch tablets, narrow windows): the iframe at the slot's real size, and
 *     the app lays itself out for it (map over a short caption), never a scaled-down desktop view.
 *   A mode change (resize, rotation, input) resizes the same iframe; the app re-lays itself out. The slot's size
 *   never changes: the iframe sits in an absolute shell inside it.
 * - Motion: the frame starts still (`?paused=1`) and is told `akari:embed-resume` / `akari:embed-pause` (to its
 *   origin only). It moves only while in view; on touch devices and in compact mode only one moves at a time,
 *   the most visible (iOS Safari kills tabs that drive several WebGL maps). Reduced motion is the apps' own
 *   still view (no tour, no particles), from the media query inside the frame. Hidden tabs pause themselves.
 * - Touch never goes to the frame (`pointer-events: none` for coarse pointers, global.css): the page always scrolls.
 * - The placeholder stays until the app posts `akari:embed-ready` (checked: the frame's own window and the app's
 *   origin), then the frame cross-fades in (instantly with reduced motion).
 * - Theme bridge: the shared krtmtthw.dev cookie already reaches the iframe; on every theme-store write here
 *   (Akari's `themestorechange`) the iframe is told to re-read it.
 */
import { readStored, THEME_STORE_EVENT } from "@abrycta/akari/react"

const DESKTOP = ["(min-width: 768px)", "(hover: hover) and (pointer: fine)"]
const TOUCH = "(any-pointer: coarse)"
const STORE = { sharedCookieDomain: "krtmtthw.dev" }

type Mode = "desktop" | "compact"

interface Slot {
  root: HTMLElement
  origin: string
  width: number
  height: number
  frame: HTMLIFrameElement
  shell: HTMLElement
  mode: Mode
  ready: boolean
  /** How much of it is in the view (0-1). */
  ratio: number
  /** Whether it should move now, and what it was last told (null: nothing yet). */
  playing: boolean
  told: boolean | null
}

const modeNow = (): Mode => (DESKTOP.every((q) => matchMedia(q).matches) ? "desktop" : "compact")
/** Touch devices and compact mode let one embed move at a time. */
const oneAtATime = () => modeNow() === "compact" || matchMedia(TOUCH).matches

function slotSize(slot: Pick<Slot, "shell">): [number, number] {
  return [slot.shell.clientWidth, slot.shell.clientHeight]
}

function post(slot: Slot, msg: unknown) {
  if (slot.ready) slot.frame.contentWindow?.postMessage(msg, slot.origin)
}

function postTheme(slot: Slot) {
  const { theme, contrast } = readStored(STORE)
  post(slot, { type: "akari:theme", theme, contrast })
}

function postMotion(slot: Slot) {
  if (!slot.ready || slot.told === slot.playing) return
  slot.told = slot.playing
  slot.root.dataset.embedMotion = slot.playing ? "playing" : "paused"
  post(slot, { type: slot.playing ? "akari:embed-resume" : "akari:embed-pause" })
}

function layout(slot: Slot) {
  const { frame } = slot
  slot.shell.dataset.mode = slot.mode
  const [w, h] = slotSize(slot)
  if (slot.mode === "compact") {
    // The real size: the app lays out for it (rotation and resizes reflow it, never scale it).
    if (w > 0 && frame.width !== String(w)) frame.width = String(w)
    if (h > 0 && frame.height !== String(h)) frame.height = String(h)
    frame.style.transform = ""
    return
  }
  if (frame.width !== String(slot.width)) frame.width = String(slot.width)
  if (frame.height !== String(slot.height)) frame.height = String(slot.height)
  const scale = w > 0 ? w / slot.width : 1
  frame.style.transform = `scale(${scale})`
  post(slot, { type: "akari:embed-scale", scale })
}

function mount(root: HTMLElement): Slot {
  const src = root.dataset.embedSrc!
  const width = Number(root.dataset.embedWidth)
  const height = Number(root.dataset.embedHeight)
  const mode = modeNow()
  const shell = document.createElement("div")
  shell.className = "live-embed-shell"
  shell.dataset.state = "loading"
  root.append(shell) // first, so the shell's size is known below
  const [w, h] = slotSize({ shell })
  // Device pixels for the map canvas: desktop, enough for the scaled-down frame; compact, the screen's, at most 2.
  const pr =
    mode === "desktop"
      ? Math.min(2, Math.max(0.5, Math.ceil(((w / width) * devicePixelRatio) / 0.25) * 0.25))
      : Math.min(2, Math.max(1, Math.round(devicePixelRatio * 4) / 4))
  const url = new URL(src)
  url.searchParams.set("lang", "en")
  url.searchParams.set("pr", String(pr))
  url.searchParams.set("paused", "1")
  const frame = document.createElement("iframe")
  frame.src = url.href
  frame.title = root.dataset.embedTitle!
  frame.width = String(mode === "desktop" ? width : w)
  frame.height = String(mode === "desktop" ? height : h)
  frame.referrerPolicy = "strict-origin-when-cross-origin"
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups")
  frame.setAttribute("aria-describedby", root.dataset.embedDescribedby!)
  frame.dataset.akariEmbed = ""
  shell.append(frame)
  const slot: Slot = {
    root,
    origin: url.origin,
    width,
    height,
    frame,
    shell,
    mode,
    ready: false,
    ratio: 0,
    playing: false,
    told: null,
  }
  layout(slot)
  return slot
}

function init() {
  const roots = [...document.querySelectorAll<HTMLElement>("[data-live-embed]")]
  if (!roots.length) return
  const slots = roots.map(mount)

  const update = () => {
    const mode = modeNow()
    for (const s of slots)
      if (s.mode !== mode) {
        s.mode = mode
        layout(s)
      }
    if (!oneAtATime()) {
      for (const s of slots) s.playing = s.ratio > 0
    } else {
      // One at a time: the most visible slot; the moving one keeps going unless another is clearly more in view.
      const current = slots.find((s) => s.playing)
      const best = [...slots].sort((a, b) => b.ratio - a.ratio)[0]!
      let pick = best.ratio > 0 ? best : undefined
      if (current && current.ratio > 0 && pick && pick.ratio - current.ratio < 0.25) pick = current
      for (const s of slots) s.playing = s === pick
    }
    slots.forEach(postMotion)
  }

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
  for (const s of slots) seen.observe(s.root)

  for (const q of [...DESKTOP, TOUCH, "(any-hover: hover)", "(any-pointer: fine)", "(orientation: portrait)"])
    matchMedia(q).addEventListener("change", update)

  const ro = new ResizeObserver(() => slots.forEach(layout))
  for (const s of slots) ro.observe(s.root)

  window.addEventListener("message", (e) => {
    const s = slots.find((x) => e.source === x.frame.contentWindow && e.origin === x.origin)
    if (!s || (e.data as { type?: string } | null)?.type !== "akari:embed-ready") return
    s.ready = true
    s.shell.dataset.state = "ready"
    s.root.dataset.embed = "live"
    layout(s)
    postTheme(s)
    postMotion(s)
  })
  window.addEventListener(THEME_STORE_EVENT, () => slots.forEach(postTheme))
  update()
}

init()
