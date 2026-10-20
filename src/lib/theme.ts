/**
 * Theme plumbing shared by every React island.
 *
 * - Colour scheme: Akari's ThemeProvider (next-themes, storage key "theme").
 *   Astro islands are separate React roots, so each one has its own provider;
 *   ThemeSync re-broadcasts changes so every toggle on the page agrees.
 * - Contrast: Akari reads `data-contrast="more" | "normal"` on <html> (absent =
 *   follow `prefers-contrast`). Stored under "contrast".
 * The inline script in BaseLayout applies both before first paint.
 */
import * as React from "react"
import { useTheme } from "@abrycta/akari/react"

export const THEME_KEY = "theme"
export const CONTRAST_KEY = "contrast"

let lastBroadcast: string | undefined

/** Mount inside an Akari ThemeProvider. Keeps all providers on the page in step. */
export function ThemeSync(): null {
  const { theme } = useTheme()
  React.useEffect(() => {
    if (!theme || theme === lastBroadcast) return
    const first = lastBroadcast === undefined
    lastBroadcast = theme
    if (first) return
    // next-themes listens for `storage` events; same-document listeners need a synthetic one.
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY, newValue: theme }))
  }, [theme])
  return null
}

export type ContrastPreference = "system" | "more" | "normal"

function readContrast(): ContrastPreference {
  const v = document.documentElement.dataset.contrast
  return v === "more" || v === "normal" ? v : "system"
}

function subscribeContrast(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-contrast"] })
  const mq = window.matchMedia("(prefers-contrast: more)")
  mq.addEventListener("change", onChange)
  return () => {
    mo.disconnect()
    mq.removeEventListener("change", onChange)
  }
}

const snapshot = () => `${readContrast()}|${window.matchMedia("(prefers-contrast: more)").matches ? 1 : 0}`

/** High-contrast state for the whole document. `active` is what is currently applied. */
export function useContrast(): {
  preference: ContrastPreference
  active: boolean
  setPreference: (p: ContrastPreference) => void
} {
  const snap = React.useSyncExternalStore(subscribeContrast, snapshot, () => "system|0")
  const [preference, media] = snap.split("|") as [ContrastPreference, string]
  const active = preference === "more" || (preference === "system" && media === "1")
  const setPreference = React.useCallback((p: ContrastPreference) => {
    const root = document.documentElement
    if (p === "system") delete root.dataset.contrast
    else root.dataset.contrast = p
    try {
      if (p === "system") localStorage.removeItem(CONTRAST_KEY)
      else localStorage.setItem(CONTRAST_KEY, p)
    } catch {
      /* storage unavailable */
    }
  }, [])
  return { preference, active, setPreference }
}

/**
 * Akari's LangProvider mirrors the demo language onto <html lang>. The site is
 * English-only, so the LangSwitch demo keeps the document language at "en"
 * (the demo region carries its own lang attribute instead).
 */
export function useKeepDocumentLang(lang = "en"): void {
  React.useEffect(() => {
    const root = document.documentElement
    const fix = () => {
      if (root.lang !== lang) root.lang = lang
    }
    fix()
    const mo = new MutationObserver(fix)
    mo.observe(root, { attributes: true, attributeFilter: ["lang"] })
    return () => mo.disconnect()
  }, [lang])
}

/** Inline, render-blocking script for <head>: applies stored preferences before first paint. */
export const PRE_PAINT_SCRIPT = `(()=>{try{var d=document.documentElement,t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark"){d.dataset.theme=t;d.classList.add(t);d.style.colorScheme=t}var c=localStorage.getItem("${CONTRAST_KEY}");if(c==="more"||c==="normal")d.dataset.contrast=c}catch(e){}})()`
