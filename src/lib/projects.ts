import { getCollection, type CollectionEntry } from "astro:content"

import { fillDataVersion, liveDataVersion } from "~/lib/live-facts"

export type Project = CollectionEntry<"projects">

export async function getProjects(): Promise<Project[]> {
  const all = await getCollection("projects")
  const filled = await Promise.all(all.map(withLiveFacts))
  return filled.sort((a, b) => a.data.order - b.data.order)
}

/** `{dataVersion}` in the "So far" fact comes from the project's live data (src/lib/live-facts.ts). */
async function withLiveFacts(p: Project): Promise<Project> {
  const url = p.data.dataVersionUrl
  if (!url) return p
  const soFar = fillDataVersion(p.data.facts.soFar, await liveDataVersion(url))
  return { ...p, data: { ...p.data, facts: { ...p.data.facts, soFar } } }
}
