export const SITE = {
  /** Shown in the header (beside the カ seal) and as the site name. */
  name: "Kurt Matthew Nudo",
  author: "Kurt Matthew Nudo",
  tagline: "Software engineer",
  year: 2026,
} as const

export const NAV = [
  { href: "/projects/", label: "Projects" },
  { href: "/akari/", label: "Akari" },
] as const

/** The public profile, the site's one contact route. */
export const GITHUB = { handle: "abrycta", url: "https://github.com/abrycta" } as const
