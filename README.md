# Portfolio site (krtmtthw.dev)

Personal site of Kurt Matthew Nudo: projects, and a reference page for **Akari**,
my private design system. Static Astro site on GitHub Pages at
<https://krtmtthw.dev> (repo `abrycta/abrycta.github.io`).

| Path                         | What it is                                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/pages/`                 | `/`, `/about/`, `/projects/`, `/projects/<slug>/`, `/akari/`, `404`, `robots.txt`, `favicons/<slug>.svg`                                                                                   |
| `src/content/projects/*.mdx` | One MDX file per project, from `_TEMPLATE.mdx.example` (schema: `src/content.config.ts`)                                                                                                   |
| `src/components/islands/`    | The only client-side React (Astro islands, `client:idle` / `client:visible`)                                                                                                               |
| `public/og/`                 | Share cards (`site-v3.png` plus one per project)                                                                                                                                           |
| `tests/`                     | Playwright and axe: smoke (render, console errors, horizontal overflow, axe, toggles, header), shared theme cookie, live embeds, breadcrumb strip                                          |
| `scripts/`                   | `dev.sh`, `preview.sh`, `ci.sh`, `check-size.sh`, `check-project-pages.mjs`, `link-akari.sh`, `lib.sh` (shared helpers), `retain-assets.mjs` (keeps earlier hashed assets on deploy)       |
| `deploy.config`              | App/output directories and the install, check, build, e2e, dev, preview commands                                                                                                           |
| `public/CNAME`               | Custom domain for GitHub Pages (`krtmtthw.dev`)                                                                                                                                            |
| `.github/workflows/`         | `ci.yml` (checks, build, smoke tests), `deploy.yml` (GitHub Pages), `keepalive.yml` (keeps the scheduled workflows enabled), `live-check.yml` (hourly check that the live site is at main) |

Stack: Astro 7 (static output), React 19 islands, Tailwind CSS v4
(`@tailwindcss/vite`), MDX, TypeScript strict, Node 24 + npm.

## Run

```sh
nvm use                  # Node 24 (.nvmrc)
scripts/dev.sh           # installs deps (Akari linked from ../akari when present), then astro dev on :4321
scripts/ci.sh            # what CI runs: install, check, lint, format, build, size guard, smoke tests
scripts/preview.sh       # build, then `astro preview` of dist/ on :4321
```

Individual steps: `npm run check:projects` (project page standard), `npm run check` (astro check), `npm run lint`,
`npm run format` / `format:check`, `npm run build`, `npm run test:e2e`
(needs a build; first time run `npx playwright install chromium`).

`astro.config.mjs` sets `site: "https://krtmtthw.dev"` (no `base`), used for
canonical URLs, Open Graph URLs, the sitemap and `robots.txt`. `SITE_URL=…`
overrides it for a build served elsewhere. Pages use trailing-slash URLs
(`build.format: "directory"`), which is how GitHub Pages serves folders.

## Project pages

Every project page has front matter per the schema, then exactly four
sections, `## Problem`,
`## Approach`, `## Architecture` (with a `<FlowDiagram>`) and
`## Where it stands`. Start from `src/content/projects/_TEMPLATE.mdx.example`;
`npm run check:projects` (part of `scripts/ci.sh`) names the file and the
missing or misplaced section when a page drifts.

## Akari

`package.json` depends on `@abrycta/akari`, a private package on GitHub
Packages. The site uses its public entry points only:
`@abrycta/akari/css/shadcn.css` and `css/fonts.css` (from `src/styles/`),
`@abrycta/akari/react` (components) and `@abrycta/akari/tokens` (token values
and `contrast()` for the `/akari/` page).

### Install from GitHub Packages

Export a classic GitHub token with only `read:packages` as `NODE_AUTH_TOKEN`,
then `cp .npmrc.example .npmrc` (gitignored). Its `@abrycta` scope line sends
npm to GitHub Packages instead of the public registry. Both workflows write the
same `.npmrc` and authenticate with `GITHUB_TOKEN` (`packages: read`); the
package's settings (_Manage Actions access_) give
`abrycta/abrycta.github.io` **Read** access.

### Local Akari checkout

With a sibling checkout at `../akari`, the scripts link it instead:

- `scripts/dev.sh` and `scripts/ci.sh` (outside CI) run
  `npm install --no-save ../akari`. That symlinks the checkout into
  `node_modules` and leaves `package.json` and the lockfile alone.
- `scripts/link-akari.sh link | unlink | status` does the same by hand.
- `AKARI_LOCAL=0` uses the registry instead; `AKARI_DIR=/path` points elsewhere.
- Build the checkout first (`npm run build` in `../akari`). React and
  lucide-react are deduped in `astro.config.mjs`, so the link shares one copy.

## Deploy (GitHub Pages)

`deploy.yml` runs when CI finishes green on `main`, daily, and by hand via
_Run workflow_: it deploys main's newest commit whose CI passed. It runs
`npm ci` and the build, uploads `dist/`, and `actions/deploy-pages` publishes it. One-time repo settings:

- _Settings → Pages → Build and deployment → Source_: **GitHub Actions**.
- _Settings → Pages → Custom domain_: `krtmtthw.dev`, with _Enforce HTTPS_
  (`public/CNAME` keeps the domain on every deploy).
- The Akari package access grant above.

`ci.yml` runs on every push and PR: clean install, `astro check`, ESLint,
Prettier, build, size guard (no file over 100 MiB, site under 1 GB, the GitHub
Pages limits) and the Playwright smoke tests.

## Notes

- The header is Akari's `Header` (the menu bar shared by every *.krtmtthw.dev
  app; `data-akari-header`, asserted in the smoke tests), server-rendered and
  hydrated `client:idle` for its built-in theme and contrast toggles.
- JavaScript ships only for islands: the header on every page, the Akari teaser on `/`, and the theme panel and component
  gallery on `/akari/`. Everything else is static HTML.
- Theme follows `prefers-color-scheme` and `prefers-contrast` with no JS. The
  toggles write a cookie on `krtmtthw.dev`, so every *.krtmtthw.dev app shares
  the choice (localStorage is the fallback). Akari's `theme-init.js`, loaded in
  `<head>` of `BaseLayout.astro`, applies it before first paint.
- Akari's webfont CSS is loaded as a separate, non-render-blocking stylesheet
  (`src/styles/fonts.css`); all faces use `font-display: swap`.

## License

Copyright © 2026 Kurt Matthew Nudo. All rights reserved.
