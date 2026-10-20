#!/usr/bin/env node
// Checks every project page against the standard (PROJECT-PAGES.md in the
// workspace; template: src/content/projects/_TEMPLATE.mdx.example):
//   - front matter: a valid `status`, a one-line `description` of at most 170 characters, and the
//     same three `facts` (data, languages, soFar) as every other project;
//   - body: exactly the H2 sections Problem, Approach, Architecture, Where it stands, in order;
//   - a <FlowDiagram> inside the Architecture section.
// The content schema also checks the front matter at build time; this script
// runs first, without a build, and names the file and the problem.
//
// Usage: node scripts/check-project-pages.mjs [file ...]   (default: every page plus the template)
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { DESCRIPTION_MAX, FACTS, SECTIONS, STATUSES } from "../src/lib/project-pages.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dir = join(root, "src/content/projects")
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(dir)
      .filter((f) => f.endsWith(".mdx") || f === "_TEMPLATE.mdx.example")
      .sort()
      .map((f) => join(dir, f))

/** Problems found in one page's source text. */
function checkPage(text) {
  const problems = []
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!fm) return ["no front matter (a --- block at the top)"]
  const field = (name) => new RegExp(`^${name}:[ \\t]*(.*)$`, "m").exec(fm[1])?.[1].trim()
  const unquote = (v) => v?.replace(/^(["'])(.*)\1$/, "$2")

  const status = unquote(field("status"))
  if (!status) problems.push("front matter: `status` is missing")
  else if (!STATUSES.includes(status))
    problems.push(`front matter: status "${status}" is not one of ${STATUSES.map((s) => `"${s}"`).join(", ")}`)

  const description = unquote(field("description"))
  if (!description) problems.push("front matter: `description` is missing (it must be on one line)")
  else if (description.length > DESCRIPTION_MAX)
    problems.push(`front matter: description is ${description.length} characters (max ${DESCRIPTION_MAX})`)

  // facts: an indented block with exactly the shared keys, each on one line.
  const factsBlock = /^facts:[ \t]*\n((?:[ \t]+.*\n?)*)/m.exec(fm[1])
  if (!factsBlock) problems.push(`front matter: \`facts\` is missing (${FACTS.map((f) => f.key).join(", ")})`)
  else {
    const keys = [...factsBlock[1].matchAll(/^[ \t]+([A-Za-z]+):[ \t]*(.*)$/gm)]
    for (const f of FACTS) {
      const hit = keys.find((k) => k[1] === f.key)
      if (!hit || !unquote(hit[2].trim()))
        problems.push(`front matter: facts.${f.key} ("${f.label}") is missing or empty`)
    }
    for (const k of keys)
      if (!FACTS.some((f) => f.key === k[1]))
        problems.push(`front matter: facts.${k[1]} is not a shared fact (only ${FACTS.map((f) => f.key).join(", ")})`)
  }

  // H2 headings outside fenced code blocks.
  const body = text.slice(fm[0].length).replace(/^```[\s\S]*?^```/gm, "")
  const found = [...body.matchAll(/^## +(.+?)\s*$/gm)].map((m) => m[1])
  const missing = SECTIONS.filter((s) => !found.includes(s))
  for (const s of missing) problems.push(`missing section "## ${s}"`)
  const extra = found.filter((s) => !SECTIONS.includes(s))
  for (const s of extra) problems.push(`unexpected section "## ${s}" (only ${SECTIONS.join(", ")} are allowed)`)
  const dupes = SECTIONS.filter((s) => found.filter((f) => f === s).length > 1)
  for (const s of dupes) problems.push(`section "## ${s}" appears more than once`)
  if (!missing.length && !extra.length && !dupes.length && found.join("|") !== SECTIONS.join("|"))
    problems.push(`sections are out of order: found ${found.join(" → ")}, expected ${SECTIONS.join(" → ")}`)

  const arch = /^## +Architecture\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(body)
  if (!/<FlowDiagram[\s>]/.test(body)) problems.push("no <FlowDiagram> (the Architecture section needs one)")
  else if (arch && !/<FlowDiagram[\s>]/.test(arch[1]))
    problems.push("the <FlowDiagram> is not in the Architecture section")
  return problems
}

let failed = 0
for (const file of files) {
  const problems = checkPage(readFileSync(file, "utf8"))
  const rel = relative(root, file)
  const name = rel && !rel.startsWith("..") ? rel : file
  if (problems.length) {
    failed++
    console.error(`✗ ${name}`)
    for (const p of problems) console.error(`    ${p}`)
  } else {
    console.log(`✓ ${name}`)
  }
}
if (failed) {
  console.error(
    `\n${failed} project page(s) do not follow the standard; see src/content/projects/_TEMPLATE.mdx.example.`,
  )
  process.exit(1)
}
