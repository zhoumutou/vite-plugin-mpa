/**
 * vite-plugin-mpa
 *
 * A lightweight MPA (Multi-Page Application) assistant for Vite/Rolldown-based dev/build.
 *
 * What this plugin does:
 * - Auto-discovers per-page entries under a pages directory (e.g., src/pages/**\/main.ts).
 * - For dev: serves HTML through a custom middleware and applies server.transformIndexHtml
 *   to allow other plugins to also transform the HTML. The entry script is injected by this
 *   plugin before </body> (idempotent).
 * - For build: exposes virtual .html inputs to Rollup via resolveId/load(). The returned HTML
 *   already contains the injected entry script so each page becomes a real Rollup input.
 *
 * Why virtual HTML for build?
 * - Virtual .html files let us avoid creating physical HTML files and still produce multi-input
 *   outputs. Since transformIndexHtml may not run on purely virtual HTML in every toolchain setup,
 *   injection happens directly in load() during build to ensure robust results.
 *
 * URL, base, and path handling:
 * - Entry paths are normalized to POSIX (forward slashes) for stable URLs across platforms.
 * - In dev, the injected <script> src honors server.config.base by prefixing base (with trailing slash).
 * - In build, the raw source path is set as src and is expected to be rewritten by the HTML pipeline.
 *
 * Templates:
 * - Each page can optionally have a colocated index.html next to its entry file (preferred).
 * - Alternatively, a shared default template path can be provided.
 * - If neither exists, falls back to a minimal built-in HTML template (templateFallback).
 *
 * Caching:
 * - templateContentCache: caches raw HTML template file content by absolute path.
 * - entryContentCache: in dev, caches fully injected HTML by a base+entry key to avoid repeated work.
 *   Cache is invalidated on *.html change events.
 *
 * Dev server middleware:
 * - Intercepts navigations that accept text/html (or *\/*) and are not internal/asset requests.
 * - Maps /, /foo, /foo.html, /foo/?q=1, etc., to page names ("index" for root).
 * - Returns a simple 404 listing known pages if the request doesn't match a discovered page.
 */

import type { Plugin, ViteDevServer } from 'vite'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/**
 * Single page metadata discovered from the pages directory.
 */
interface Page {
  /** Stable page identifier derived from directory layout; used as output key (e.g. "index", "admin/dashboard"). */
  name: string
  /** Absolute-from-Vite-root (leading "/") module specifier for the page entry (e.g. "/src/pages/admin/main.ts"). */
  entry: string
  /** Absolute filesystem path to the page HTML template, or empty string to use the built-in fallback. */
  template: string
}

/** Mapping from page name to page metadata. */
type Pages = Record<string, Page>

/** Plugin name for logs and hook identification. */
const PLUGIN_NAME = 'vite-plugin-mpa'

/**
 * Built-in fallback HTML when no page-level or default template is present.
 * The plugin injects a <script type="module" src="..."> before </body>.
 */
