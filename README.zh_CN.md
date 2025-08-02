# @zhoumutou/vite-plugin-mpa

[![npm version](https://img.shields.io/npm/v/@zhoumutou/vite-plugin-mpa.svg)](https://www.npmjs.com/package/@zhoumutou/vite-plugin-mpa)
[![weekly downloads](https://img.shields.io/npm/dw/@zhoumutou/vite-plugin-mpa)](https://www.npmjs.com/package/@zhoumutou/vite-plugin-mpa)
[![license](https://img.shields.io/npm/l/@zhoumutou/vite-plugin-mpa)](https://github.com/zhoumutou/vite-plugin-mpa/blob/main/LICENSE)
[![install size](https://packagephobia.com/badge?p=@zhoumutou/vite-plugin-mpa)](https://packagephobia.com/result?p=@zhoumutou/vite-plugin-mpa)

一个用于多页面应用程序(MPA)的Vite插件，自动配置入口点，处理HTML模板，并设置开发服务器路由。

[English](/README.md) | 中文

## 特性

- 🚀 **零配置**：使用默认设置即可开箱即用
- 📂 **自动发现**：自动查找并配置所有入口点
- 🔄 **开发与构建**：同时支持开发和生产模式
- 📄 **模板处理**：自动管理HTML模板
- 💾 **缓存机制**：高效的缓存系统提升性能

## 安装

```bash
# npm
npm install @zhoumutou/vite-plugin-mpa -D

# yarn
yarn add @zhoumutou/vite-plugin-mpa -D

# pnpm
pnpm add @zhoumutou/vite-plugin-mpa -D
```

## 使用方法

在你的`vite.config.ts`中添加插件：

```typescript
import vue from '@vitejs/plugin-vue'
import mpa from '@zhoumutou/vite-plugin-mpa'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    mpa({
      // 选项（可选）
    })
  ]
})
```

## 项目结构

默认情况下，插件会在`src/pages`目录中查找入口文件：

```
src/
├── pages/
│   ├── index/
│   │   ├── main.ts         # index页面的入口文件
│   │   └── index.html      # （可选）index页面的自定义模板
│   ├── about/
│   │   └── main.ts         # about页面的入口文件
│   └── user/
│       └── main.ts         # user页面的入口文件
└── index.html              # （可选）备用模板
```

这个设置将生成以下页面：

- `index.html`（可通过`/`访问）
- `about.html`（可通过`/about`访问）
- `user.html`（可通过`/user`访问）

## 配置

插件接受以下选项：

```typescript
interface Options {
  /** 包含页面入口的目录（默认：'src/pages'） */
  pagesDir?: string

  /** 入口文件的文件名模式（默认：'main.ts'） */
  entryFile?: string

  /** 自定义默认HTML模板（默认：'src/index.html'） */
  template?: string
}
```

### 使用自定义选项的示例

```typescript
mpa({
  pagesDir: 'src/views',
  entryFile: 'app.ts',
})
```

## 工作原理

该插件：

1. **开发模式**：
   - 设置中间件为每个页面提供HTML服务
   - 转换HTML内容以注入入口脚本
   - 处理热模块替换

2. **生产模式**：
   - 为每个页面配置Rollup入口点
   - 为每个页面生成HTML文件
   - 注入正确的脚本引用

## 类似插件/灵感来源

本插件受到以下优秀项目的启发和参考：

- [vite-plugin-mpa](https://github.com/IndexXuan/vite-plugin-mpa) - Vite的开箱即用多页应用插件
- [vite-plugin-html-template](https://github.com/IndexXuan/vite-plugin-html-template) - Vite的HTML模板插件
- [vite-plugin-html](https://github.com/vbenjs/vite-plugin-html) - 用于处理HTML的Vite插件
- [vite-plugin-virtual-html](https://github.com/windsonR/vite-plugin-virtual-html) - 启用虚拟HTML文件的Vite插件
- [vite-plugin-virtual-mpa](https://github.com/emosheeep/vite-plugin-virtual-mpa) - 支持虚拟HTML的Vite开箱即用MPA插件

感谢所有这些项目提供的宝贵参考和灵感。
