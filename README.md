# @zhoumutou/vite-plugin-mpa

[![npm version](https://img.shields.io/npm/v/@zhoumutou/vite-plugin-mpa.svg)](https://www.npmjs.com/package/@zhoumutou/vite-plugin-mpa)
[![weekly downloads](https://img.shields.io/npm/dw/@zhoumutou/vite-plugin-mpa)](https://www.npmjs.com/package/@zhoumutou/vite-plugin-mpa)
[![license](https://img.shields.io/npm/l/@zhoumutou/vite-plugin-mpa)](https://github.com/zhoumutou/vite-plugin-mpa/blob/main/LICENSE)
[![unpacked size](https://img.shields.io/npm/unpacked-size/%40zhoumutou%2Fvite-plugin-mpa)](https://www.npmjs.com/package/@zhoumutou/vite-plugin-mpa)

A Vite plugin for Multi-Page Applications (MPA) that auto-discovers entries, injects per-page scripts into HTML, and wires dev/build flows.

English | [中文](./README.zh_CN.md)

## Features

- Auto-discover page entries (e.g., `src/pages/**/main.ts`)
- Dev:
  - Serve HTML via custom middleware
  - Apply `server.transformIndexHtml` to allow other plugins to participate
  - Inject `<script type="module" src="...">` before `</body>` (idempotent)
  - 404 page with discovered pages listing
- Build:
  - Expose virtual `.html` inputs to Rollup
  - Inject entry script during `load()` to ensure reliable multi-entry outputs
- Template resolution:
  - Use colocated `index.html` next to each entry if present
  - Otherwise fall back to a shared default template
  - Otherwise use a minimal built-in fallback

## Installation

```bash
# npm
npm install @zhoumutou/vite-plugin-mpa -D

# yarn
yarn add @zhoumutou/vite-plugin-mpa -D

# pnpm
pnpm add @zhoumutou/vite-plugin-mpa -D
```

## Quick start

```ts
import mpa from '@zhoumutou/vite-plugin-mpa'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    mpa({
      // Optional
      // pages: 'src/pages',          // directory containing page entries
      // entry: 'main.ts',            // entry file name(s) to search for
      // template: 'src/index.html',  // default HTML template file path
    })
  ]
})
```

Recommended project layout:

```
src/
  pages/
    index/
      main.ts
      index.html        # optional (colocated)
    admin/dashboard/
      main.ts
      index.html        # optional (colocated)
src/index.html          # default template (optional)
```

## How routing works (dev)

- Request normalization:
  - `/` => `/index.html` => page name: `index`
  - `/foo` or `/foo/` => `/foo.html` => page name: `foo`
  - `/admin/dashboard.html` => page name: `admin/dashboard`
- Only GET/HEAD navigations that accept `text/html` (or `*/*`) are intercepted.
- Internal URLs like `/@vite/*`, `/@id/*`, or non-HTML assets are ignored by the middleware.
- Unknown pages return a simple 404 with discovered page links.

## Templates

Template resolution per page:

1. `index.html` colocated next to the entry (preferred)
2. Shared default template specified by `template` option (if exists)
3. Built-in minimal fallback

The final HTML gets the entry `<script type="module">` injected right before `</body>` (idempotent). If `</body>` is missing, the script tag is appended to the end.

## Dev behavior

- The plugin generates HTML (with injected script) and then calls `server.transformIndexHtml(url, html)`.
- The `<script>` `src` respects `server.config.base` (e.g., `/subapp/`) so dev paths remain correct.
- Basic in-memory caches avoid redundant template reads and HTML assembly; the cache is invalidated on `*.html` changes.

## Build behavior

- Each discovered page is registered as a virtual `.html` input:
  - `rollupOptions.input` becomes `{ [name]: `${name}.html` }`
  - Nested names are supported (e.g., `admin/dashboard`)
- The plugin injects the entry script during `load()` for those virtual HTML modules, ensuring each page is a proper entry for Rollup.

## Options

```ts
interface Options {
  /**
   * Directory containing page entries.
   * Default: "src/pages"
   */
  pages?: string

  /**
   * Entry file name(s) to search for.
   * Accepts a string or an array (e.g., ["main.tsx","main.ts","main.jsx","main.js"]).
   * Default: "main.ts"
   */
  entry?: string | string[]

  /**
   * Default HTML template file path used when a page has no colocated index.html.
   * Default: "src/index.html"
   */
  template?: string
}
```

## Tips

- Multiple entry file names:
  - Pass an array to `entry`, e.g. `entry: ['main.tsx', 'main.ts', 'main.jsx', 'main.js']`
- Base path:
  - In dev, script `src` is prefixed with `base`; in build, Vite rewrites assets and paths appropriately
- Physical HTML inputs (advanced):
  - If you need other HTML plugins to operate during build, switch to generating physical HTML files in a temp folder and set them as Rollup inputs, using `transformIndexHtml` for injection. This ensures full HTML pipeline execution.

## FAQ

- Why are my output HTML files very small in build?
  - That’s normal. They mainly contain your template plus a module script; assets are emitted separately by Vite/Rollup.
- Can I have nested pages?
  - Yes. A page named `admin/dashboard` will produce `dist/admin/dashboard.html` (depending on bundler behavior and input config).
- Does the plugin support SSR?
  - No, this plugin focuses on classic MPA builds.

## Similar Plugins / Inspiration

- [vite-plugin-mpa](https://github.com/IndexXuan/vite-plugin-mpa)
- [vite-plugin-html-template](https://github.com/IndexXuan/vite-plugin-html-template)
- [vite-plugin-html](https://github.com/vbenjs/vite-plugin-html)
- [vite-plugin-virtual-html](https://github.com/windsonR/vite-plugin-virtual-html)
- [vite-plugin-virtual-mpa](https://github.com/emosheeep/vite-plugin-virtual-mpa)

Thanks to these projects for inspiration.

## License

MIT
