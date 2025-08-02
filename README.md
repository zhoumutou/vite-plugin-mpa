# @zhoumutou/vite-plugin-mpa

[![npm version](https://img.shields.io/npm/v/@zhoumutou/vite-plugin-mpa.svg)](https://www.npmjs.com/package/@zhoumutou/vite-plugin-mpa)
[![weekly downloads](https://img.shields.io/npm/dw/@zhoumutou/vite-plugin-mpa)](https://www.npmjs.com/package/@zhoumutou/vite-plugin-mpa)
[![license](https://img.shields.io/npm/l/@zhoumutou/vite-plugin-mpa)](https://github.com/zhoumutou/vite-plugin-mpa/blob/main/LICENSE)
[![install size](https://packagephobia.com/badge?p=@zhoumutou/vite-plugin-mpa)](https://packagephobia.com/result?p=@zhoumutou/vite-plugin-mpa)

A Vite plugin for Multi-Page Applications (MPA) that automatically configures entry points, handles HTML templates, and sets up development server routing.

English | [中文](./README.zh_CN.md)

## Features

- 🚀 **Zero Configuration**: Works out of the box with default settings
- 📂 **Auto-discovery**: Automatically finds and configures all entry points
- 🔄 **Dev & Build**: Supports both development and production modes
- 📄 **Template Handling**: Automatically manages HTML templates
- 💾 **Caching**: Efficient caching system for improved performance

## Installation

```bash
# npm
npm install @zhoumutou/vite-plugin-mpa -D

# yarn
yarn add @zhoumutou/vite-plugin-mpa -D

# pnpm
pnpm add @zhoumutou/vite-plugin-mpa -D
```

## Usage

Add the plugin to your `vite.config.ts`:

```typescript
import mpa from '@zhoumutou/vite-plugin-mpa'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    mpa()
  ]
})
```

## Project Structure

By default, the plugin looks for entry files in `src/pages` directory:

```
src/
├── pages/
│   ├── index/
│   │   ├── main.ts         # Entry file for index page
│   │   └── index.html      # (Optional) Custom template for index page
│   ├── about/
│   │   └── main.ts         # Entry file for about page
│   └── user/
│       └── main.ts          # Entry file for user page
└── index.html                # (Optional) Fallback template
```

This setup will generate the following pages:

- `index.html` (accessible as `/`)
- `about.html` (accessible as `/about`)
- `user.html` (accessible as `/user`)

## Options

The plugin accepts the following options:

```typescript
interface Options {
  /** Directory containing page entries (default: 'src/pages') */
  pagesDir?: string

  /** Filename pattern for entry files (default: 'main.ts') */
  entryFile?: string

  /** Custom default HTML template (default: 'src/index.html') */
  template?: string
}
```

### Example with custom options

```typescript
mpa({
  pagesDir: 'src/views',
  entryFile: 'app.ts',
})
```

## How It Works

The plugin:

1. **Development mode**:
   - Sets up middleware to serve HTML for each page
   - Transforms HTML content to inject entry scripts
   - Handles hot module replacement

2. **Production mode**:
   - Configures Rollup with entry points for each page
   - Generates HTML files for each page
   - Injects correct script references

## Similar Plugins / Inspiration

This plugin was inspired by and references the following excellent projects:

- [vite-plugin-mpa](https://github.com/IndexXuan/vite-plugin-mpa) - Out-of-box multi-page application plugin for Vite
- [vite-plugin-html-template](https://github.com/IndexXuan/vite-plugin-html-template) - HTML template plugin for Vite
- [vite-plugin-html](https://github.com/vbenjs/vite-plugin-html) - A Vite plugin for processing HTML
- [vite-plugin-virtual-html](https://github.com/windsonR/vite-plugin-virtual-html) - A Vite plugin that enables virtual HTML files
- [vite-plugin-virtual-mpa](https://github.com/emosheeep/vite-plugin-virtual-mpa) - An out-of-box MPA plugin for Vite with virtual HTML support

Thanks to all these projects for providing valuable references and inspiration.
