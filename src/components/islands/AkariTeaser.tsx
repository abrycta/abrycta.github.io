import * as React from "react"
import {
  LegendSwatch,
  MapLegendKey,
  Slider,
  SourceBadge,
  Sparkline,
  StatCard,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
} from "@abrycta/akari/react"

// Illustrative numbers only, to show the components; not project results.
const SERIES = {
  rising: { label: "Rising", values: [3.1, 3.4, 3.6, 3.9, 4.0, 4.4, 4.7, 4.9, 4.2, 4.6, 5.1, 5.4, 5.6] },
  flat: { label: "Flat", values: [4.2, 4.3, 4.1, 4.4, 4.2, 4.3, 4.5, 4.2, 4.3, 4.4, 4.3, 4.2, 4.4] },
  falling: { label: "Falling", values: [5.6, 5.5, 5.1, 5.2, 4.8, 4.6, 4.7, 4.3, 4.1, 3.9, 3.8, 3.5, 3.4] },
} as const
type Key = keyof typeof SERIES

// Official figures every fourth period; the estimate fills the gaps, less certain further from one.
const OFFICIAL_AT = [0, 4, 8, 12]
const OFFICIAL_SHIFT = [0.1, -0.15, 0.2, -0.1]
const PERIODS = Array.from({ length: 13 }, (_, i) => `period ${i + 1}`)

// Distance (in periods) to the nearest official figure: 0 official, 1 less certain, 2 least certain.
const DISTANCE = PERIODS.map((_, i) => Math.min(...OFFICIAL_AT.map((o) => Math.abs(i - o))))
const SEQ = ["seq-1", "seq-2", "seq-3", "seq-4", "seq-5"]
const bucket = (v: number) => SEQ[Math.max(0, Math.min(4, Math.floor((v - 3) / 0.6)))]

function ranges(values: readonly number[]) {
  const spread = values.map((_, i) => 0.12 + 0.11 * Math.min(...OFFICIAL_AT.map((o) => Math.abs(i - o))))
  const band = (k: number, label: string) => ({
    label,
    lo: values.map((v, i) => v - k * spread[i]),
    hi: values.map((v, i) => v + k * spread[i]),
  })
  return [band(2, "90 %"), band(1, "50 %")]
}

/** Home-page teaser: Akari controls driving a StatCard with an estimate line, ranges, official dots and source badges. */
export default function AkariTeaser() {
  const [key, setKey] = React.useState<Key>("rising")
  const [showRanges, setShowRanges] = React.useState(true)
  const [period, setPeriod] = React.useState(12)
  const s = SERIES[key]
  const first = s.values[0]
  const last = s.values[s.values.length - 1]
  const current = s.values[period]
  const delta = current - first
  const observations = OFFICIAL_AT.map((index, n) => {
    const value = Math.round((s.values[index] + OFFICIAL_SHIFT[n]) * 10) / 10
    return { index, value, lo: value - 0.15, hi: value + 0.15 }
  })
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <Toggle variant="outline" size="sm" pressed={showRanges} onPressedChange={setShowRanges} className="px-3">
          Ranges
        </Toggle>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <StatCard
          label={`Example index, period ${period + 1} of 13 (illustrative)`}
          value={current.toFixed(1)}
          unit="pts"
          detail={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{`${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)} since period 1`}</span>
              {DISTANCE[period] === 0 ? <SourceBadge source="official" /> : <SourceBadge source="estimate" />}
            </span>
          }
        >
          <Sparkline
            values={s.values}
            domain={[2.2, 6.6]}
            dashed
            bands={showRanges ? ranges(s.values) : undefined}
            observations={observations}
            xLabels={PERIODS}
            observationsLabel="Official"
            height={56}
            label={`${s.label} example series, estimated from ${first} to ${last}`}
          />
        </StatCard>
        <div className="grid content-start gap-3 rounded-md border bg-background p-3">
          <p className="m-0 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
            Same series as map tiles
          </p>
          <div className="grid max-w-[22rem] grid-cols-7 gap-1" aria-hidden="true">
            {s.values.map((v, i) => (
              <LegendSwatch
                key={i}
                fill={bucket(v)}
                opacity={DISTANCE[i] === 0 ? 1 : 0.65}
                hatch={!showRanges || DISTANCE[i] === 0 ? undefined : DISTANCE[i] === 1 ? "sparse" : "dense"}
                className={`aspect-square h-auto w-full rounded-[2px] ${i === period ? "outline-2 outline-offset-1 outline-foreground" : ""}`}
              />
            ))}
          </div>
          <MapLegendKey
            className="text-xs"
            items={[
              { label: "Official", fill: "seq-4" },
              { label: "Model estimate", fill: "seq-4", opacity: 0.65, italic: true },
              ...(showRanges
                ? [
                    { label: "Less certain", fill: "none", hatch: "sparse" as const },
                    { label: "Least certain", fill: "none", hatch: "dense" as const },
                  ]
                : []),
            ]}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">Period</span>
        <Slider
          min={0}
          max={12}
          step={1}
          value={[period]}
          onValueChange={([v]) => setPeriod(v)}
          role="group"
          aria-label="Period"
        />
        <span className="font-mono text-xs whitespace-nowrap tabular-nums">{period + 1} / 13</span>
      </div>
    </div>
  )
}
