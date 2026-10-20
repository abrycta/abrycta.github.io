export const SITE = {
  /** Shown in the header and as the site name. Never the full name (owner's choice). */
  name: "KMN",
  author: "Kurt Matthew Nudo",
  tagline: "Software engineer",
  year: 2026,
} as const

export const NAV = [
  { href: "/projects/", label: "Projects" },
  { href: "/akari/", label: "Akari" },
] as const
