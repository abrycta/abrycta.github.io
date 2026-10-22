import type { APIRoute } from "astro"

// Same list in every portfolio app's robots.txt (Replay, Lights, Plumes).
const AI_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "PerplexityBot",
  "Bytespider",
  "meta-externalagent",
  "Amazonbot",
  "cohere-ai",
  "Diffbot",
  "Omgilibot",
  "Timpibot",
  "ImagesiftBot",
]

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL("/sitemap-index.xml", site).href
  // The CV PDF carries Kurt's email and phone: keep it out of search results.
  const body =
    `User-agent: *\nAllow: /\nDisallow: /cv/\n\n` +
    `# AI training and answer-engine crawlers: not allowed anywhere.\n` +
    AI_CRAWLERS.map((ua) => `User-agent: ${ua}\n`).join("") +
    `Disallow: /\n\nSitemap: ${sitemap}\n`
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
