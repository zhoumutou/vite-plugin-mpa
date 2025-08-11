/**
 * Vite Plugin for Multi-Page Applications (MPA)
 * - Auto-discovers per-page entries (e.g., src/pages\/**\/main.ts)
 * - Injects entry <script type="module"> into HTML (dev/build)
 * - Configures Rollup multiple HTML inputs for production
 *
 * Notes:
 * - Dev server serves HTML via custom middleware, then runs transformIndexHtml.
 * - Build phase provides virtual HTML files as Rollup inputs via resolveId/load.
 */

import type { Plugin, ViteDevServer } from 'vite'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/**
 * Represents a single page in the MPA structure.
 */
interface Page {
  /** Page identifier, used for routing and output filename. */
  name: string
  /** Path to the JavaScript entry file (absolute from Vite root with leading "/"). */
  entry: string
  /** Absolute path to the HTML template file (or empty string to use fallback). */
  template: string
}

/** Collection of pages indexed by name. */
type Pages = Record<string, Page>

/**
 * Default HTML template used when no template file is found.
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

// Caches for template and entry content to avoid repeated file reads in dev.
const templateContentCache = new Map<string, string>()
const entryContentCache = new Map<string, string>()

/**
 * Load HTML content for a page and inject the <script type="module" src="..."> before </body>.
 * - In dev mode, returns cached HTML if available to reduce FS reads.
 * - In build mode, reads template (or uses fallback) and injects the entry script.
 */
function loadHtmlContent(page: Page, isDev = false) {
  const { entry, template } = page

  // In dev mode, return cached fully-built HTML if present.
  if (isDev) {
    const cached = entryContentCache.get(entry)
    if (cached)
      return cached
  }

  // Try read from template cache (only cache when a template path exists).
  let htmlContent = template ? templateContentCache.get(template) : templateFallback
  if (!htmlContent) {
    if (template && existsSync(template)) {
      try {
        htmlContent = readFileSync(template, 'utf-8')
      }
      catch (error) {
        console.error(`[vite-plugin-mpa] Failed to read template: ${template}`, error)
      }
    }
    // Fall back to default template if needed.
    htmlContent = htmlContent || templateFallback
    // Cache template file content only when a template path exists.
    if (template)
      templateContentCache.set(template, htmlContent)
  }

  // Normalize entry path to POSIX for HTML usage.
  const entrySrc = entry.replace(/\\/g, '/')

  // Inject the entry script before closing body tag.
  htmlContent = htmlContent.replace(
    /<\/body>/i,
    `<script type="module" src="${entrySrc}"></script>\n  </body>`,
  )

  // Cache final HTML in dev.
  if (isDev)
    entryContentCache.set(entry, htmlContent)

  return htmlContent
}

/**
 * Recursively find all files named `entryFile` under `rootDir` and its subdirectories.
 * Returns an array of relative POSIX paths (relative to rootDir) for each found entry file.
 */
function findEntryFiles(rootDir: string, entryFile: string) {
  const result: string[] = []

  function walk(absDir: string, relDir = '') {
    // Use Dirent to avoid extra stat calls.
    const entries = readdirSync(absDir, { withFileTypes: true })
    for (const ent of entries) {
      const abs = path.join(absDir, ent.name)
      const rel = path.join(relDir, ent.name)
      if (ent.isDirectory()) {
        walk(abs, rel)
      }
      else if (ent.isFile() && ent.name === entryFile) {
        // Store POSIX-style relative path.
        result.push(rel.split(path.sep).join('/'))
      }
    }
  }

  walk(rootDir)
  return result
}

/**
 * Discover and resolve page configurations from the file system.
 *
 * Template resolution priority:
 * 1) index.html located alongside the entry file directory
 * 2) defaultTemplate, if provided and exists
 * 3) built-in fallback template (empty template path)
 *
 * Page naming:
 * - Root entry file becomes "index"
 * - Nested entries use directory structure as page name (e.g., "admin/dashboard")
 */
