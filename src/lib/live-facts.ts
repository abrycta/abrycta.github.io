/**
 * Facts read from a project's live data at build time, so a project page never states an old data version.
 * A project opts in with `dataVersionUrl` (its live `latest.json` pointer) and writes `{dataVersion}` or
 * `{storyCount}` in a fact; in the page body, <LiveStoryCount> shows the same story count.
 * The site CI runs daily as well as on push, so a new data version reaches the page within a day.
 */

const TOKEN = "{dataVersion}"
const STORIES = "{storyCount}"
const cache = new Map<string, Promise<string | undefined>>()
const storyCache = new Map<string, Promise<number | undefined>>()

/**
 * The number of public stories in the live data version: the entries of `<base>/stories.json` that are not
 * drafts (drafts only show with the app's preview link). Undefined when it can't be read.
 */
export function liveStoryCount(url: string): Promise<number | undefined> {
  let p = storyCache.get(url)
  if (!p) {
    p = (async () => {
      const ptr = (await (await fetch(url, { signal: AbortSignal.timeout(10_000) })).json()) as { base?: unknown }
      if (typeof ptr.base !== "string") return undefined
      const r = await fetch(new URL(`${ptr.base}stories.json`, url), { signal: AbortSignal.timeout(10_000) })
      if (!r.ok) return undefined
      const j = (await r.json()) as { stories?: { status?: string }[] }
      if (!Array.isArray(j.stories)) return undefined
      return j.stories.filter((s) => s.status !== "draft").length
    })().catch(() => undefined)
    storyCache.set(url, p)
  }
  return p
}

/** Fills `{storyCount}` in a fact; without a count, the number is left out ("… and stories"). */
export function fillStoryCount(text: string, count: number | undefined): string {
  if (!text.includes(STORIES)) return text
  return count === undefined
    ? text.replaceAll(`${STORIES} `, "").replaceAll(STORIES, "")
    : text.replaceAll(STORIES, String(count))
}

/** The current version number in a `latest.json` pointer ("v6" → "6"), or undefined when it can't be read. */
export function liveDataVersion(url: string): Promise<string | undefined> {
  let p = cache.get(url)
  if (!p) {
    p = fetch(url, { signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? r.json() : undefined))
      .then((j: { current?: unknown; version?: unknown } | undefined) => {
        const v = String(j?.current ?? j?.version ?? "").replace(/^v/, "")
        return /^\d+$/.test(v) ? v : undefined
      })
      .catch(() => undefined)
    cache.set(url, p)
  }
  return p
}

/**
 * Fills `{dataVersion}` in a fact. Without a version, the "; "-separated clause that holds the token is left out,
 * so the page never shows a wrong number and the build never fails because a data host is down.
 */
export function fillDataVersion(text: string, version: string | undefined): string {
  if (!text.includes(TOKEN)) return text
  if (version) return text.replaceAll(TOKEN, version)
  return text
    .split("; ")
    .filter((clause) => !clause.includes(TOKEN))
    .join("; ")
}
