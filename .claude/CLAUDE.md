# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vue 2 微前端 **pnpm monorepo**，基于 **EMP 3.x**（底层使用 Rspack）构建，采用 Module Federation 实现跨应用组件加载。纯 JavaScript 项目（无 TypeScript）。

包含 3 个微前端应用：
- **app-a**（Host 主应用，端口 9002）— 通过 remotes 消费 app-b、app-c 的组件
- **app-b**（Remote 子应用，端口 9003）— 暴露 MultiCalc 乘法计算器组件
- **app-c**（Remote 子应用，端口 9004）— 暴露 TodoList 待办列表组件

## Commands

```bash
# 根目录命令
pnpm install          # 安装所有工作区依赖
pnpm dev              # 并行启动全部 3 个应用
pnpm build            # 构建全部应用

# 单应用命令（在各 packages/app-* 目录下）
pnpm dev              # 启动开发服务器 (支持 HMR)
pnpm build            # 生产构建 (输出到 dist/)
pnpm start            # 本地预览生产构建
pnpm stat             # 构建并启动 bundle 分析器
```

包管理器：**pnpm**（monorepo 使用 pnpm-workspace.yaml）。

## Architecture

### 目录结构

```
emp-learn/
├── pnpm-workspace.yaml
├── package.json
├── packages/
│   ├── app-a/                      (Host, 端口 9002)
│   │   ├── emp-config.js           (remotes: appB, appC)
│   │   └── src/
│   │       ├── main.js → bootstrap.js (异步入口)
│   │       ├── router.js           (vue-router 配置)
│   │       ├── App.vue             (导航栏 + router-view)
│   │       └── views/Home.vue      (加载远程组件)
│   ├── app-b/                      (Remote, 端口 9003)
│   │   ├── emp-config.js           (exposes: ./MultiCalc)
│   │   └── src/components/
│   │       └── MultiCalc.vue       (使用 lodash-es)
│   └── app-c/                      (Remote, 端口 9004)
│       ├── emp-config.js           (exposes: ./TodoList)
│       └── src/components/
│           └── TodoList.vue        (增删改查 + 筛选)
```

### 构建系统

- **EMP CLI** (`@empjs/cli`) — 基于 Rspack 的构建工具，配置文件为 `emp-config.js`（非 webpack/vite）
- **`@empjs/plugin-vue2`** — Vue 2 框架适配插件
- **`@empjs/share` / `pluginRspackEmpShare`** — Module Federation 插件，处理微前端间的模块共享

### Module Federation 配置

每个应用在 `emp-config.js` 中通过 `pluginRspackEmpShare` 配置：

- **MF 容器名**：`appA`/`appB`/`appC`（必须是合法 JS 标识符，不能用连字符）
- **Remote 入口文件**：`emp.js`（EMP 默认的 MF filename）
- **remotes 格式**：`'appB@http://localhost:9003/emp.js'`（标准 `name@url` 格式）
- **共享依赖**通过 CDN 外部化加载（Vue、Vuex、Element UI 均从 unpkg 加载），三个应用的 `empRuntime` 配置完全一致
- **框架适配器**：`framework: 'vue2'`

### 入口加载流程

```
main.js → import('./bootstrap') → bootstrap.js → Vue 实例挂载到 #emp-root
```

`main.js` 使用动态 `import()` 加载 `bootstrap.js`，这是 Module Federation 所需的异步入口模式，确保共享依赖在应用初始化前完成加载。

### 依赖策略

| 依赖 | 策略 | 原因 |
|------|------|------|
| vue / vuex / element-ui | CDN 外部化 (shareLib) | 三个应用共享，只加载一次 |
| vue-router | 仅 app-a，打包进 bundle | 子应用不需要路由 |
| lodash-es | 仅 app-b，打包进 bundle | tree-shaking 后只包含 multiply/round |

### Vue 2 约定

- 使用 **Options API**（非 Composition API）
- 单文件组件 `.vue`，样式使用 **scoped SCSS**
- 挂载点为 `#emp-root`（EMP 默认，非 Vue CLI 的 `#app`）

## Troubleshooting

### `module.exports = .Vue` 语法错误

**现象**：`pnpm dev` 后页面报错 `Uncaught SyntaxError: Unexpected token '.'`，构建产物中出现 `module.exports = .Vue;`。

**根因**：`@empjs/share` 的 `setExternal` 方法使用 `` `${this.fk.global}.${o.global}` `` 拼接 externals。`this.fk.global` 取自 `empRuntime.frameworkGlobal`，若未配置则为空字符串，导致生成 `.Vue` 而非 `window.Vue`。

**修复**：在 `emp-config.js` 的 `empRuntime` 中添加 `frameworkGlobal: 'window'`。

### 注意事项

- `empRuntime.runtimeLib` 的 CDN 版本号必须与实际安装的 `@empjs/share` 版本一致（通过 `node_modules/@empjs/share/package.json` 查看实际版本）
- `shareLib` 中的格式为 `GlobalVar@CDN_URL`，`@` 前是全局变量名，`@` 后是 CDN 地址，插件内部通过正则 `/^([0-9a-zA-Z_\s]+)@(.*)/` 解析，不会被 URL 中的 `@` 干扰
- 三个应用的 `empRuntime` 配置必须完全一致，否则 CDN 共享依赖可能重复加载