const templateFallback = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Vite MPA</title>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`.trim()

/** Cache for raw template file content, keyed by absolute template path. */
const templateContentCache = new Map<string, string>()
/** In dev, cache for fully injected HTML, keyed by base + entry path. */
const entryContentCache = new Map<string, string>()

/** Escape a string so it can be safely embedded in a RegExp pattern. */
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Normalize a path string to POSIX-style (forward slashes). */
function toPosix(p: string) {
  return p.replace(/\\/g, '/')
}

/** Ensure a base path always ends with a trailing slash. */
function withTrailingSlash(base: string) {
  return base.endsWith('/') ? base : `${base}/`
}

/**
 * Returns true if "file" is inside "dir".
 * Used to decide whether a changed file affects page discovery.
 */
function isInsideDir(file: string, dir: string) {
  const rel = path.relative(dir, file)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

/** Normalize Accept header to a string. */
function acceptString(accept: string | string[] | undefined) {
  return typeof accept === 'string' ? accept : Array.isArray(accept) ? accept.join(',') : ''
}

/**
 * Return true if the URL is a Vite internal request (/ @vite, / @id) or a non-HTML asset URL.
 * We skip such requests in the dev middleware to avoid interfering with asset serving/HMR.
 */
function isViteInternalOrNonHtmlAsset(url: string) {
  return (
    /^\/@vite\/|^\/@id\//.test(url)
    || (/\.[a-z0-9]+(?:\?.*)?$/i.test(url) && !/\.html(?:\?.*)?$/i.test(url))
  )
}

/**
 * Read an HTML template file once and cache it. If the file is missing or unreadable,
 * fall back to templateFallback. Empty templatePath implies using the fallback directly.
 */
function readTemplateWithCache(templatePath: string | '', onError?: (message: any, ...rest: any[]) => void) {
  if (!templatePath)
    return templateFallback

  const cached = templateContentCache.get(templatePath)
  if (cached)
    return cached

  let html = ''
  if (existsSync(templatePath)) {
    try {
      html = readFileSync(templatePath, 'utf-8')
    }
    catch (error) {
      onError?.(`[${PLUGIN_NAME}] Failed to read template: ${templatePath}`, error)
    }
  }
  html = html || templateFallback
  templateContentCache.set(templatePath, html)
  return html
}

/**
 * Build the src attribute for the injected <script type="module">.
 * - In dev, prefix server base (e.g., "/subapp/") to the posix entry path (without leading slash).
 * - In build, use the raw posix entry path and let the HTML pipeline rewrite it.
 */
function buildScriptSrc(entryPosix: string, isDev: boolean, base: string) {
  if (!isDev)
    return entryPosix
  const normalized = withTrailingSlash(base || '/')
  return `${normalized}${entryPosix.replace(/^\//, '')}`
}

/**
 * Check if the target <script type="module" src="..."> is already present in HTML.
 * The check is case-insensitive and tolerant to attribute order/whitespace.
 */
function isScriptAlreadyInjected(html: string, scriptSrc: string) {
  const re = new RegExp(
    `<script\\s+[^>]*type=["']module["'][^>]*src=["']${escapeRegExp(scriptSrc)}["'][^>]*>\\s*</script>`,
    'i',
  )
  return re.test(html)
}

/**
 * Inject a <script type="module" src="..."> tag right before </body>.
 * If </body> is missing, append the script at the end of the HTML string.
 */
function injectScriptTag(html: string, scriptSrc: string) {
  const scriptTag = `<script type="module" src="${scriptSrc}"></script>`
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${scriptTag}\n  </body>`)
  }
  return `${html}\n${scriptTag}\n`
}

/**
 * Build final HTML for a page and inject the entry <script> (idempotent).
 *
 * Behavior:
 * - Dev: returns cached injected HTML when available (keyed by base + entry). Otherwise, reads template,
 *   injects the script, caches the result, and returns it.
 * - Build: reads template and injects the script (no dev cache).
 *
 * Parameters:
 * - page: Page metadata with name, entry, and template path.
 * - isDev: Whether running in dev server.
 * - base: The dev server base path; used only in dev to prefix the script src.
 * - onError: Optional logger for filesystem errors (e.g., template read failure).
 */
function loadHtmlContent(
  page: Page,
  isDev = false,
  base = '/',
  onError?: (message: any, ...optionParams: any[]) => void,
) {
  const entryPosix = toPosix(page.entry)
  const scriptSrc = buildScriptSrc(entryPosix, isDev, base)
  const cacheKey = isDev ? `${withTrailingSlash(base || '/')}|${entryPosix}` : entryPosix

  // Dev cache (already-injected HTML)
  if (isDev) {
    const cached = entryContentCache.get(cacheKey)
    if (cached)
      return cached
  }

  // Load the base template (file-cached) then inject script (idempotent).
  const htmlRaw = readTemplateWithCache(page.template, onError)

  const htmlFinal = isScriptAlreadyInjected(htmlRaw, scriptSrc)
    ? htmlRaw
    : injectScriptTag(htmlRaw, scriptSrc)

  // Store dev cache
  if (isDev)
    entryContentCache.set(cacheKey, htmlFinal)

  return htmlFinal
}

/**
 * Recursively scan for entry files within rootDir.
 *
 * Input:
 * - entryFiles: a filename or a list of filenames to match (e.g., "main.ts" or ["main.tsx","main.ts"]).
 *
 * Output:
 * - Array of POSIX-relative paths (relative to rootDir), e.g.:
 *   ["main.ts", "admin/dashboard/main.ts"]
 *
 * Notes:
 * - Skips node_modules, dist, .git, hidden directories, and symlinks.
 * - Swallows directory read errors to avoid breaking on restricted folders.
 */
function findEntryFiles(rootDir: string, entryFiles: string | string[]) {
  const result: string[] = []
  const targets = new Set(Array.isArray(entryFiles) ? entryFiles : [entryFiles])

  function walk(absDir: string, relDir = '') {
    let entries: import('fs').Dirent[] = []
    try {
      entries = readdirSync(absDir, { withFileTypes: true })
    }
    catch {
      // Ignore unreadable directories
      return
    }

    for (const ent of entries) {
      const name = ent.name
      // Skip large/irrelevant directories and symlinks
      const isHiddenDir = ent.isDirectory() && name.startsWith('.')
      const shouldSkip
        = name === 'node_modules'
          || name === 'dist'
          || name === '.git'
          || isHiddenDir
          || ent.isSymbolicLink()
      if (shouldSkip)
        continue

      const abs = path.join(absDir, name)
      const rel = path.join(relDir, name)

      if (ent.isDirectory()) {
        walk(abs, rel)
      }
      else if (ent.isFile() && targets.has(name)) {
        // Store as POSIX path regardless of OS.
        result.push(rel.split(path.sep).join('/'))
      }
    }
  }

  walk(rootDir)
  return result
}

/**
 * Discover pages by scanning pagesDir for entryFiles and resolving templates.
 *
 * Naming:
 * - For an entry file directly under pagesDir, the page name is "index".
 * - For nested entries, the page name is the entry's directory path (e.g., "admin/dashboard").
 *
 * Template resolution order:
 * 1) index.html colocated with the entry (preferred)
 * 2) defaultTemplate (if provided and exists)
 * 3) built-in fallback (template = "")
 *
 * Entry URL (dev):
 * - Built as "/<pagesDir POSIX>/<relative entry POSIX>" so Vite dev can resolve it.
 */
function resolvePages(pagesDir: string, entryFiles: string | string[], defaultTemplate: string) {
  const cwd = process.cwd()
  const absPagesDir = path.resolve(cwd, pagesDir)
  const matches = findEntryFiles(absPagesDir, entryFiles)

  const items = matches.map((relPosix) => {
    const entryDir = path.posix.dirname(relPosix)
    const name = entryDir === '.' ? 'index' : entryDir
    const entry = `/${path.posix.join(toPosix(pagesDir), relPosix)}`

    // Preferred template is the colocated index.html in the entry directory.
    let templatePath = path.join(absPagesDir, entryDir.split('/').join(path.sep), 'index.html')
    if (!existsSync(templatePath)) {
      if (defaultTemplate && existsSync(defaultTemplate)) {
        templatePath = defaultTemplate
      }
      else {
        templatePath = '' // Use built-in fallback
      }
    }

    return { name, entry, template: templatePath }
  })

  return Object.fromEntries(items.map(it => [it.name, it] as const))
}

/**
 * Parse page metadata from a request URL.
 *
 * Normalization:
 * - "/" -> "/index.html" (page name: "index")
 * - "/foo" -> "/foo.html" (page name: "foo")
 * - "/foo/" -> "/foo.html" (page name: "foo")
 * - "/foo.html?x=1" -> preserves query; page name: "foo"
 */
function parsePageMeta(originalUrl = '/') {
  const [rawPath, rawQuery = ''] = originalUrl.split('?')
  let pathOnly = rawPath

  if (pathOnly === '/' || pathOnly === '') {
    pathOnly = '/index.html'
  }
  else if (!/\.html$/i.test(pathOnly)) {
    pathOnly = `${pathOnly.replace(/\/+$/, '')}.html`
  }

  const url = rawQuery ? `${pathOnly}?${rawQuery}` : pathOnly
  const name = pathOnly.replace(/^\//, '').replace(/\.html$/i, '')
  return { url, name }
}

/**
 * Render a minimal 404 page listing discovered pages. Used only in dev.
 */
function render404(pages: Pages) {
  const links = Object.keys(pages)
    .sort()
    .map(n => `<li><a href="/${n}.html">${n}</a></li>`)
    .join('\n')

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>404 - Page Not Found</title>
  </head>
  <body>
    <h1>404 - Page Not Found</h1>
    <p>Known pages:</p>
    <ul>
      ${links || '<li><em>No pages discovered</em></li>'}
    </ul>
  </body>
</html>`.trim()
}

/**
 * Dev plugin:
 * - appType: "mpa" to let Vite know multiple HTML inputs are expected.
 * - File watchers: invalidate caches on HTML changes; update page map on entry/template add/unlink (debounced).
 * - Middleware: intercept only GET/HEAD navigations that accept HTML; resolve page -> generate HTML
 *   (with injected script) -> run transformIndexHtml -> respond.
 */
function createDevPlugin(
  pagesRef: { current: Pages },
  ctx: { pagesDir: string, entryFiles: string | string[], defaultTemplate: string },
): Plugin {
  const absPagesDir = path.resolve(process.cwd(), ctx.pagesDir)
  const entryFileSet = new Set(Array.isArray(ctx.entryFiles) ? ctx.entryFiles : [ctx.entryFiles])

  // Debounced page discovery to reduce churn during massive FS changes.
  let refreshTimer: NodeJS.Timeout | null = null
  const scheduleRefreshPages = () => {
    if (refreshTimer)
      clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      pagesRef.current = resolvePages(ctx.pagesDir, ctx.entryFiles, ctx.defaultTemplate)
    }, 25)
  }

  return {
    name: `${PLUGIN_NAME}:serve`,
    apply: 'serve',
    config() {
      return { appType: 'mpa' }
    },
    configureServer(server: ViteDevServer) {
      // Initial discovery
      scheduleRefreshPages()

      // Invalidate template/injected caches when any HTML changes.
      server.watcher.on('change', (file) => {
        if (file.endsWith('.html')) {
          templateContentCache.clear()
          entryContentCache.clear()
        }
      })

      // Trigger re-scan when entries or templates are added/removed.
      const onMaybeStructureChange = (file: string) => {
        const abs = path.resolve(file)
        const insidePages = isInsideDir(abs, absPagesDir)
        const isEntry = insidePages && entryFileSet.has(path.basename(abs))
        const isColocatedTemplate = insidePages && path.basename(abs).toLowerCase() === 'index.html'
        const isDefaultTemplate = ctx.defaultTemplate && path.resolve(ctx.defaultTemplate) === abs
        if (isEntry || isColocatedTemplate || isDefaultTemplate) {
          scheduleRefreshPages()
        }
      }

      server.watcher.on('add', onMaybeStructureChange)
      server.watcher.on('unlink', onMaybeStructureChange)

      // Serve generated HTML for navigations; let Vite/other plugins transform it further.
      server.middlewares.use(async (req, res, next) => {
        const method = req.method || 'GET'
        if (method !== 'GET' && method !== 'HEAD')
          return next()

        const urlRaw = req.originalUrl || req.url || ''
        if (isViteInternalOrNonHtmlAsset(urlRaw))
          return next()

        // Only handle navigations that accept HTML.
        const isHtml = acceptString(req.headers.accept).includes('text/html')
          || acceptString(req.headers.accept).includes('*/*')
        if (!isHtml)
          return next()

        // Resolve page by URL.
        const { url, name } = parsePageMeta(urlRaw)
        const page = pagesRef.current[name]
        if (!page) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(render404(pagesRef.current))
          return
        }

        // Read + inject (dev uses base in script src).
        const base = server.config.base || '/'
        const onError = (message: any, ...rest: any[]) =>
          server.config.logger.error(String(message), { error: rest[0] })

        const htmlRaw = loadHtmlContent(page, true, base, onError)
        const htmlTransformed = await server.transformIndexHtml(url, htmlRaw)
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(htmlTransformed)
      })
    },
  }
}

