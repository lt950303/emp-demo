# Webpack 打包原理与微前端技术深度解析

---

## 目录

1. [Webpack 打包原理](#1-webpack-打包原理)
2. [Webpack 辅助代码的作用](#2-webpack-辅助代码的作用)
3. [动态 script 标签的残留](#3-动态-script-标签的残留)
4. [模块联邦的核心原理](#4-模块联邦的核心原理)
5. [模块联邦的污染问题与流行原因](#5-模块联邦的污染问题与流行原因)
6. [qiankun 与 Single-SPA 的共享方式](#6-qiankun-与-single-spa-的共享方式)
7. [三者核心共性](#7-三者核心共性)
8. [三者的对比总结](#8-三者的对比总结)
9. [海外开发者的偏好](#9-海外开发者的偏好)
10. [前端专家解决污染的方法](#10-前端专家解决污染的方法)
11. [eager: true 的作用](#11-eager-true-的作用)
12. ["window 上的装载函数"](#12-window-上的装载函数)
13. [依赖 window 挂载全局变量的细节](#13-依赖-window-挂载全局变量的细节)

---

## 1. Webpack 打包原理

### 1.1 从入口出发的依赖收集

Webpack 的核心工作流程是 **以入口文件为起点，递归构建依赖图（Dependency Graph）**：

```
entry.js
  ├── import './moduleA.js'
  │     ├── import './utils.js'
  │     └── import 'lodash'
  └── import './moduleB.vue'
        ├── <template> → vue-template-compiler
        ├── <script> → babel-loader
        └── <style lang="scss"> → sass-loader → css-loader → style-loader
```

**具体步骤：**

1. **初始化**：读取 `webpack.config.js`，合并 CLI 参数，创建 `Compiler` 实例
2. **编译（make）**：从 `entry` 开始调用 `loader` 转译文件，使用 `acorn` 将代码解析为 AST
3. **分析依赖**：遍历 AST 找到所有 `import` / `require` 语句，收集依赖路径
4. **递归处理**：对每个依赖文件重复步骤 2-3，直到所有文件都被处理
5. **生成 chunk**：根据入口和动态 `import()` 将模块分组为 chunk
6. **输出（emit）**：将 chunk 转为最终文件写入磁盘

### 1.2 不同类型文件的处理 — Loader 链

Webpack 本身**只理解 JavaScript 和 JSON**。其他类型的文件通过 **Loader** 转译：

```
.vue 文件处理链：
  vue-loader → 拆分为 template / script / style 三个虚拟模块
    ├── template → vue-template-compiler → render 函数（JS）
    ├── script → babel-loader → ES5 JS
    └── style → sass-loader → css-loader → style-loader → JS（运行时注入 <style>）

.png 文件处理链：
  file-loader → 输出文件并返回 URL 字符串（JS）
  或 url-loader → 小文件转 base64 data URL（JS）
```

**关键理解**：所有 Loader 的最终产出都是 JavaScript，Webpack 将整个世界统一为 JS 模块。

### 1.3 Chunk 拆分后为何能有序执行

Webpack 将代码拆分为多个 chunk 后，通过 **runtime（运行时代码）** 保证执行顺序：

```
dist/
  ├── runtime.js        ← 模块加载器（最先执行）
  ├── vendor.js          ← 第三方库 chunk
  ├── main.js            ← 业务入口 chunk
  └── async-page.js      ← 懒加载 chunk
```

**有序执行的机制：**

1. **HTML 中的初始 chunk** 通过 `<script>` 标签按顺序加载，runtime 最先执行
2. **runtime 维护一个全局的 chunk 注册表**（`webpackJsonp` / `webpackChunk`），每个 chunk 加载后会调用注册函数
3. **runtime 跟踪所有 chunk 的加载状态**（未加载 / 加载中 / 已加载），确保依赖的 chunk 全部就绪后才执行入口模块
4. **懒加载 chunk** 通过 `__webpack_require__.e()` 动态创建 `<script>` 标签加载，返回 Promise，加载完成后 resolve

```
执行时序：
  1. runtime.js 执行 → 注册 __webpack_require__ 等基础设施
  2. vendor.js 执行 → 调用 webpackChunk.push() 注册模块，但不执行模块代码
  3. main.js 执行 → 注册模块 + 触发入口模块的执行
  4. 入口模块通过 __webpack_require__ 按需拉取其他模块
```

---

## 2. Webpack 辅助代码的作用

### 2.1 辅助代码全景

Webpack 产出的 bundle 中，除了业务代码，还有大量 **runtime 辅助代码**。这些代码实现了一个**浏览器端的模块系统**：

```javascript
// ======== Webpack Runtime 核心结构（简化版） ========

// 1. 模块注册表 — 所有模块以 moduleId 为 key 存放
var __webpack_modules__ = {
  "./src/utils.js": function(module, exports, __webpack_require__) {
    // 原始的 utils.js 代码被包裹在这个函数中
    var lodash = __webpack_require__("lodash");
    module.exports = { add: function(a, b) { return lodash.add(a, b); } };
  },
  // ...更多模块
};

// 2. 模块缓存 — 避免重复执行
var __webpack_module_cache__ = {};

// 3. 核心加载函数 — 替代浏览器原生的 import/require
function __webpack_require__(moduleId) {
  // 命中缓存直接返回
  if (__webpack_module_cache__[moduleId]) {
    return __webpack_module_cache__[moduleId].exports;
  }
  // 创建新 module 对象
  var module = __webpack_module_cache__[moduleId] = { exports: {} };
  // 执行模块函数
  __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
  // 返回 exports
  return module.exports;
}

// 4. 异步 chunk 加载函数
__webpack_require__.e = function(chunkId) {
  return Promise.all(/* 加载所有需要的 chunk */);
};

// 5. chunk 注册回调（供其他 chunk 文件调用）
var webpackJsonpCallback = function(data) {
  // 将新 chunk 中的模块合并到 __webpack_modules__
  // 标记 chunk 为已加载
  // resolve 等待中的 Promise
};

// 6. 启动入口
__webpack_require__("./src/main.js");
```

### 2.2 各辅助函数的职责

| 辅助代码 | 作用 |
|---------|------|
| `__webpack_require__(id)` | 同步加载模块，等价于 `require()` |
| `__webpack_require__.e(chunkId)` | 异步加载 chunk（返回 Promise） |
| `__webpack_require__.r(exports)` | 标记为 ES Module（`Symbol.toStringTag`） |
| `__webpack_require__.d(exports, definition)` | 定义 ES Module 的导出（getter 形式，支持 live binding） |
| `__webpack_require__.o(obj, prop)` | `Object.prototype.hasOwnProperty` 简写 |
| `__webpack_require__.n(module)` | 兼容 CJS/ESM 的 default 导出 |
| `__webpack_require__.t(value, mode)` | 创建虚拟命名空间对象 |
| `__webpack_require__.l(url, done)` | 动态创建 `<script>` 标签加载远程脚本 |
| `webpackChunk.push()` | chunk 注册入口（JSONP 回调机制） |

### 2.3 代码片段为何能正常执行

核心答案：**每个 chunk 并非独立程序，而是向 runtime 注册模块的"数据包"**。

```javascript
// vendor.chunk.js — 不是自执行的代码，而是调用全局注册函数
(self["webpackChunk"] = self["webpackChunk"] || []).push([
  ["vendor"],                    // chunk 名
  {                               // 该 chunk 包含的模块
    "node_modules/lodash/index.js": function(module) {
      // lodash 源码...
    }
  }
]);
```

当这个文件被浏览器加载后：
1. `self["webpackChunk"].push()` 被调用
2. runtime 之前已重写了 `push` 方法为 `webpackJsonpCallback`
3. runtime 将模块合并到全局 `__webpack_modules__`
4. runtime 检查是否有等待该 chunk 的 Promise，如有则 resolve

**所以拆包后的代码能正常执行，是因为 runtime 充当了"中央调度器"，所有 chunk 都是向这个调度器注册模块的载体。**

---

## 3. 动态 script 标签的残留

### 3.1 结论：会残留在 DOM 中

无论是模块联邦还是 `import()` 懒加载，动态创建的 `<script>` 标签**加载完成后会保留在 `<head>` 中**，不会被自动移除。

### 3.2 原因

```javascript
// Webpack runtime 中 __webpack_require__.l 的简化实现
__webpack_require__.l = function(url, done, key, chunkId) {
  var script = document.createElement('script');
  script.src = url;
  script.onload = script.onerror = function() {
    script.onload = script.onerror = null;  // 清理事件监听
    // 注意：这里没有 script.remove() 或 script.parentNode.removeChild(script)
    done();
  };
  document.head.appendChild(script);
};
```

**为什么不移除：**

1. **浏览器缓存依赖**：虽然脚本内容已执行并保存在模块缓存中，但 `<script>` 标签的存在帮助浏览器 DevTools 展示正确的源文件映射（Source Map）
2. **避免重复加载**：Webpack runtime 通过检查已存在的 `<script>` 标签的 `src` 属性来判断脚本是否已加载（作为 fallback 检查）
3. **性能无影响**：空的 `<script>` 标签（已执行完毕）对内存几乎没有影响，DOM 中多几个元素节点的开销可忽略不计
4. **调试友好**：保留标签方便开发者在 DevTools 的 Elements 面板中观察加载了哪些 chunk

### 3.3 手动清理

如果出于洁癖或特殊需求，可以在加载完成后手动移除：

```javascript
// 不建议在生产中使用，仅作说明
document.querySelectorAll('script[src*="chunk"]').forEach(s => {
  if (s.src && s.readyState !== 'loading') s.remove();
});
```

但实际项目中**没有必要这样做**，因为模块代码已在内存中的 `__webpack_module_cache__` 里，移除标签不会释放有意义的内存。

---

## 4. 模块联邦的核心原理

### 4.1 一句话概括

模块联邦（Module Federation）让**多个独立构建的应用在浏览器运行时共享模块**，本质是 **Webpack 模块系统的跨应用扩展**。

### 4.2 两个核心角色

```
┌──────────────────┐                ┌──────────────────┐
│   Host（消费方）   │   ──加载──→   │  Remote（提供方）  │
│                  │                │                  │
│  remotes: {      │                │  exposes: {      │
│    app2: '...'   │                │    './Button':   │
│  }               │                │    './src/Button'│
│                  │                │  }               │
│  import('app2/   │  ←──返回模块── │                  │
│    Button')      │                │  filename:       │
│                  │                │    'remoteEntry.js│
└──────────────────┘                └──────────────────┘
```

### 4.3 加载流程详解

```
步骤 1：Host HTML 加载 → Host runtime 初始化

步骤 2：Host 代码执行 import('app2/Button')
         ↓
步骤 3：Host runtime 发现 'app2' 是远程模块
         ↓
步骤 4：动态创建 <script src="http://app2.com/remoteEntry.js">
         ↓
步骤 5：remoteEntry.js 执行，在 window 上挂载容器对象
         window["app2"] = {
           get(moduleName) { return Promise<moduleFactory> },
           init(shareScope) { /* 初始化共享依赖 */ }
         }
         ↓
步骤 6：Host 调用 window["app2"].init(shareScope)
         → 将 Host 的共享依赖（如 React）传递给 Remote
         → Remote 检查版本是否兼容，决定复用还是加载自己的
         ↓
步骤 7：Host 调用 window["app2"].get("./Button")
         → Remote 返回 Button 模块的工厂函数
         ↓
步骤 8：Host 执行工厂函数，获得 Button 组件
         → 像使用本地组件一样使用
```

### 4.4 remoteEntry.js 的内部结构

```javascript
// remoteEntry.js（简化版） — Remote 应用的"联邦入口"
var app2;

// IIFE 立即执行
(() => {
  var modules = { /* Remote 暴露的模块 */ };
  var cache = {};

  function require(id) { /* 标准 webpack require */ }

  // 向外暴露两个方法
  app2 = {
    // get: 获取指定模块
    get: function(module) {
      return require.e(module).then(() => {
        return () => require(module);
      });
    },
    // init: 接收 Host 的 shareScope，用于共享依赖
    init: function(shareScope) {
      require.S = shareScope;
      // 将自己的共享模块也注册到 shareScope
    }
  };
})();
```

### 4.5 共享依赖的协商机制

```
Host shareScope = {
  "react": {
    "18.2.0": { get: () => React, loaded: true }
  },
  "react-dom": {
    "18.2.0": { get: () => ReactDOM, loaded: true }
  }
}

Remote init(shareScope) 时：
  → 检查 shareScope["react"]["18.2.0"]
  → 版本匹配（满足 semver 范围）→ 复用 Host 的 React
  → 版本不匹配 → 加载自己打包的 React（fallback）
```

这个机制确保了：**相同版本的依赖只加载一次，版本不兼容时各自加载互不干扰**。

---

## 5. 模块联邦的污染问题与流行原因

### 5.1 存在的污染问题

| 污染类型 | 具体表现 |
|---------|---------|
| **JS 全局污染** | 远程模块可以修改 `window`、`document`、全局事件监听器、定时器等 |
| **CSS 全局污染** | 远程模块的全局样式会影响 Host 和其他 Remote 的样式 |
| **DOM 污染** | 远程模块可以操作任意 DOM 节点，不限于自己的挂载点 |
| **事件污染** | 全局事件监听（scroll、resize、popstate）可能冲突 |

### 5.2 没有沙箱也能流行的原因

**1. 场景匹配 — 大多数使用场景不需要强隔离**

模块联邦的典型使用场景是**同一团队或同一组织内的多个应用**，这些应用：
- 使用相同的技术栈（React + AntD / Vue + Element）
- 遵循相同的编码规范
- 有统一的 CSS 方案（CSS Modules / CSS-in-JS）
- 由同一个团队或协作紧密的团队维护

在这种场景下，全局污染风险是**可控的**。

**2. 构建级集成 vs 运行时集成**

```
                    开发体验    性能    隔离性    复杂度
iframe              ★★☆☆☆    ★★★☆☆   ★★★★★   ★★★☆☆
qiankun(沙箱)       ★★★☆☆    ★★★☆☆   ★★★★☆   ★★★★☆
Module Federation   ★★★★★    ★★★★★   ★★☆☆☆   ★★☆☆☆
```

模块联邦的**开发体验和性能**远超其他方案：
- **零额外运行时开销**：组件就是普通模块，没有沙箱代理的性能损耗
- **TypeScript 类型支持**（MF 2.0）：远程模块有完整类型提示
- **HMR 支持**：修改远程模块代码，Host 实时热更新
- **Tree-shaking**：只加载远程模块中实际使用的导出

**3. "没有银弹"的务实选择**

- qiankun 的 JS 沙箱（Proxy）有性能开销且不完美（无法拦截所有副作用）
- iframe 的强隔离带来通信困难、样式割裂、SEO 不友好
- 模块联邦选择**不在框架层面解决隔离问题**，而是将其交给工程规范和具体方案

**4. Webpack 生态绑定优势**

Module Federation 内置于 Webpack 5（现在也支持 Rspack、Vite 等），无需额外安装框架。对于已有的 Webpack 项目，接入成本极低——只需在配置中添加 `ModuleFederationPlugin`。

---

## 6. qiankun 与 Single-SPA 的共享方式

### 6.1 Single-SPA

Single-SPA 是一个**路由级别的微前端框架**，不直接提供组件共享机制。

**应用级共享（Application）：**
```javascript
// 主应用注册子应用
singleSpa.registerApplication({
  name: 'app-react',
  app: () => System.import('http://localhost:3001/main.js'),
  activeWhen: '/react',  // 路由匹配时激活
});

// 子应用必须导出生命周期函数
export function bootstrap() { /* 初始化 */ }
export function mount(props) { /* 挂载到 DOM */ }
export function unmount(props) { /* 卸载 */ }
```

**组件级共享（Parcel）：**
```javascript
// Parcel — Single-SPA 的跨框架组件共享方案
// 比如在 Vue 应用中使用 React 写的组件
import Parcel from 'single-spa-react/parcel';

// 加载远程 parcel
const parcelConfig = () => System.import('@org/shared-header');

// 在 React 中使用
<Parcel config={parcelConfig} mountParcel={mountParcel} />
```

**依赖共享：** 通过 **Import Maps** 或 **SystemJS** 实现全局依赖共享：
```html
<script type="systemjs-importmap">
{
  "imports": {
    "react": "https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js",
    "react-dom": "https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"
  }
}
</script>
```

### 6.2 qiankun

qiankun 基于 Single-SPA 封装，增加了**沙箱、预加载、样式隔离**等能力。

**应用级共享：**
```javascript
import { registerMicroApps, start } from 'qiankun';

registerMicroApps([
  {
    name: 'sub-app',
    entry: '//localhost:7100',  // HTML 入口（非 JS 入口）
    container: '#container',
    activeRule: '/sub-app',
    props: { sharedData: store }  // 通过 props 传递共享数据
  }
]);
start();
```

**组件级共享 — 不是 qiankun 的设计目标**。qiankun 面向的是**页面/应用级**的集成，组件级共享需要配合其他方案：

```javascript
// 方案 1：通过全局状态共享（initGlobalState）
import { initGlobalState } from 'qiankun';
const actions = initGlobalState({ user: null });
actions.onGlobalStateChange((state) => console.log(state));
actions.setGlobalState({ user: { name: 'John' } });

// 方案 2：通过 props 向下传递组件
registerMicroApps([{
  props: {
    SharedComponent: MySharedComponent,  // 直接传递组件
    utils: sharedUtils
  }
}]);
```

### 6.3 对比

| 特性 | Single-SPA | qiankun |
|------|-----------|---------|
| 共享粒度 | 应用（Application）+ 组件（Parcel） | 应用（MicroApp） |
| 加载方式 | JS 入口（SystemJS/ESM） | HTML 入口（解析 HTML 提取资源） |
| 沙箱 | 无 | Proxy 沙箱 / 快照沙箱 |
| CSS 隔离 | 无 | Shadow DOM / Scoped CSS |
| 依赖共享 | Import Maps / SystemJS | HTML 入口自动复用 |

---

## 7. 三者核心共性

三者（Module Federation、qiankun、Single-SPA）确实围绕**同一个核心生命周期**运转：

```
┌─────────────────────────────────────────────────────────┐
│              微前端的通用生命周期                           │
│                                                         │
│   1. 加载远程资源（Load）                                  │
│      ↓  获取远程应用/模块的代码                             │
│   2. 初始化/注册（Bootstrap/Init）                         │
│      ↓  执行初始化逻辑，注册共享依赖                        │
│   3. 挂载（Mount）                                       │
│      ↓  将组件/应用渲染到 DOM                              │
│   4. 更新（Update）— 可选                                 │
│      ↓  数据变化时重新渲染                                 │
│   5. 卸载（Unmount）                                     │
│      ↓  清理 DOM、事件、定时器                             │
│   6. 销毁（Unload）— 可选                                │
│      ↓  释放所有资源                                      │
└─────────────────────────────────────────────────────────┘
```

**各方案的实现方式：**

| 生命周期 | Module Federation | Single-SPA | qiankun |
|---------|------------------|------------|---------|
| **加载** | `__webpack_require__.l` 创建 `<script>` 加载 remoteEntry.js | `System.import()` 加载子应用 JS | 请求 HTML 入口，解析并加载 JS/CSS |
| **初始化** | `container.init(shareScope)` 共享依赖协商 | `bootstrap()` 生命周期函数 | `bootstrap()` + 沙箱创建 |
| **挂载** | 直接作为模块使用（框架自身的渲染） | `mount(props)` 渲染到指定 DOM | `mount(props)` + 沙箱激活 |
| **卸载** | 框架自身的组件销毁 | `unmount(props)` 清理 | `unmount(props)` + 沙箱去激活 |

**共性总结**：三者本质都在解决同一个问题——**如何在一个页面中安全地加载、运行和管理来自不同来源的前端代码**。区别在于抽象层级和侧重点不同。

---

## 8. 三者的对比总结

### 8.1 定位

```
                          构建层 ←─────────────────→ 运行时层
                            │                           │
                     Module Federation              Single-SPA
                    （Webpack/Rspack 插件）         （JS 路由框架）
                            │                           │
                            └─────── qiankun ───────────┘
                                  （基于 Single-SPA
                                   + 沙箱 + 样式隔离）
```

### 8.2 详细对比

| 维度 | Module Federation | Single-SPA | qiankun |
|------|------------------|------------|---------|
| **定位** | 构建工具的模块共享协议 | 路由驱动的微前端框架 | 企业级微前端解决方案 |
| **共享粒度** | 模块/组件级 | 应用级（+ Parcel 组件级） | 应用级 |
| **技术栈要求** | 所有应用需使用支持 MF 的构建工具 | 无限制（框架无关） | 无限制（框架无关） |
| **JS 沙箱** | 无 | 无 | Proxy 沙箱 / 快照沙箱 |
| **CSS 隔离** | 无 | 无 | Shadow DOM / 实验性 Scoped CSS |
| **共享依赖** | 内置（shareScope 自动协商版本） | Import Maps / SystemJS（手动配置） | HTML 入口隐式共享 |
| **性能** | 最优（零额外运行时） | 良好（轻量运行时） | 中等（沙箱有开销） |
| **类型支持** | MF 2.0 支持动态类型提示 | 无 | 无 |
| **学习成本** | 低（只是 Webpack 配置） | 中（需理解生命周期） | 中（API 封装好但概念多） |

### 8.3 优缺点

**Module Federation：**
- 优点：性能最好、开发体验最好、组件级共享、类型支持、与构建工具深度集成
- 缺点：无沙箱/样式隔离、要求统一构建工具、不同 MF 版本可能不兼容

**Single-SPA：**
- 优点：框架无关、概念简单、社区成熟、可与 MF 配合使用
- 缺点：无沙箱/样式隔离、需要手动配置依赖共享、API 偏底层

**qiankun：**
- 优点：开箱即用的沙箱和样式隔离、HTML 入口简化接入、中文社区完善
- 缺点：沙箱不完美（Proxy 无法拦截所有副作用）、性能开销、仅限浏览器端、主要是中文社区维护

---

## 9. 海外开发者的偏好

### 9.1 总体趋势

从 npm 下载量和社区活跃度来看：

- **single-spa**：约 39 万/周下载量，13,700+ GitHub Stars，生态稳定但增长放缓
- **@module-federation/\***：下载量持续增长，尤其 MF 2.0 稳定版发布（2026 年 2 月）后势头强劲

### 9.2 偏好分析

**欧美开发者总体更偏好 Module Federation**，原因包括：

1. **与 Webpack/Rspack 生态绑定**：欧美大量项目使用 Webpack，MF 接入成本为零
2. **MF 2.0 突破了 Webpack 限制**：已支持 Vite、Rollup、Rolldown 等，不再与 Webpack 强绑定
3. **性能优先的文化**：欧美开发者对运行时性能开销更敏感，MF 的零额外开销更受青睐
4. **组件级共享需求**：欧美更多 monorepo + 微前端场景需要组件级别的代码复用，MF 天然支持

**Single-SPA 仍有稳固的用户群**：
1. 大型企业的**多技术栈场景**（Angular + React 混合）中 Single-SPA 仍是首选
2. 不依赖特定构建工具，适合异构系统
3. Parcel 机制提供了跨框架组件复用

**qiankun 在海外使用较少**：
1. qiankun 主要在中国开发者社区流行
2. 海外开发者更倾向于选择 Module Federation 或 Single-SPA
3. 海外需要沙箱隔离的场景更多倾向于使用 iframe 或 Web Components

### 9.3 趋势判断

Module Federation 2.0 稳定版已经成为"bundler 无关"的模块共享协议，支持 Webpack、Rspack、Vite、Rollup 等，进一步扩大了其适用范围。从社区趋势看，**Module Federation 正在成为欧美微前端的主流方案**。

---

## 10. 前端专家解决污染的方法

### 10.1 CSS 污染解决方案

**方案 1：CSS Modules（最推荐）**

```css
/* Button.module.css */
.button { background: blue; }
.label { color: white; }
```

```javascript
import styles from './Button.module.css';
// styles.button → "Button_button_x7d2k"（唯一 hash 类名）
```

原理：构建时将类名替换为带 hash 的唯一标识，从根本上避免命名冲突。

**方案 2：CSS-in-JS**

```javascript
// styled-components / emotion
const Button = styled.button`
  background: ${props => props.primary ? 'blue' : 'gray'};
`;
```

原理：运行时动态生成唯一类名并注入 `<style>` 标签。

**方案 3：Vue Scoped Styles**

```vue
<style scoped>
.button { background: blue; }
/* 编译后：.button[data-v-f3f3eg9] { background: blue; } */
</style>
```

原理：Vue 编译器为组件 DOM 添加唯一的 `data-v-xxx` 属性，CSS 选择器带上属性限定。

**方案 4：Shadow DOM（强隔离场景）**

```javascript
class MicroApp extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    // shadow 内部的样式完全隔离，外部样式无法穿透
    shadow.innerHTML = `
      <style>.button { background: blue; }</style>
      <button class="button">Click</button>
    `;
  }
}
```

原理：浏览器原生的 DOM 隔离机制，Shadow DOM 内外的 CSS 互不影响。缺点是与 UI 组件库（Element UI、Ant Design）兼容性差。

**方案 5：BEM + 应用前缀（最简单）**

```css
/* 约定每个应用的样式必须带前缀 */
.app-b__button { background: blue; }
.app-b__button--primary { background: green; }
```

原理：纯命名约定，依赖团队规范遵守。

### 10.2 JS 污染解决方案

**方案 1：工程规范约束（最常用）**

```javascript
// ❌ 不允许
window.myGlobal = 'value';
document.addEventListener('click', handler);
setInterval(polling, 1000);

// ✅ 正确做法
// 所有状态放在模块作用域内
const myLocal = 'value';
// 事件监听绑定在组件 DOM 上
el.addEventListener('click', handler);
// 定时器在组件卸载时清理
onUnmount(() => clearInterval(timer));
```

配合 ESLint 规则强制执行：

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-globals': ['error', 'name', 'event'],
    'no-restricted-properties': ['error', {
      object: 'window',
      property: '__proto__'
    }]
  }
};
```

**方案 2：Proxy 沙箱（需自行实现或借用）**

```javascript
// 简化版 Proxy 沙箱
function createSandbox() {
  const fakeWindow = Object.create(null);

  return new Proxy(window, {
    get(target, prop) {
      // 优先从 fakeWindow 读取
      if (prop in fakeWindow) return fakeWindow[prop];
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, prop, value) {
      // 所有写操作都落在 fakeWindow 上
      fakeWindow[prop] = value;
      return true;
    }
  });
}

// 在沙箱中执行远程模块代码
const sandbox = createSandbox();
(function(window) {
  // 远程模块代码在这里执行
  // window.xxx = 'value' 实际写入 fakeWindow
}).call(sandbox, sandbox);
```

**方案 3：模块化状态管理**

```javascript
// 避免全局状态，使用模块级别的事件总线
// shared/eventBus.js
class EventBus {
  constructor() { this.events = new Map(); }
  on(event, callback) { /* ... */ }
  emit(event, data) { /* ... */ }
  off(event, callback) { /* ... */ }
}

export const bus = new EventBus();
// 通过 MF 的 shared 配置共享这个实例
```

### 10.3 实际项目中的最佳实践

```
CSS 隔离策略选择：
  ├── React 项目 → CSS Modules 或 CSS-in-JS
  ├── Vue 项目 → Scoped Styles
  └── 需要强隔离 → Shadow DOM（注意组件库兼容性）

JS 隔离策略选择：
  ├── 同团队/同技术栈 → 工程规范 + ESLint（够用且零开销）
  ├── 需要强隔离 → Proxy 沙箱（有性能开销）
  └── 终极方案 → iframe（彻底隔离但牺牲集成体验）
```

---

## 11. `eager: true` 的作用

### 11.1 默认行为（eager: false）

```javascript
// webpack.config.js
new ModuleFederationPlugin({
  shared: {
    react: { singleton: true }  // 默认 eager: false
  }
});
```

默认情况下，共享依赖被放在**异步 chunk** 中。这要求应用必须使用**异步入口模式**：

```javascript
// main.js（入口文件）
import('./bootstrap');  // 必须用动态 import 包裹

// bootstrap.js（实际启动逻辑）
import React from 'react';
import ReactDOM from 'react-dom';
ReactDOM.render(<App />, document.getElementById('root'));
```

**为什么需要异步入口？**

因为共享依赖（react）在异步 chunk 中，需要先与其他应用协商版本后才能决定加载哪个版本。`import('./bootstrap')` 给了 MF runtime 一个时机去完成协商和加载。

如果不使用异步入口，直接在 `main.js` 中 `import React`，Webpack 会报错：

```
Uncaught Error: Shared module is not available for eager consumption
```

### 11.2 eager: true 的效果

```javascript
new ModuleFederationPlugin({
  shared: {
    react: {
      singleton: true,
      eager: true  // 将共享依赖打入入口 chunk
    }
  }
});
```

设置 `eager: true` 后：

1. **共享依赖被打入入口 chunk**（而非异步 chunk）
2. **不再需要异步入口包裹**，可以直接在 `main.js` 中使用：

```javascript
// main.js — 不需要 import('./bootstrap') 了
import React from 'react';
import ReactDOM from 'react-dom';
ReactDOM.render(<App />, document.getElementById('root'));
```

### 11.3 代价与权衡

```
                   eager: false（默认）          eager: true
入口模式           必须异步 import()              可以直接同步 import
初始 bundle 大小   更小（共享依赖按需加载）         更大（共享依赖在入口 chunk）
依赖去重           更好（异步协商后可能复用远程的）   较差（本地已打包，即使远程有也浪费）
启动速度           略慢（多一次异步加载）            略快（同步执行）
适用场景           Remote 应用（推荐默认值）        Host 应用（如果不想改入口结构）
```

### 11.4 使用建议

- **Remote 应用**：保持默认 `eager: false`，配合 `import('./bootstrap')` 异步入口
- **Host 应用**：如果改造成本高（不想引入异步入口），可以设置 `eager: true`
- **注意**：`eager: true` 会增大入口 chunk 体积，且每个应用都会打包一份该依赖。如果 Host 和 Remote 都设置了 `eager: true`，同一个库可能被加载两次

---

## 12. "window 上的装载函数"

### 12.1 同事说的是什么意思？

当同事说 "模块联邦依赖 window 上的函数来引入模块"，他指的是 **remoteEntry.js 执行后会在 `window` 上挂载一个容器对象**。

### 12.2 具体机制

```javascript
// Remote 应用的 remoteEntry.js 构建产物（library.type = 'var'）
var appB;  // 声明全局变量

(() => {
  // ... webpack 模块系统 ...

  appB = __webpack_exports__;  // 赋值给全局变量
})();

// 此时 window.appB 可用：
// window.appB = {
//   get: function(moduleName) { /* 返回模块 */ },
//   init: function(shareScope) { /* 初始化共享依赖 */ }
// }
```

**Host 侧的消费代码（Webpack runtime 生成）：**

```javascript
// Host runtime 中自动生成的远程加载逻辑（简化版）
__webpack_require__.l(
  'http://localhost:9003/remoteEntry.js',  // Remote URL
  function() {
    // <script> 加载完成后的回调
    var container = window["appB"];       // ← 这就是"window 上的装载函数"

    container.init(__webpack_require__.S);  // 传入共享依赖
    container.get('./MultiCalc').then(factory => {
      var module = factory();  // 获得远程组件
    });
  }
);
```

### 12.3 "装载函数"的本质

```
window["appB"] = {
  get(moduleName) → Promise<factory>    // 获取远程模块的工厂函数
  init(shareScope) → void               // 初始化共享依赖作用域
}
```

这就是一个**远程模块容器（Container）**，它是整个模块联邦运行时协议的核心接口。Host 通过这两个方法就能获取 Remote 暴露的任何模块。

---

## 13. 依赖 window 挂载全局变量的细节

### 13.1 Library Type 决定挂载方式

Webpack 的 `ModuleFederationPlugin` 有一个 `library` 配置项，决定了 remoteEntry.js 如何暴露容器：

```javascript
new ModuleFederationPlugin({
  name: 'appB',
  library: { type: 'var', name: 'appB' },  // 默认值
  // ...
});
```

不同的 `library.type` 对应不同的挂载方式：

| type | 产物代码 | 访问方式 |
|------|---------|---------|
| `'var'`（默认） | `var appB = (() => {...})()` | `window.appB` |
| `'window'` | `window["appB"] = (() => {...})()` | `window.appB` |
| `'global'` | `global["appB"] = ...` | `globalThis.appB` |
| `'module'` | `export default ...` | ESM import |
| `'script'` | 类似 JSONP 的全局注册 | 全局回调 |

### 13.2 完整的运行时加载链路

```
[1] Host 编译时
    ├── Webpack 将 import('appB/MultiCalc') 编译为：
    │   __webpack_require__.e("remotes/appB/MultiCalc")
    └── 生成 remote 加载逻辑

[2] Host 运行时 — 触发远程模块加载
    ├── __webpack_require__.e() 被调用
    ├── 检查 remoteEntry 是否已加载
    │   ├── 未加载 → __webpack_require__.l() 创建 <script> 标签
    │   └── 已加载 → 跳过
    └── 返回 Promise

[3] remoteEntry.js 加载并执行
    ├── IIFE 执行，创建 Remote 的模块系统
    ├── 将容器挂载到 window：
    │     var appB = { get, init }
    └── <script> onload 触发

[4] Host 初始化 Remote 容器
    ├── container = window["appB"]
    ├── container.init(shareScope)
    │   ├── shareScope 中包含 Host 已加载的共享依赖
    │   ├── Remote 检查自己需要的依赖版本
    │   └── 版本匹配 → 复用；不匹配 → 标记需要加载自己的
    └── 初始化完成

[5] Host 获取远程模块
    ├── container.get("./MultiCalc")
    │   ├── Remote 内部执行 __webpack_require__.e() 加载对应 chunk
    │   │   （如果模块在 remoteEntry 中已包含，则直接返回）
    │   └── 返回 Promise<factory>
    ├── factory = await container.get("./MultiCalc")
    ├── module = factory()  // 执行工厂函数获得模块导出
    └── module.default 就是 MultiCalc 组件

[6] Host 使用远程组件
    └── 像本地组件一样使用（框架无感知）
```

### 13.3 window 上的全局变量的"生命周期"

```javascript
// 1. 加载前 — 不存在
console.log(window.appB);  // undefined

// 2. remoteEntry.js 执行后 — 容器就绪
console.log(window.appB);  // { get: fn, init: fn }

// 3. init 后 — 共享依赖协商完成
window.appB.init(shareScope);  // 内部建立共享依赖的映射

// 4. 永久存在 — 不会被清理
// window.appB 会一直存在于内存中直到页面卸载
// 这也是为什么刷新页面后需要重新加载所有 remoteEntry.js
```

### 13.4 多个 Remote 的情况

```javascript
// Host 配置了多个 Remote
new ModuleFederationPlugin({
  remotes: {
    appB: 'appB@http://localhost:9003/remoteEntry.js',
    appC: 'appC@http://localhost:9004/remoteEntry.js',
  }
});

// 运行时 window 上的状态：
window.appB = { get, init }  // appB 的容器
window.appC = { get, init }  // appC 的容器

// 共享依赖通过 shareScope 在所有容器间共享
// appB.init(shareScope) 和 appC.init(shareScope) 使用同一个 shareScope
// 确保 Vue/React 等只加载一份
```

### 13.5 webpackChunk 全局变量

除了容器对象，**每个应用还有一个 `webpackChunk_xxx` 全局数组**用于 chunk 注册：

```javascript
// 每个应用的 chunk 通过各自的全局数组注册
self["webpackChunkappA"] = [];  // appA 的 chunk 注册表
self["webpackChunkappB"] = [];  // appB 的 chunk 注册表
self["webpackChunkappC"] = [];  // appC 的 chunk 注册表

// 这些名字由 output.uniqueName 决定，避免多应用间的 chunk 注册冲突
```

这就是为什么 `ModuleFederationPlugin` 的 `name` 必须是**合法的 JS 标识符**——它会成为 `window` 上的全局变量名。使用连字符（如 `app-b`）会导致 `var app-b` 语法错误。

---

## 总结

| 核心概念 | 一句话理解 |
|---------|----------|
| Webpack 打包 | 从入口递归收集依赖，所有文件通过 Loader 转为 JS，通过 runtime 实现模块系统 |
| 辅助代码 | 浏览器端的模块系统实现——加载、缓存、执行、注册 |
| Script 标签残留 | 加载后保留在 DOM，不影响性能，可在 DevTools 中观察 |
| 模块联邦原理 | remoteEntry.js 在 window 挂载容器，Host 通过 init + get 获取远程模块 |
| 无沙箱也流行 | 性能好 + 开发体验好 + 大多场景不需要强隔离 |
| qiankun/Single-SPA | 路由级应用集成 + 生命周期管理，qiankun 额外提供沙箱 |
| 三者共性 | 加载 → 初始化 → 挂载 → 卸载 的生命周期管理 |
| 海外偏好 | Module Federation 势头更强，Single-SPA 在多框架场景仍有市场 |
| 解决污染 | CSS: CSS Modules / Scoped / CSS-in-JS；JS: 工程规范 / Proxy 沙箱 |
| eager: true | 共享依赖打入入口 chunk，免去异步入口，但增大 bundle |
| window 装载函数 | remoteEntry.js 执行后在 window 上挂载 `{ get, init }` 容器 |
