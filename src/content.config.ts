import { glob } from "astro/loaders"
import { defineCollection } from "astro:content"
import { z } from "astro/zod"

import { DESCRIPTION_MAX, STATUSES } from "~/lib/project-pages"

export { STATUSES }

const link = z.object({
  label: z.string(),
  /** Omit while the link doesn't exist yet: it renders as "coming soon". */
  href: z.string().optional(),
})

const projects = defineCollection({
  // Files starting with "_" (the template, _TEMPLATE.mdx.example) are never loaded.
  loader: glob({ pattern: "**/[^_]*.mdx", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    /** Japanese name, shown as a typographic accent (lang="ja"). */
    titleJa: z.string().optional(),
    summary: z.string(),
    description: z.string().max(DESCRIPTION_MAX),
    status: z.enum(STATUSES),
    order: z.number(),
    featured: z.boolean().default(false),
    /**
     * The same three facts for every project, shown on the home row and the project page alike.
     * Use " · " between items; Japanese text is marked lang="ja" automatically.
     */
    facts: z.object({
      /** The main data sources, e.g. "IBTrACS best tracks · ERA5 reanalysis". */
      data: z.string(),
      /** The app's languages, e.g. "English · 日本語". */
      languages: z.string(),
      /** Honest progress in one line, true today. */
      soFar: z.string(),
    }),
    /** Large muted glyph on the placeholder picture, until there is a screenshot. Defaults to the title. */
    glyph: z.string().optional(),
    stack: z.array(z.string()),
    links: z.object({ repo: link, demo: link }),
    updated: z.coerce.date(),
  }),
})

export const collections = { projects }
