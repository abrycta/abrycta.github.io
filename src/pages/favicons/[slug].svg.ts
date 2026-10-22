import type { APIRoute, GetStaticPaths } from "astro"

import { getProjects } from "~/lib/projects"

// Each project page uses its own kanji as the favicon, in the site's seal style (public/favicon.svg).
// Multi-character glyphs use their first character, which is what the app's header shows.
export const getStaticPaths = (async () => {
  const projects = await getProjects()
  return projects
    .filter((project) => project.data.glyph)
    .map((project) => ({ params: { slug: project.id }, props: { glyph: [...project.data.glyph!][0] } }))
}) satisfies GetStaticPaths

export const GET: APIRoute = ({ props }) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
  <style>
    .s { color: #c4532f; }
    @media (prefers-color-scheme: dark) { .s { color: #e47a57; } }
  </style>
  <g class="s">
    <rect x="3" y="3" width="46" height="46" rx="6" fill="none" stroke="currentColor" stroke-width="4"/>
    <text x="26" y="36.5" text-anchor="middle" font-family="'Shippori Mincho B1', 'Hiragino Mincho ProN', 'Yu Mincho', serif" font-weight="700" font-size="28" fill="currentColor">${props.glyph}</text>
  </g>
</svg>
`
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } })
}
