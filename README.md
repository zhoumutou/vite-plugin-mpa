# @zhoumutou/vite-plugin-mpa

[![npm version](https://img.shields.io/npm/v/@zhoumutou/vite-plugin-mpa.svg)](https://www.npmjs.com/package/@zhoumutou/vite-plugin-mpa)
[![weekly downloads](https://img.shields.io/npm/dw/@zhoumutou/vite-plugin-mpa)](https://www.npmjs.com/package/@zhoumutou/vite-plugin-mpa)
[![license](https://img.shields.io/npm/l/@zhoumutou/vite-plugin-mpa)](https://github.com/zhoumutou/vite-plugin-mpa/blob/main/LICENSE)
[![install size](https://packagephobia.com/badge?p=@zhoumutou/vite-plugin-mpa)](https://packagephobia.com/result?p=@zhoumutou/vite-plugin-mpa)

A Vite plugin for Multi-Page Applications (MPA) that auto-discovers entries, injects per-page scripts into HTML, and wires dev/build flows.

English | [中文](./README.zh_CN.md)

## Features

- 🚀 Zero configuration: works out of the box
- 📂 Auto-discovery: finds `src/pages/**/main.ts` by default
- 🔄 Dev & Build: dev middleware + Rollup virtual HTML inputs
- 📄 Template handling: per-page `index.html` or global fallback
- 💾 Caching: template and HTML caches in dev

## Installation

```bash
# npm
npm install @zhoumutou/vite-plugin-mpa -D

# yarn
yarn add @zhoumutou/vite-plugin-mpa -D

# pnpm
pnpm add @zhoumutou/vite-plugin-mpa -D
```

Peer dependency: Vite 4+.

## Usage

Add the plugin to your `vite.config.ts`:

```ts
import mpa from '@zhoumutou/vite-plugin-mpa'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    mpa()
  ]
})
```

## Project Structure

By default, the plugin looks for entry files in `src/pages`:

```
src/
├── pages/
│   ├── index/
│   │   ├── main.ts         # Entry for index page
│   │   └── index.html      # (Optional) Page-local template
│   ├── about/
│   │   └── main.ts         # Entry for about page
│   └── user/
│       └── main.ts         # Entry for user page
└── index.html              # (Optional) Global fallback template
```

This setup produces:

- `index.html` (served at `/`)
- `about.html` (served at `/about`)
- `user.html` (served at `/user`)

## Options

```ts
interface Options {
  /** Directory containing page entries (default: 'src/pages') */
  pages?: string

  /** Filename pattern for entry files (default: 'main.ts') */
  entry?: string

  /** Global fallback HTML template (default: 'src/index.html') */
  template?: string
}
```

### Example with custom options

```ts
import mpa from '@zhoumutou/vite-plugin-mpa'

export default {
  plugins: [
    mpa({
      pages: 'src/views',
      entry: 'app.ts',
      template: 'src/index.html',
    })
  ]
}
```

## How It Works

Dev (serve):

- Sets `appType: "mpa"`.
- Serves HTML via a middleware, then runs `server.transformIndexHtml`.
- Injects the page entry before `</body>`:
  `<script type="module" src="/src/pages/<page>/main.ts"></script>`
- Caches template content and final HTML; clears caches on `.html` changes.

Build (prod):

- Exposes per-page virtual `.html` as Rollup inputs (`resolveId/load`).
- Resolves and loads HTML for each page (with injected entry).
- Lets Vite/Rollup bundle each page entry as usual.

## Notes

- Injected `<script src>` is normalized to POSIX (forward slashes) for consistent HTML on all platforms.
- Directory traversal uses `readdirSync(..., { withFileTypes: true })` (Dirent) for fewer `stat` calls.
- If a page-local `index.html` exists next to the entry, it is preferred; otherwise the global `template` is used; if neither exists, a built-in minimal HTML template is used.

## Similar Plugins / Inspiration

- [vite-plugin-mpa](https://github.com/IndexXuan/vite-plugin-mpa)
- [vite-plugin-html-template](https://github.com/IndexXuan/vite-plugin-html-template)
- [vite-plugin-html](https://github.com/vbenjs/vite-plugin-html)
- [vite-plugin-virtual-html](https://github.com/windsonR/vite-plugin-virtual-html)
- [vite-plugin-virtual-mpa](https://github.com/emosheeep/vite-plugin-virtual-mpa)

Thanks to these projects for inspiration.

## License

MIT
