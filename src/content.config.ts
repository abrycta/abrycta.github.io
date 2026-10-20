import { glob } from "astro/loaders"
import { defineCollection } from "astro:content"
import { z } from "astro/zod"

export const STATUSES = ["Active", "In development", "Planned"] as const

const link = z.object({
  label: z.string(),
  /** Omit while the link doesn't exist yet: it renders as "coming soon". */
  href: z.string().optional(),
})

const projects = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    /** Japanese name, shown as a typographic accent (lang="ja"). */
    titleJa: z.string().optional(),
    summary: z.string(),
    description: z.string().max(170),
    status: z.enum(STATUSES),
    order: z.number(),
    featured: z.boolean().default(false),
    stack: z.array(z.string()),
    links: z.object({ repo: link, demo: link }),
    updated: z.coerce.date(),
  }),
})

export const collections = { projects }
