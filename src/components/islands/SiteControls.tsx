import { ThemeProvider, ThemeToggle } from "@abrycta/akari/react"

import { ThemeSync } from "~/lib/theme"
import { ContrastToggle } from "./ContrastToggle"

/** Header controls: Akari ThemeToggle (system / light / dark) plus high contrast. */
export default function SiteControls() {
  return (
    <ThemeProvider>
      <ThemeSync />
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <ContrastToggle />
      </div>
    </ThemeProvider>
  )
}
