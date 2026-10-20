/**
 * The project page standard (../PROJECT-PAGES.md in the workspace), shared by
 * the content schema (src/content.config.ts) and the page checker
 * (scripts/check-project-pages.mjs). No imports: Node runs this file directly.
 */

/** Project status. It must be true today. */
export const STATUSES = ["Live", "Active", "In development", "Planned"] as const

/** The four required H2 sections of every project page, in this order. */
export const SECTIONS = ["Problem", "Approach", "Architecture", "Where it stands"] as const

/** Maximum length of the front matter `description` (SEO and Open Graph). */
export const DESCRIPTION_MAX = 170

/**
 * The three facts every project states, in this order, as `facts.<key>` in its front matter.
 * The home row and the project page's "At a glance" both show them with these labels.
 */
export const FACTS = [
  { key: "data", label: "Data" },
  { key: "languages", label: "Languages" },
  { key: "soFar", label: "So far" },
] as const
