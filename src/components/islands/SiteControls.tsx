import { ContrastToggle, ThemeToggle } from "@abrycta/akari/react"

import { SiteThemeProvider } from "~/lib/theme"

/**
 * Header controls: one light/dark toggle (aria-pressed), then high contrast immediately to its right.
 * Both follow the system until pressed, then remember the choice across *.krtmtthw.dev.
 */
export default function SiteControls() {
  return (
    <SiteThemeProvider>
      <div className="flex items-center gap-2">
        <ThemeToggle variant="compact" />
        <ContrastToggle />
      </div>
    </SiteThemeProvider>
  )
}
