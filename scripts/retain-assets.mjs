// Keep older hashed assets (/_astro/*) available after a deploy.
//
// GitHub Pages lets browsers cache HTML for 10 minutes and replaces the whole site on every deploy. A page
// cached just before a deploy would then ask for stylesheets and scripts that no longer exist, and render
// unstyled. This step, run after `astro build` and before the Pages upload:
//   1. downloads every /_astro/ file the live pages reference right now (the previous deploy);
//   2. adds files kept from earlier deploys (a rolling store restored from the Actions cache), up to MAX_AGE_DAYS;
//   3. writes the merged set back to the store for the next deploy.
// New files always win; old ones are only added where the name is free (names are content hashes).
//
// Usage: node scripts/retain-assets.mjs <dist> <store> <site-origin>
import { existsSync } from "node:fs"
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { join, relative } from "node:path"

const [dist = "dist", store = ".asset-store", origin = "https://krtmtthw.dev"] = process.argv.slice(2)
const MAX_AGE_DAYS = 3
const now = Date.now()
const assetsDir = join(dist, "_astro")
const storeAssets = join(store, "_astro")
const manifestPath = join(store, "manifest.json")

async function walk(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(p)))
    else out.push(p)
  }
  return out
}

await mkdir(storeAssets, { recursive: true })
const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, "utf8")) : {}
const fresh = new Set((await readdir(assetsDir)).filter((f) => !f.startsWith(".")))
let fromLive = 0
let fromStore = 0

// 1. What the live site references now.
const pages = (await walk(dist))
  .filter((p) => p.endsWith(".html"))
  .map((p) => "/" + relative(dist, p).replace(/index\.html$/, ""))
const referenced = new Set()
for (const page of pages) {
  try {
    const res = await fetch(origin + page, { redirect: "follow" })
    if (!res.ok) continue
    for (const m of (await res.text()).matchAll(/\/_astro\/([A-Za-z0-9_.-]+)/g)) referenced.add(m[1])
  } catch {
    // The live site being unreachable must never block a deploy.
  }
}
for (const name of referenced) {
  if (fresh.has(name) || existsSync(join(storeAssets, name))) continue
  try {
    const res = await fetch(`${origin}/_astro/${name}`)
    if (!res.ok) continue
    await writeFile(join(storeAssets, name), Buffer.from(await res.arrayBuffer()))
    manifest[name] ??= now
    fromLive++
  } catch {
    // Best effort.
  }
}

// 2. Add stored files (young enough) that the new build does not have; drop old ones from the store.
const kept = {}
for (const name of await readdir(storeAssets)) {
  const seen = manifest[name] ?? now
  if (now - seen > MAX_AGE_DAYS * 86_400_000) {
    await rm(join(storeAssets, name))
    continue
  }
  kept[name] = seen
  if (!fresh.has(name)) {
    await copyFile(join(storeAssets, name), join(assetsDir, name))
    fromStore++
  }
}

// 3. The new build's files join the store for next time.
for (const name of fresh) {
  await copyFile(join(assetsDir, name), join(storeAssets, name))
  kept[name] ??= now
}
await writeFile(manifestPath, JSON.stringify(kept))
console.log(
  `retain-assets: ${fresh.size} new, ${fromLive} fetched from the live site, ${fromStore} kept from earlier deploys`,
)
