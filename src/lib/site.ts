export const SITE = {
  /** Shown in the header (beside the カ seal) and as the site name. */
  name: "Kurt Matthew Nudo",
  author: "Kurt Matthew Nudo",
  tagline: "Software engineer",
  year: 2026,
} as const

/** Header nav: anchors to the home page's sections (they work from every page). */
export const NAV = [
  { href: "/#projects", label: "Projects" },
  { href: "/#practice", label: "Practice" },
  { href: "/#toolbox", label: "Toolbox" },
] as const

/** Public profiles: the site's contact routes (linked in the header and the hero). */
export const GITHUB = { handle: "abrycta", url: "https://github.com/abrycta" } as const
export const LINKEDIN = { url: "https://www.linkedin.com/in/kurtmtthw/" } as const
