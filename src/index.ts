/**
 * Vite Plugin for Multi-Page Applications (MPA)
 * This plugin automatically configures entry points for MPA projects,
 * handles HTML templates, and sets up development server routing.
 */
import type { Plugin, ViteDevServer } from 'vite'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/**
 * Represents a single page in the MPA structure
 */
interface Page {
  /** Page identifier, used for routing and output filename */
  name: string
  /** Path to the JavaScript entry file */
  entry: string
  /** Path to the HTML template file */
  template: string
}

/** Collection of pages indexed by name */
type Pages = Record<string, Page>

/**
 * Default HTML template used when no template file is found
 */
const templateFallback = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`.trim()

// Caches for template and entry content to avoid repeated file reads
const templateContentCache = new Map<string, string>()
const entryContentCache = new Map<string, string>()

/**
 * Loads HTML content for a page, injecting the entry script
 * @param page The page configuration object
 * @param isDev Whether running in development mode
 * @returns The processed HTML content
 */
function loadHtmlContent(page: Page, isDev = false) {
  const { entry, template } = page

  // In dev mode, try to use cached content first
  if (isDev) {
    const entryContent = entryContentCache.get(entry)
    if (entryContent) {
      return entryContent
    }
  }

  // Try to get template content from cache
  let htmlContent = template ? templateContentCache.get(template) : templateFallback
  if (!htmlContent) {
    if (existsSync(template)) {
      try {
        htmlContent = readFileSync(template, 'utf-8')
      }
      catch (error) {
        console.error(`Failed to read template: ${template}`, error)
      }
    }

    // Fall back to default template if needed
    htmlContent = htmlContent || templateFallback
    templateContentCache.set(template, htmlContent)
  }

  // Inject the entry script before closing body tag
  htmlContent = htmlContent.replace(
    '</body>',
    `<script type="module" src="${entry.replace(/\\/g, '/')}"></script>\n  </body>`,
  )

  // Cache the result in development mode
  if (isDev) {
    entryContentCache.set(entry, htmlContent)
  }

  return htmlContent
}

/**
 * Recursively find all files named `entryFile` under `rootDir` and its subdirectories.
 * Returns an array of relative paths (relative to rootDir) for each found entry file.
 * @param rootDir The root directory to start searching from (absolute path)
 * @param entryFile The entry file name to look for (e.g. 'main.ts')
 * @returns Array of relative file paths matching the entry file name
 */
function findEntryFiles(rootDir: string, entryFile: string) {
  const result: string[] = []

  function walk(dir: string, relDir = '') {
    const files = readdirSync(dir)
    for (const file of files) {
      const fullPath = path.join(dir, file)
      const relPath = path.join(relDir, file)

      if (statSync(fullPath).isDirectory()) {
        walk(fullPath, relPath)
      }
      else if (file === entryFile) {
        result.push(relPath)
      }
    }
  }

  walk(rootDir)

  return result
}

/**
 * Discovers and resolves page configurations from the file system
 * @param pagesDir Directory containing page entries
 * @param entryFile Filename pattern for entry files
 * @param defaultTemplate Optional path to a default HTML template
 * @returns Object mapping page names to their configurations
 *
 * @remarks
 * Template resolution follows this priority:
 * 1. First looks for `index.html` in the same directory as the entry file
 * 2. If not found and defaultTemplate is provided, uses that template
 * 3. If neither exists, sets template to empty string, which will use the built-in fallback
 *
 * Page naming convention:
 * - Entry files in the root directory become the "index" page
 * - Entry files in subdirectories use the directory name as the page name
 * - Nested directories use the relative path as the page name (e.g., "admin/dashboard")
 *
 * The returned Pages object uses these names as keys, making them accessible as:
 * - `/` or `/index.html` for the index page
 * - `/pageName.html` for other pages
 */
function resolvePages(pagesDir: string, entryFile: string, defaultTemplate: string) {
  const cwd = process.cwd()
  const absolutePagesDir = path.resolve(cwd, pagesDir)
  const matches = findEntryFiles(absolutePagesDir, entryFile)

  const items = matches.map((item) => {
    const entryDir = path.dirname(item)

    // Use directory name as page name, or 'index' for root
    const name = entryDir === '.' ? 'index' : entryDir
    const entry = `/${path.join(pagesDir, item)}`

    // Try to find a template in the same directory, fall back to default location
    let template = path.join(absolutePagesDir, entryDir, 'index.html')
    if (!existsSync(template) && defaultTemplate && existsSync(defaultTemplate)) {
      template = defaultTemplate
    }
    else {
      template = ''
    }

    return {
      name,
      entry,
      template,
    }
  })

  return Object.fromEntries(items.map(it => [it.name, it]))
}

/**
 * Parses page metadata from a URL
 * @param originalUrl The original request URL
 * @returns Object containing the normalized URL and page name
 */
function parsePageMeta(originalUrl = '/') {
  const url = originalUrl.replace(/^\/(\?|$)/, '/index.html$1')
  const name = url.match(/^\/([^?]*?)(?:\.html)?(?:\?.*)?$/)?.[1] ?? ''

  return { url, name }
}

const PLUGIN_NAME = 'vite-plugin-mpa'

/**
 * Creates a Vite plugin for development mode
 * @param pages Collection of page configurations
 * @returns Vite plugin for development
 */
function createDevPlugin(pages: Pages): Plugin {
  return {
    name: PLUGIN_NAME,
    config() {
      return {
        appType: 'mpa',
      }
    },
    configureServer(server: ViteDevServer) {
      // Clear caches when HTML files change
      server.watcher.on('change', (file) => {
        if (file.endsWith('.html')) {
          templateContentCache.clear()
          entryContentCache.clear()
        }
      })

      // Handle HTML requests with custom middleware
      server.middlewares.use(async (req, res, next) => {
        const isHtmlRequest = req.headers.accept?.includes('text/html')
        if (!isHtmlRequest) {
          return next()
        }

        const { url, name } = parsePageMeta(req.originalUrl)

        const response = (code: number, content: string) => {
          res.writeHead(code, { 'Content-Type': 'text/html' })
          res.end(content)
        }

        // Find the requested page
        const page = pages[name]
        if (!page) {
          response(404, 'Page not found')
          return
        }

        // Load and transform HTML content
        const htmlRaw = loadHtmlContent(page, true)
        if (!htmlRaw) {
          response(404, 'Page not found')
          return
        }

        const htmlContent = await server.transformIndexHtml(url, htmlRaw)
        response(200, htmlContent)
      })
    },
  }
}

/**
 * Creates a Vite plugin for production build
 * @param pages Collection of page configurations
 * @returns Vite plugin for production
 */
function createProdPlugin(pages: Pages): Plugin {
  // Configure entry points for each page
  const input = Object.fromEntries(Object.keys(pages).map(page => [page, `${page}.html`]))

  return {
    name: PLUGIN_NAME,
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
    // Handle .html files as entry points
    resolveId(id: string) {
      return id.endsWith('.html') ? id : null
    },
    // Load HTML content for entry points
    load(id: string) {
      if (!id.endsWith('.html')) {
        return null
      }

      const name = id.replace('.html', '')
      const page = pages[name]

      return page ? loadHtmlContent(page) : null
    },
  }
}

/**
 * Configuration options for the MPA plugin
 */
export interface Options {
  /** Directory containing page entries (default: 'src/pages') */
  pagesDir?: string
  /** Filename pattern for entry files (default: 'main.ts') */
  entryFile?: string
  /** Custom default HTML template (default: 'src/index.html') */
  template?: string
}

/**
 * Multi-Page Application (MPA) plugin for Vite
 * Automatically configures entry points and handles HTML templates
 * @param options Plugin configuration options
 * @returns Vite plugin instance
 */
export default function VitePluginMpa(options: Options = {}) {
  const {
    pagesDir = 'src/pages',
    entryFile = 'main.ts',
    template = 'src/index.html',
  } = options

  // Discover pages from file system
  const pages = resolvePages(pagesDir, entryFile, template)

  // Return appropriate plugin based on environment
  return process.env.NODE_ENV === 'development' ? createDevPlugin(pages) : createProdPlugin(pages)
}
