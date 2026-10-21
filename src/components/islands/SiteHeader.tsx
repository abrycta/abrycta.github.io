import { Header, useActiveSection } from "@abrycta/akari/react"

import { GITHUB, LINKEDIN, NAV, SITE } from "~/lib/site"
import { SiteThemeProvider } from "~/lib/theme"

/** Home-page sections behind the in-page nav items (/#projects, /#practice, /#toolbox). */
const SECTIONS = ["projects", "practice", "toolbox"]
/** Pages that belong to Projects: the projects index, every project page and the live Akari page. */
const PROJECT_PAGES = ["/projects", "/akari"]

/**
 * Akari's Header, the same menu bar as every *.krtmtthw.dev app: data only, no site styling.
 * Server-rendered with the build-time path (About, Projects), then hydrated for the theme and contrast toggles
 * and, on the home page, the section the reader is in.
 */
export default function SiteHeader({ path }: { path: string }) {
  const section = useActiveSection(path === "/" ? SECTIONS : [])
  return (
    <SiteThemeProvider>
      <Header
        brand={{ name: SITE.name, glyph: "カ", href: "/" }}
        tagline={`${SITE.tagline} · Makati`}
        links={[
          { href: GITHUB.url, label: "GitHub" },
          { href: LINKEDIN.url, label: "LinkedIn" },
        ]}
        nav={NAV.map((item) => (item.href === "/#projects" ? { ...item, also: PROJECT_PAGES } : item))}
        location={{ pathname: path, hash: section ? `#${section}` : "" }}
      />
    </SiteThemeProvider>
  )
}
