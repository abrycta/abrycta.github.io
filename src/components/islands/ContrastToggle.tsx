import { ContrastIcon } from "lucide-react"
import { Toggle } from "@abrycta/akari/react"

import { useContrast } from "~/lib/theme"

/** One-button high-contrast switch (Akari Toggle, aria-pressed). */
export function ContrastToggle({ className }: { className?: string }) {
  const { active, setPreference } = useContrast()
  return (
    <Toggle
      size="sm"
      variant="outline"
      pressed={active}
      onPressedChange={(p) => setPreference(p ? "more" : "normal")}
      aria-label="High contrast"
      title="High contrast"
      className={className}
    >
      <ContrastIcon />
    </Toggle>
  )
}
