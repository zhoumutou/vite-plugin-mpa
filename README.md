# @zhoumutou/vite-plugin-mpa

A Vite plugin for Multi-Page Applications (MPA) that automatically configures entry points, handles HTML templates, and sets up development server routing.

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
import vue from '@vitejs/plugin-vue'
import mpa from '@zhoumutou/vite-plugin-mpa'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    mpa({
      // options (optional)
    })
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

## Configuration

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

## TypeScript Support

This plugin is written in TypeScript and includes type definitions.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

- **zhoumutou** - [GitHub](https://github.com/zhoumutou)

---

Made with ❤️ for better Vite MPA experiences.
