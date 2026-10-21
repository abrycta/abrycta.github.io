// @ts-check
import mdx from "@astrojs/mdx"
import react from "@astrojs/react"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"

import { defineConfig } from "astro/config"

// Production origin (GitHub Pages custom domain, see public/CNAME), used for
// canonical URLs, Open Graph URLs, the sitemap and robots.txt. Served from the
// domain root, so there is no `base`. SITE_URL overrides it (e.g. for a preview host).
const site = process.env.SITE_URL ?? "https://krtmtthw.dev"

// Akari's pre-paint theme script, served from this origin at /theme-init.js (dev middleware, copied on build).
const require = createRequire(import.meta.url)
const themeInit = () => readFileSync(require.resolve("@abrycta/akari/assets/theme-init.js"), "utf8")
/** @type {import("astro").AstroIntegration} */
const akariThemeInit = {
  name: "akari-theme-init",
  hooks: {
    "astro:server:setup": ({ server }) => {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/theme-init.js") return next()
        res.setHeader("Content-Type", "text/javascript; charset=utf-8")
        res.end(themeInit())
      })
    },
    "astro:build:done": ({ dir }) => writeFileSync(new URL("theme-init.js", dir), themeInit()),
  },
}

export default defineConfig({
  site,
  output: "static",
  // GitHub Pages serves /projects/ from projects/index.html (and redirects /projects there).
  trailingSlash: "always",
  redirects: { "/projects/lgu-lights/": "/projects/lights/" },
  build: { format: "directory" },
  integrations: [react(), mdx(), sitemap({ filter: (page) => !page.includes("/404") }), akariThemeInit],
  prefetch: { prefetchAll: false, defaultStrategy: "hover" },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      // Akari is symlinked (file:../akari) and has its own node_modules; share one React.
      dedupe: ["react", "react-dom", "lucide-react"],
    },
  },
})
