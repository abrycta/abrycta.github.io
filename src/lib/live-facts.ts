/**
 * Facts read from a project's live data at build time, so a project page never states an old data version.
 * A project opts in with `dataVersionUrl` (its live `latest.json` pointer) and writes `{dataVersion}` in a fact.
 * The site CI runs daily as well as on push, so a new data version reaches the page within a day.
 */

const TOKEN = "{dataVersion}"
const cache = new Map<string, Promise<string | undefined>>()

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
