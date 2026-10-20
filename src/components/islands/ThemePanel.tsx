import { Label, Switch, ThemeProvider, ThemeToggle } from "@abrycta/akari/react"

import { ThemeSync, useContrast } from "~/lib/theme"

function ContrastSwitch() {
  const { active, preference, setPreference } = useContrast()
  return (
    <div className="flex items-center gap-2">
      <Switch id="hc-switch" checked={active} onCheckedChange={(on) => setPreference(on ? "more" : "normal")} />
      <Label htmlFor="hc-switch">High contrast</Label>
      {preference !== "system" ? (
        <button type="button" className="link ml-1 text-xs" onClick={() => setPreference("system")}>
          Follow system
        </button>
      ) : null}
    </div>
  )
}

/** Showcase theme switch: system / light / dark, plus high contrast. Applies to the whole page. */
export default function ThemePanel() {
  return (
    <ThemeProvider>
      <ThemeSync />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm" aria-hidden="true">
            Theme
          </span>
          <ThemeToggle />
        </div>
        <ContrastSwitch />
      </div>
    </ThemeProvider>
  )
}
