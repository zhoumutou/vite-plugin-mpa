# @zhoumutou/vite-plugin-mpa

[![npm version](https://img.shields.io/npm/v/@zhoumutou/vite-plugin-mpa.svg)](https://www.npmjs.com/package/@zhoumutou/vite-plugin-mpa)
[![weekly downloads](https://img.shields.io/npm/dw/@zhoumutou/vite-plugin-mpa)](https://www.npmjs.com/package/@zhoumutou/vite-plugin-mpa)
[![license](https://img.shields.io/npm/l/@zhoumutou/vite-plugin-mpa)](https://github.com/zhoumutou/vite-plugin-mpa/blob/main/LICENSE)
[![install size](https://packagephobia.com/badge?p=@zhoumutou/vite-plugin-mpa)](https://packagephobia.com/result?p=@zhoumutou/vite-plugin-mpa)

一个用于多页应用（MPA）的 Vite 插件：自动发现每页入口、把脚本注入到 HTML，并贯通开发/构建流程。

[English](/README.md) | 中文

## 特性

- 🚀 开箱即用，无需配置
- 📂 自动发现：默认查找 `src/pages/**/main.ts`
- 🔄 开发与构建：开发中使用中间件；构建时提供虚拟 HTML 入口
- 📄 模板处理：优先使用页面本地 `index.html`，否则使用全局模板
- 💾 缓存：开发环境缓存模板与最终 HTML，减少 I/O

## 安装

```bash
# npm
npm install @zhoumutou/vite-plugin-mpa -D

# yarn
yarn add @zhoumutou/vite-plugin-mpa -D

# pnpm
pnpm add @zhoumutou/vite-plugin-mpa -D
```

Peer dependency: Vite 4+.

## 使用方法

在 `vite.config.ts` 中添加插件：

```ts
import mpa from '@zhoumutou/vite-plugin-mpa'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    mpa()
  ]
})
```

## 项目结构

默认从 `src/pages` 中查找入口文件：

```
src/
├── pages/
│   ├── index/
│   │   ├── main.ts         # index 页入口
│   │   └── index.html      # （可选）页面本地模板
│   ├── about/
│   │   └── main.ts         # about 页入口
│   └── user/
│       └── main.ts         # user 页入口
└── index.html              # （可选）全局兜底模板
```

将生成并提供以下页面：

- `index.html`（访问路径 `/`）
- `about.html`（访问路径 `/about`）
- `user.html`（访问路径 `/user`）

## 配置项

```ts
interface Options {
  /** 页面入口所在目录（默认：'src/pages'） */
  pages?: string

  /** 每个页面目录下的入口文件名（默认：'main.ts'） */
  entry?: string

  /** 全局兜底 HTML 模板（默认：'src/index.html'） */
  template?: string
}
```

### 自定义示例

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

## 工作原理

开发（serve）：

- 设置 `appType: "mpa"`。
- 通过中间件动态返回 HTML，并调用 `server.transformIndexHtml` 参与 Vite 的 HTML 转换流水线。
- 在 `</body>` 前注入页面入口脚本：
  `<script type="module" src="/src/pages/<page>/main.ts"></script>`
- 监听 `.html` 变更并清理模板/最终 HTML 缓存。

构建（build）：

- 为每个页面暴露虚拟的 `.html` 入口（使用 `resolveId/load`）。
- 为这些入口生成并加载对应 HTML（包含已注入的脚本）。
- 交由 Vite/Rollup 按页面入口进行打包。

## 备注

- 注入到 HTML 的 `<script src>` 统一转换为 POSIX 路径（正斜杠），跨平台更稳定。
- 目录遍历使用 `readdirSync(..., { withFileTypes: true })`（Dirent）以减少多余的 `stat` 调用。
- 模板优先级：页面本地 `index.html` > 全局 `template` > 内置最小模板；最终 HTML 会在 `</body>` 前注入入口脚本。

## 相似插件 / 灵感来源

- [vite-plugin-mpa](https://github.com/IndexXuan/vite-plugin-mpa)
- [vite-plugin-html-template](https://github.com/IndexXuan/vite-plugin-html-template)
- [vite-plugin-html](https://github.com/vbenjs/vite-plugin-html)
- [vite-plugin-virtual-html](https://github.com/windsonR/vite-plugin-virtual-html)
- [vite-plugin-virtual-mpa](https://github.com/emosheeep/vite-plugin-virtual-mpa)

感谢以上项目带来的启发。

## 许可证

MIT
