import type { APIRoute } from "astro"

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL("/sitemap-index.xml", site).href
  // The CV PDF carries Kurt's email and phone: keep it out of search results.
  const body = `User-agent: *\nAllow: /\nDisallow: /cv/\n\nSitemap: ${sitemap}\n`
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
