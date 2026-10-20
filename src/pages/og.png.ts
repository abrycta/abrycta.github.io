import type { APIRoute } from "astro"
import { color } from "@abrycta/akari/tokens"
import sharp from "sharp"

import { SITE } from "~/lib/site"

/** 1200×630 Open Graph card, rendered once at build time from Akari's light-theme tokens. */
export const GET: APIRoute = async () => {
  const c = color.light
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${c.bg}"/>
  <rect x="96" y="96" width="72" height="72" rx="8" fill="none" stroke="${c.accent}" stroke-width="4"/>
  <text x="200" y="152" font-family="Georgia, 'Times New Roman', serif" font-size="56" font-weight="600" fill="${c.text}">${SITE.name}</text>
  <text x="96" y="420" font-family="Georgia, 'Times New Roman', serif" font-size="72" font-weight="600" fill="${c.text}">Quiet tools that make</text>
  <text x="96" y="500" font-family="Georgia, 'Times New Roman', serif" font-size="72" font-weight="600" fill="${c.text}">data legible.</text>
  <rect x="96" y="548" width="160" height="4" fill="${c.primary}"/>
  </svg>`
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } })
}
