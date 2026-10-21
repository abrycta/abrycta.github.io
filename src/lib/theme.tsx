/**
 * Theme plumbing shared by every React island.
 *
 * Akari's theme store keeps light/dark and high contrast in first-party cookies on krtmtthw.dev, so the
 * choice is shared with every *.krtmtthw.dev app (Replay included); other hosts (localhost,
 * previews) use localStorage. /theme-init.js (Akari's, copied into the build by the
 * integration in astro.config.mjs) applies it before first paint. Astro islands are separate React roots;
 * Akari's providers follow each other through the store's change event.
 */
import * as React from "react"
import { ThemeProvider } from "@abrycta/akari/react"

export const THEME_COOKIE_DOMAIN = "krtmtthw.dev"

/** Akari ThemeProvider configured for this site (shared cookie; theme-init.js instead of an inline script). */
export function SiteThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider sharedCookieDomain={THEME_COOKIE_DOMAIN} inlineScript={false}>
      {children}
    </ThemeProvider>
  )
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
