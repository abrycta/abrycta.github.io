// Minimal static server for the Playwright smoke tests. Serves dist/ the way
// GitHub Pages does for this site: /path/ -> path/index.html (also /path and
// /path.html), unknown paths -> 404.html with status 404. (Astro 7's `astro preview` detaches
// into the background under some environments, which Playwright can't manage.)
import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, normalize, resolve } from "node:path"

const root = resolve(process.argv[2] ?? "dist")
const port = Number(process.argv[3] ?? 4322)
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
}

const isFile = (p) => existsSync(p) && statSync(p).isFile()

function locate(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "")
  const base = join(root, clean)
  if (!base.startsWith(root)) return null
  for (const candidate of [base, `${base}.html`, join(base, "index.html")]) if (isFile(candidate)) return candidate
  return null
}

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost")
  const file = locate(pathname)
  const target = file ?? join(root, "404.html")
  res.writeHead(file ? 200 : 404, { "Content-Type": TYPES[extname(target)] ?? "application/octet-stream" })
  createReadStream(target).pipe(res)
}).listen(port, "127.0.0.1", () => console.log(`serving ${root} on http://127.0.0.1:${port}`))
