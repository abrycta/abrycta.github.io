import * as React from "react"
import { Sparkline, StatCard, ToggleGroup, ToggleGroupItem } from "@abrycta/akari/react"

// Illustrative numbers only, to show the components; not project results.
const SERIES = {
  rising: { label: "Rising", values: [3.1, 3.4, 3.6, 3.9, 4.0, 4.4, 4.7, 4.9, 4.2, 4.6, 5.1, 5.4, 5.6] },
  flat: { label: "Flat", values: [4.2, 4.3, 4.1, 4.4, 4.2, 4.3, 4.5, 4.2, 4.3, 4.4, 4.3, 4.2, 4.4] },
  falling: { label: "Falling", values: [5.6, 5.5, 5.1, 5.2, 4.8, 4.6, 4.7, 4.3, 4.1, 3.9, 3.8, 3.5, 3.4] },
} as const
type Key = keyof typeof SERIES

/** Home-page teaser: Akari ToggleGroup driving a StatCard + Sparkline. */
export default function AkariTeaser() {
  const [key, setKey] = React.useState<Key>("rising")
  const s = SERIES[key]
  const first = s.values[0]
  const last = s.values[s.values.length - 1]
  const delta = last - first
  return (
    <div className="grid gap-4">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        value={key}
        onValueChange={(v) => v && setKey(v as Key)}
        aria-label="Example series"
      >
        {(Object.keys(SERIES) as Key[]).map((k) => (
          <ToggleGroupItem key={k} value={k} className="px-3">
            {SERIES[k].label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <StatCard
        label="Example index, 13 periods (illustrative)"
        value={last.toFixed(1)}
        unit="pts"
        detail={`${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)} since period 1`}
      >
        <Sparkline
          values={s.values}
          domain={[2.8, 5.8]}
          label={`${s.label} example series, from ${first} to ${last}`}
        />
      </StatCard>
    </div>
  )
}