/**
 * Build plugin:
 * - rollupOptions.input: exposes one virtual ".html" input per page (key: "<name>", value: "<name>.html")
 * - resolveId/load: resolve those HTML ids and return the HTML content with injected script
 *
 * Why inject in load() for build?
 * - Virtual HTML typically bypasses transformIndexHtml in many setups. We inject here to guarantee
 *   each page is a proper Rollup input, independent of transform ordering.
 */
function createProdPlugin(pages: Pages): Plugin {
  const input = Object.fromEntries(Object.keys(pages).map(name => [name, `${name}.html`]))

  return {
    name: `${PLUGIN_NAME}:build`,
    apply: 'build',
    config() {
      return {
        appType: 'mpa',
        build: {
          rollupOptions: {
            input,
          },
        },
      }
    },

    // Treat ".html" ids as virtual entry modules.
    resolveId(id: string) {
      return id.endsWith('.html') ? id : null
    },

    // Provide the HTML content for virtual entries (already injected).
    load(id: string) {
      if (!id.endsWith('.html'))
        return null
      const pageName = id.slice(0, -'.html'.length)
      const page = pages[pageName]
      return page ? loadHtmlContent(page, false, '/', this.error) : null
    },
  }
}

export interface Options {
  /**
   * Directory containing page entries.
   * @default "src/pages"
   */
  pages?: string
  /**
   * Entry file name(s) to search for.
   * Accepts a string or an array (e.g., ["main.tsx","main.ts","main.jsx","main.js"]).
   * @default "main.ts"
   */
  entry?: string | string[]
  /**
   * Default HTML template file path (fallback when colocated template not present).
   * @default "src/index.html"
   */
  template?: string
}

/**
 * Factory function that creates both dev and build plugins.
 *
 * Dev:
 * - Discovers pages from the provided "pages" and "entry" configuration.
 * - Serves generated HTML and runs transformIndexHtml to integrate with Vite's HTML pipeline.
 *
 * Build:
 * - Exposes virtual HTML files as Rollup inputs; injects entry script inline in load().
 *
 * The two plugins are returned in an array; Vite selectively applies them based on the current command.
 */
export default function VitePluginMpa(options: Options = {}) {
  const {
    pages: pagesDir = 'src/pages',
    entry = 'main.ts',
    template = 'src/index.html',
  } = options

  // Initial page discovery at plugin creation time.
  const pagesRef = { current: resolvePages(pagesDir, entry, template) }

  // Dev uses a mutable ref for re-discovery; build uses the snapshot computed above.
  return [
    createDevPlugin(pagesRef, { pagesDir, entryFiles: entry, defaultTemplate: template }),
    createProdPlugin(pagesRef.current),
  ]
}