function resolvePages(pagesDir: string, entryFile: string, defaultTemplate: string) {
  const cwd = process.cwd()
  const absPagesDir = path.resolve(cwd, pagesDir)
  const matches = findEntryFiles(absPagesDir, entryFile)

  const items = matches.map((relPosix) => {
    const entryDir = path.posix.dirname(relPosix)
    const name = entryDir === '.' ? 'index' : entryDir
    // Build an absolute-like path from Vite root with leading slash for dev server to resolve.
    const entry = `/${path.posix.join(pagesDir.split(path.sep).join('/'), relPosix)}`

    // Prefer template colocated with entry.
    let template = path.join(absPagesDir, entryDir.split('/').join(path.sep), 'index.html')
    if (!existsSync(template)) {
      if (defaultTemplate && existsSync(defaultTemplate)) {
        template = defaultTemplate
      }
      else {
        template = '' // Use built-in fallback
      }
    }

    return { name, entry, template }
  })

  return Object.fromEntries(items.map(it => [it.name, it]))
}

/**
 * Parse page metadata from a URL (dev server).
 * - Normalizes "/" to "/index.html"
 * - Extracts page name from "/name(.html)?"
 */
function parsePageMeta(originalUrl = '/') {
  const url = originalUrl.replace(/^\/(\?|$)/, '/index.html$1')
  const name = url.match(/^\/([^?]*?)(?:\.html)?(?:\?.*)?$/)?.[1] ?? ''
  return { url, name }
}

const PLUGIN_NAME = 'vite-plugin-mpa'

/**
 * Create the dev plugin:
 * - Set appType to "mpa"
 * - Serve HTML via middleware and apply transformIndexHtml
 * - Invalidate caches on HTML file change
 */
function createDevPlugin(pages: Pages): Plugin {
  return {
    name: `${PLUGIN_NAME}:serve`,
    apply: 'serve',
    config() {
      return { appType: 'mpa' }
    },
    configureServer(server: ViteDevServer) {
      // Clear caches when HTML files change.
      server.watcher.on('change', (file) => {
        if (file.endsWith('.html')) {
          templateContentCache.clear()
          entryContentCache.clear()
        }
      })

      // Middleware to respond with generated HTML.
      server.middlewares.use(async (req, res, next) => {
        const isHtml = req.headers.accept?.includes('text/html')
        if (!isHtml)
          return next()

        const { url, name } = parsePageMeta(req.originalUrl)

        const page = pages[name]
        if (!page) {
          res.writeHead(404, { 'Content-Type': 'text/html' })
          res.end('Page not found')
          return
        }

        const htmlRaw = loadHtmlContent(page, true)
        if (!htmlRaw) {
          res.writeHead(404, { 'Content-Type': 'text/html' })
          res.end('Page not found')
          return
        }

        const htmlTransformed = await server.transformIndexHtml(url, htmlRaw)
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(htmlTransformed)
      })
    },
  }
}

/**
 * Create the build plugin:
 * - Provide Rollup inputs for each page (virtual HTML entries)
 * - Resolve and load HTML content for those entries
 */
function createProdPlugin(pages: Pages): Plugin {
  const input = Object.fromEntries(Object.keys(pages).map(page => [page, `${page}.html`]))

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
    // Treat ".html" IDs as virtual entry modules.
    resolveId(id: string) {
      return id.endsWith('.html') ? id : null
    },
    // Provide the HTML content for virtual entries.
    load(id: string) {
      if (!id.endsWith('.html'))
        return null
      const name = id.slice(0, -'.html'.length)
      const page = pages[name]
      return page ? loadHtmlContent(page, false) : null
    },
  }
}

/**
 * Plugin options.
 */
export interface Options {
  /** Directory containing page entries (default: 'src/pages'). */
  pages?: string
  /** Entry file name to search for (default: 'main.ts'). */
  entry?: string
  /** Default HTML template file path (default: 'src/index.html'). */
  template?: string
}

/**
 * Multi-Page Application (MPA) plugin for Vite.
 * - Auto-discovers pages
 * - Serves/transforms HTML in dev
 * - Provides virtual HTML entries in build
 */
export default function VitePluginMpa(options: Options = {}) {
  const {
    pages: pagesDir = 'src/pages',
    entry = 'main.ts',
    template = 'src/index.html',
  } = options

  const pages = resolvePages(pagesDir, entry, template)

  // Return both dev and build plugins; Vite will apply based on "apply" field.
  return [createDevPlugin(pages), createProdPlugin(pages)]
}
