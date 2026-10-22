export const SITE = {
  /** Shown in the header (beside the カ seal) and as the site name. */
  name: "Kurt Matthew Nudo",
  author: "Kurt Matthew Nudo",
  tagline: "Full-stack developer",
  year: 2026,
} as const

/** Header nav: anchors to the home page's sections (they work from every page), then the About page. */
export const NAV = [
  { href: "/#projects", label: "Projects" },
  { href: "/#practice", label: "Practice" },
  { href: "/#toolbox", label: "Toolbox" },
  { href: "/about/", label: "About" },
] as const

/** Public profiles: the site's contact routes (linked in the header and the hero). */
export const GITHUB = { handle: "abrycta", url: "https://github.com/abrycta" } as const
export const LINKEDIN = { url: "https://www.linkedin.com/in/kurtmtthw/" } as const

/** The public CV PDF (public/cv/), rendered without email or phone from the CV source (portfolio-docs cv/cv.html). */
export const CV = { href: "/cv/kurt-matthew-nudo-cv.pdf", filename: "kurt-matthew-nudo-cv.pdf" } as const

/** The full CV with contact details: served only by the cv.krtmtthw.dev gate (Turnstile, then a short-lived signed link). */
export const CV_FULL = { href: "https://cv.krtmtthw.dev/" } as const
