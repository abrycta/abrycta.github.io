import * as React from "react"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  LangProvider,
  LangSwitch,
  MapLegend,
  SealMark,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sparkline,
  StatCard,
  T,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ThemeToggle,
  ToggleGroup,
  ToggleGroupItem,
  formatDate,
  useLang,
} from "@abrycta/akari/react"

import { SiteThemeProvider, useKeepDocumentLang } from "~/lib/theme"

// Illustrative values for the demos only.
const BASINS = { wp: "Western Pacific", ni: "North Indian", sp: "South Pacific" } as const
type Basin = keyof typeof BASINS

const SERIES = [3.1, 3.4, 3.6, 3.9, 4.0, 4.4, 4.7, 4.9, 4.2, 4.6, 5.1, 5.4, 5.6]

function Demo({ title, children, note }: { title: string; children: React.ReactNode; note?: React.ReactNode }) {
  const id = React.useId()
  return (
    <section aria-labelledby={id} className="grid content-start gap-4 rounded-sm border bg-card p-5">
      <h3 id={id} className="font-mono text-[11px] font-normal tracking-[0.08em] text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </section>
  )
}

function LangDemo() {
  const { lang } = useLang()
  return (
    <div className="grid gap-3">
      <LangSwitch />
      <p className="text-sm">
        <T en="Quiet tools that make data legible." ja="データを、静かに読み解く道具。" />
      </p>
      <p className="font-mono text-xs text-muted-foreground">{formatDate("2019-05-01", { lang, era: true })}</p>
    </div>
  )
}

function Gallery() {
  useKeepDocumentLang("en")
  const [view, setView] = React.useState("map")
  const [name, setName] = React.useState("")
  const [basin, setBasin] = React.useState<Basin>("wp")
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Demo title="Button">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="destructive">Delete</Button>
        </div>
      </Demo>

      <Demo title="Input + Select">
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="demo-storm">Storm name</Label>
            <Input id="demo-storm" placeholder="e.g. Haiyan" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="demo-basin">Basin</Label>
            <Select value={basin} onValueChange={(v) => setBasin(v as Basin)}>
              <SelectTrigger id="demo-basin" className="w-full sm:w-56">
                <SelectValue>{BASINS[basin]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BASINS) as Basin[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {BASINS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Demo>

      <Demo title="Tabs">
        <Tabs defaultValue="map">
          <TabsList>
            <TabsTrigger value="map">Map</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="method">Method</TabsTrigger>
          </TabsList>
          <TabsContent value="map" className="pt-3 text-sm text-muted-foreground">
            One idea per screen: the map first.
          </TabsContent>
          <TabsContent value="table" className="pt-3 text-sm text-muted-foreground">
            The same numbers as a table, for screen readers and spreadsheets.
          </TabsContent>
          <TabsContent value="method" className="pt-3 text-sm text-muted-foreground">
            How the numbers were made, and how far to trust them.
          </TabsContent>
        </Tabs>
      </Demo>

      <Demo title="Toggle group" note={`Selected: ${view}`}>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={view}
          onValueChange={(v) => v && setView(v)}
          aria-label="View"
        >
          <ToggleGroupItem value="map" className="px-3">
            Map
          </ToggleGroupItem>
          <ToggleGroupItem value="chart" className="px-3">
            Chart
          </ToggleGroupItem>
          <ToggleGroupItem value="table" className="px-3">
            Table
          </ToggleGroupItem>
        </ToggleGroup>
      </Demo>

      <Demo title="Dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-fit">
              Open dialog
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reanalysis, not observation</DialogTitle>
              <DialogDescription>
                Wind fields come from a ~28 km model grid, which smooths the strongest winds. Use the best-track
                intensity for peak strength.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button>Understood</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Demo>

      <Demo title="Card">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Small-area estimates</CardTitle>
            <CardDescription>Official figures with their confidence intervals.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">Cards hold one idea, with a hairline instead of a heavy shadow.</CardContent>
          <CardFooter>
            <Button size="sm" variant="outline">
              Details
            </Button>
          </CardFooter>
        </Card>
      </Demo>

      <Demo title="StatCard + Sparkline" note="Illustrative values.">
        <StatCard label="Example index, 13 periods" value="5.6" unit="pts" detail="+2.5 since period 1">
          <Sparkline values={SERIES} domain={[2.8, 5.8]} label="Example series rising from 3.1 to 5.6" />
        </StatCard>
      </Demo>

      <Demo title="MapLegend">
        <div className="grid gap-6">
          <MapLegend title="Sequential (illustrative)" labels={["0%", "15%", "30%", "45%", "60%+"]} />
          <MapLegend scale="diverging" title="Diverging (illustrative)" labels={["−3", "0", "+3"]} />
        </div>
      </Demo>

      <Demo title="LangSwitch" note="Akari apps are bilingual; this site is English, so only the demo switches.">
        <LangProvider storageKey={null}>
          <LangDemo />
        </LangProvider>
      </Demo>

      <Demo title="ThemeToggle" note="Segmented and compact variants. Both change the whole page.">
        <div className="flex flex-wrap items-center gap-4">
          <ThemeToggle />
          <ThemeToggle variant="compact" />
        </div>
      </Demo>

      <Demo title="SealMark" note="朱 shu, used once per view.">
        <div className="flex items-end gap-6">
          <SealMark size={20} />
          <SealMark size={32} />
          <SealMark size={52} title="Akari seal" />
        </div>
      </Demo>
    </div>
  )
}

/** Live Akari components for the showcase page (one island). */
export default function AkariGallery() {
  return (
    <SiteThemeProvider>
      <Gallery />
    </SiteThemeProvider>
  )
}
