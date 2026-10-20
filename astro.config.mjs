// @ts-check
import mdx from "@astrojs/mdx"
import react from "@astrojs/react"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

// Production origin (GitHub Pages custom domain, see public/CNAME), used for
// canonical URLs, Open Graph URLs, the sitemap and robots.txt. Served from the
// domain root, so there is no `base`. SITE_URL overrides it (e.g. for a preview host).
const site = process.env.SITE_URL ?? "https://krtmtthw.dev"

export default defineConfig({
  site,
  output: "static",
  // GitHub Pages serves /projects/ from projects/index.html (and redirects /projects there).
  trailingSlash: "always",
  build: { format: "directory" },
  integrations: [react(), mdx(), sitemap({ filter: (page) => !page.includes("/404") })],
  prefetch: { prefetchAll: false, defaultStrategy: "hover" },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      // Akari is symlinked (file:../akari) and has its own node_modules; share one React.
      dedupe: ["react", "react-dom", "lucide-react"],
    },
  },
})
