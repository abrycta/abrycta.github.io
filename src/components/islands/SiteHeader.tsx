import { Header } from "@abrycta/akari/react"

import { GITHUB, LINKEDIN, NAV, SITE } from "~/lib/site"
import { SiteThemeProvider } from "~/lib/theme"

/**
 * Akari's Header, the same menu bar as every *.krtmtthw.dev app: data only, no site styling.
 * Server-rendered, then hydrated for the built-in theme and contrast toggles.
 */
export default function SiteHeader({ path }: { path: string }) {
  return (
    <SiteThemeProvider>
      <Header
        brand={{ name: SITE.name, glyph: "カ", href: "/" }}
        tagline={`${SITE.tagline} · Makati`}
        links={[
          { href: GITHUB.url, label: "GitHub" },
          { href: LINKEDIN.url, label: "LinkedIn" },
        ]}
        nav={NAV.map((item) => ({ ...item, current: item.href === path }))}
      />
    </SiteThemeProvider>
  )
}
