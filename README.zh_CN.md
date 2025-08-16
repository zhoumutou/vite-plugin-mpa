# @zhoumutou/vite-plugin-mpa

[![npm version](https://img.shields.io/npm/v/@zhoumutou/vite-plugin-mpa.svg)](https://www.npmjs.com/package/@zhoumutou/vite-plugin-mpa)
[![weekly downloads](https://img.shields.io/npm/dw/@zhoumutou/vite-plugin-mpa)](https://www.npmjs.com/package/@zhoumutou/vite-plugin-mpa)
[![license](https://img.shields.io/npm/l/@zhoumutou/vite-plugin-mpa)](https://github.com/zhoumutou/vite-plugin-mpa/blob/main/LICENSE)
[![unpacked size](https://img.shields.io/npm/unpacked-size/%40zhoumutou%2Fvite-plugin-mpa)](https://www.npmjs.com/package/@zhoumutou/vite-plugin-mpa)

一个用于多页应用（MPA）的 Vite 插件

[English](/README.md) | 中文

## 特性

- 自动发现页面入口（如 `src/pages/**/main.ts`）
- 开发（dev）：
  - 通过自定义中间件返回 HTML
  - 调用 `server.transformIndexHtml` 以便其它插件参与 HTML 处理
  - 在 `</body>` 前注入 `<script type="module" src="...">`（幂等）
  - 未匹配页面返回包含页面清单的 404
- 构建（build）：
  - 将虚拟的 `.html` 输入暴露给 Rollup
  - 在 `load()` 阶段注入入口脚本，确保多入口产物稳定
- 模板解析：
  - 优先使用与入口同目录的 `index.html`
  - 否则使用共享的默认模板
  - 最后使用内置的模板兜底

## 安装

```bash
# npm
npm install @zhoumutou/vite-plugin-mpa -D

# yarn
yarn add @zhoumutou/vite-plugin-mpa -D

# pnpm
pnpm add @zhoumutou/vite-plugin-mpa -D
```

## 快速开始

```ts
import mpa from '@zhoumutou/vite-plugin-mpa'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    mpa({
      // 可选项
      // pages: 'src/pages',          // 扫描页面入口的目录
      // entry: 'main.ts',            // 要匹配的入口文件名（或数组）
      // template: 'src/index.html',  // 默认模板路径（当页面无同目录模板时使用）
    })
  ]
})
```

推荐目录结构：

```
src/
  pages/
    index/
      main.ts
      index.html        # 可选（与入口同目录的模板）
    admin/dashboard/
      main.ts
      index.html        # 可选
src/index.html          # 默认模板（可选）
```

## 模板

每个页面的模板解析顺序：

1. 入口同目录的 `index.html`（优先）
2. 配置项 `template` 指定的共享默认模板（存在时）
3. 插件内置的简易模板

最终会在 `</body>` 前注入页面入口的 `<script type="module">`（幂等）。若模板缺少 `</body>`，则将脚本追加到文末。

## 开发期行为

- 插件先生成注入脚本后的 HTML，再调用 `server.transformIndexHtml(url, html)`，使其他 HTML 插件有机会参与
- 注入脚本的 `src` 会遵从 `server.config.base`（如 `/subapp/`），确保开发期路径正确
- 内存缓存避免重复读取模板与组装 HTML；遇到 `*.html` 变更会失效

## 构建期行为

- 为每个发现的页面注册虚拟 `.html` 输入：
  - `rollupOptions.input` 的形态为 `{ [name]: `${name}.html` }`
  - 支持嵌套名称（如 `admin/dashboard`）
- 对这些虚拟 HTML 模块在 `load()` 中注入入口脚本，保证每个页面都作为 Rollup 的独立 HTML 入口

## 配置项

```ts
interface Options {
  /**
   * 页面入口所在目录
   * 默认值："src/pages"
   */
  pages?: string

  /**
   * 要匹配的入口文件名（或列表）
   * 可为字符串或字符串数组（如 ["main.tsx","main.ts","main.jsx","main.js"]）
   * 默认值："main.ts"
   */
  entry?: string | string[]

  /**
   * 当页面没有同目录模板时使用的默认 HTML 模板路径
   * 默认值："src/index.html"
   */
  template?: string
}
```

## 提示

- 多种入口文件名：
  - 将多个文件名以数组形式传入 `entry`，如 `entry: ['main.tsx', 'main.ts', 'main.jsx', 'main.js']`
- Base 路径：
  - 开发期注入的脚本 `src` 会自动加上 `base`；构建期由 Vite 负责重写资源与路径
- 进阶：物理 HTML 输入
  - 若需在构建期让其它 HTML 插件（含 `transformIndexHtml`）完整参与，可在临时目录生成物理 HTML 文件并将其作为 Rollup 输入，同时把脚本注入放到 `transformIndexHtml` 中执行

## 常见问题

- 为什么构建产出的 HTML 文件很小？
  - 正常现象。HTML 主要包含模板和一个模块脚本；实际静态资源由 Vite/Rollup 独立产出与加载
- 支持嵌套页面吗？
  - 支持。`admin/dashboard` 最终会产出 `dist/admin/dashboard.html`（受 bundler 配置影响）
- 支持 SSR 吗？
  - 不支持，本插件专注于经典 MPA 构建

## 相似插件 / 灵感来源

- [vite-plugin-mpa](https://github.com/IndexXuan/vite-plugin-mpa)
- [vite-plugin-html-template](https://github.com/IndexXuan/vite-plugin-html-template)
- [vite-plugin-html](https://github.com/vbenjs/vite-plugin-html)
- [vite-plugin-virtual-html](https://github.com/windsonR/vite-plugin-virtual-html)
- [vite-plugin-virtual-mpa](https://github.com/emosheeep/vite-plugin-virtual-mpa)

感谢以上项目带来的启发。

## 许可证

MIT
