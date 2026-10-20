# Portfolio site (krtmtthw.dev)

Personal site of Kurt Matthew Nudo: projects, and a living showcase of **Akari**,
my private design system. Static Astro site on GitHub Pages at
<https://krtmtthw.dev> (repo `abrycta/abrycta.github.io`).

| Path                         | What it is                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `src/pages/`                 | `/`, `/projects/`, `/projects/<slug>/`, `/akari/`, `404`, `robots.txt`, `og.png` |
| `src/content/projects/*.mdx` | One MDX file per project (frontmatter schema in `src/content.config.ts`)         |
| `src/components/islands/`    | The only client-side React (Astro islands, `client:idle` / `client:visible`)     |
| `tests/`                     | Playwright smoke tests (render, console errors, overflow at 360px, axe, toggles) |
| `scripts/`                   | `dev.sh`, `preview.sh`, `ci.sh`, `check-size.sh`, `link-akari.sh`                |
| `deploy.config`              | App/output directories and the install, check, build, e2e, dev, preview commands |
| `public/CNAME`               | Custom domain for GitHub Pages (`krtmtthw.dev`)                                  |
| `.github/workflows/`         | `ci.yml` (checks, build, smoke tests), `deploy.yml` (GitHub Pages)               |

Stack: Astro 7 (static output), React 19 islands, Tailwind CSS v4
(`@tailwindcss/vite`), MDX, TypeScript strict, Node 24 + npm.

## Run

```sh
nvm use                  # Node 24 (.nvmrc)
scripts/dev.sh           # installs deps (Akari linked from ../akari), then astro dev on :4321
scripts/ci.sh            # what CI runs: install, check, lint, format, build, size guard, smoke tests
scripts/preview.sh       # build, then `astro preview` of dist/ on :4321
```

Individual steps: `npm run check` (astro check), `npm run lint`,
`npm run format` / `format:check`, `npm run build`, `npm run test:e2e`
(needs a build; first time run `npx playwright install chromium`).

`astro.config.mjs` sets `site: "https://krtmtthw.dev"` (no `base`), used for
canonical URLs, Open Graph URLs, the sitemap and `robots.txt`. `SITE_URL=…`
overrides it for a build served elsewhere. Pages use trailing-slash URLs
(`build.format: "directory"`), which is how GitHub Pages serves folders.

## Akari: local checkout now, GitHub Packages later

`package.json` depends on `"@abrycta/akari": "^0.1.0"`, the range CI installs
from GitHub Packages. The site uses its public entry points only:
`@abrycta/akari/css/shadcn.css` and `css/fonts.css` (from `src/styles/`),
`@abrycta/akari/react` (components) and `@abrycta/akari/tokens` (token values
and `contrast()` for the showcase page).

**Local development (now and later).** Akari is not published yet, so a plain
`npm install` would fail. The scripts link the sibling checkout instead:

- `scripts/dev.sh` and `scripts/ci.sh` (outside CI) run
  `npm install --no-save ../akari` when `../akari` exists. That symlinks the
  checkout into `node_modules` and leaves `package.json` and the lockfile alone.
- `scripts/link-akari.sh link | unlink | status` does the same by hand.
- `AKARI_LOCAL=0` uses the registry instead; `AKARI_DIR=/path` points elsewhere.
- Build the checkout first (`npm run build` in `../akari`). React and
  lucide-react are deduped in `astro.config.mjs`, so the link shares one copy.

**When Akari is published to GitHub Packages:**

1. Create a classic GitHub token with only `read:packages` and export it as
   `NODE_AUTH_TOKEN`; `cp .npmrc.example .npmrc` (gitignored).
2. `AKARI_LOCAL=0 npm install @abrycta/akari@^0.1.0` once, to record the
   registry version in `package-lock.json` (it currently records the local
   link, so `npm ci` in CI fails until this is done).
3. In the package's settings on GitHub (_Package settings → Manage Actions
   access_), add `abrycta/abrycta.github.io` with **Read** access. Both
   workflows write an `.npmrc` scoped to `@abrycta` and authenticate with
   `GITHUB_TOKEN` (`packages: read`); without this grant the install gets a 403/404.

Note: without the `.npmrc` scope line, npm would look for `@abrycta/akari` on
the public npm registry. Keep the scope configured everywhere you install.

## Deploy (GitHub Pages)

`deploy.yml` runs on every push to `main` (and by hand via _Run workflow_):
`withastro/action` installs and builds, uploads `dist/`, and
`actions/deploy-pages` publishes it. One-time repo settings:

- _Settings → Pages → Build and deployment → Source_: **GitHub Actions**.
- _Settings → Pages → Custom domain_: `krtmtthw.dev`, with _Enforce HTTPS_
  (`public/CNAME` keeps the domain on every deploy).
- The Akari package access grant above.

`ci.yml` runs on every push and PR: clean install, `astro check`, ESLint,
Prettier, build, size guard (no file over 100 MiB, site under 1 GB, the GitHub
Pages limits) and the Playwright smoke tests.

### Alternative host (optional)

The build is plain static files, so any static host works. For example,
Cloudflare Pages: `npx wrangler pages deploy dist --project-name kmn-portfolio`
with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` set, and
`SITE_URL=https://kmn-portfolio.pages.dev` at build time so canonical URLs
match. Not set up in this repo.

## Notes

- JavaScript ships only for islands: the header theme controls (`client:idle`)
  on every page, the Akari teaser on `/`, and the theme panel and component
  gallery on `/akari/`. Everything else is static HTML.
- Theme follows `prefers-color-scheme` and `prefers-contrast` with no JS; the
  toggles store `theme` and `contrast` in `localStorage`, applied before first
  paint by an inline script in `BaseLayout.astro`.
- Akari's webfont CSS is loaded as a separate, non-render-blocking stylesheet
  (`src/styles/fonts.css`); all faces use `font-display: swap`.
