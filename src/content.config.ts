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
    stack: z.array(z.string()),
    links: z.object({ repo: link, demo: link }),
    updated: z.coerce.date(),
  }),
})

export const collections = { projects }
