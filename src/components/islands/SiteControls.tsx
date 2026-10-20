import { ContrastToggle, ThemeToggle } from "@abrycta/akari/react"

import { SiteThemeProvider } from "~/lib/theme"

/**
 * Header controls, as in Typhoon Replay: high contrast, then one light/dark toggle (aria-pressed).
 * Both follow the system until pressed, then remember the choice across *.krtmtthw.dev.
 */
export default function SiteControls() {
  return (
    <SiteThemeProvider>
      <div className="flex items-center gap-2">
        <ContrastToggle />
        <ThemeToggle variant="compact" />
      </div>
    </SiteThemeProvider>
  )
}
