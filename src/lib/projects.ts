import { getCollection, type CollectionEntry } from "astro:content"

import { fillDataVersion, fillStoryCount, liveDataVersion, liveStoryCount } from "~/lib/live-facts"

export type Project = CollectionEntry<"projects">

export async function getProjects(): Promise<Project[]> {
  const all = await getCollection("projects")
  const filled = await Promise.all(all.map(withLiveFacts))
  return filled.sort((a, b) => a.data.order - b.data.order)
}

/** `{dataVersion}` and `{storyCount}` in the "So far" fact come from the project's live data (src/lib/live-facts.ts). */
async function withLiveFacts(p: Project): Promise<Project> {
  const url = p.data.dataVersionUrl
  if (!url) return p
  const [version, stories] = await Promise.all([liveDataVersion(url), liveStoryCount(url)])
  const soFar = fillStoryCount(fillDataVersion(p.data.facts.soFar, version), stories)
  return { ...p, data: { ...p.data, facts: { ...p.data.facts, soFar } } }
}
