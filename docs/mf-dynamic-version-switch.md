# Module Federation 远程模块动态版本切换方案

## 1. 背景与目标

### 1.1 需求

在 EMP 2.4（Webpack 5 Module Federation）微前端架构中，实现：

- 主应用（Host）版本固定，不随子应用变化重新构建
- 子应用（如 `appC`）支持多版本并存（v1、v2 独立部署）
- 运行时 SPA 内无刷新切换：先加载 v1 → 卸载 v1 → 加载 v2

### 1.2 技术选型

| 决策项 | 选择 |
|--------|------|
| 构建框架 | EMP 2.4（Webpack 5 原生 MF，无自定义 runtime） |
| 卸载级别 | 中等卸载（Vue 实例销毁 + DOM 移除 + webpack module cache + MF shared scope） |
| 切换方式 | SPA 内无刷新动态替换 |
| 共享依赖 | v1/v2 使用相同 Vue 版本 |

---

## 2. 核心原理

### 2.1 EMP 2.4 的 MF 实现

EMP 2.4 **直接使用 webpack 5 原生 `ModuleFederationPlugin`**，没有自定义 runtime 层（区别于 EMP 3.x 的 `EMP_SHARE_RUNTIME`）。

构建产物 `emp.js` 加载后，在 `window` 上挂载容器对象（如 `window.appC`），暴露标准接口：

```javascript
window.appC.init(shareScope)  // 初始化共享作用域
window.appC.get('./TodoList') // 获取模块工厂函数
```

### 2.2 Webpack 5 MF 运行时缓存结构

| 缓存层 | 访问方式 | 作用 | 可清理性 |
|--------|---------|------|---------|
| 模块缓存 | `__webpack_require__.c[moduleId]` | 缓存已执行模块的 exports | ✅ 可 delete |
| 模块工厂 | `__webpack_require__.m[moduleId]` | 存储模块工厂函数 | ✅ 可覆写 |
| Shared scope | `__webpack_require__.S["default"]` | 共享依赖注册表 | ✅ 可操作 |
| Remote 加载状态 | `data.p`（闭包内） | 标记 remote 是否已加载 | ❌ 不可直接访问 |
| Script 加载器 | `inProgress`（闭包内） | URL 去重 | ⚠️ 加载完成后自动清除 |

### 2.3 关键约束

`__webpack_require__.f.remotes` 内部的 `data.p` 是闭包变量，一旦设为 `1`（已加载），无法从外部重置。这意味着：

> **webpack 静态 remotes 机制只能用于首次加载，版本切换必须绕过它。**

---

## 3. 方案设计

### 3.1 整体策略

```
┌─────────────────────────────────────────────────────┐
│  首次加载 v1：走 webpack 静态 remotes（正常 import）    │
│  切换到 v2：手动加载容器 + 覆写模块工厂                  │
└─────────────────────────────────────────────────────┘
```

- **v1 加载**：通过 `emp-config.js` 的 `remotes` 配置，使用标准 `import('appC/TodoList')` 加载
- **v2 切换**：手动加载新版本 `emp.js`，获取容器，覆写 webpack 模块工厂和缓存

### 3.2 部署结构

```
CDN / 静态服务器
├── appC/
│   ├── v1/
│   │   ├── emp.js          (v1 的 MF 入口)
│   │   └── chunks/...
│   └── v2/
│       ├── emp.js          (v2 的 MF 入口)
│       └── chunks/...
```

### 3.3 主应用配置

```javascript
// emp-config.js (Host)
module.exports = {
  empShare: {
    name: 'appA',
    remotes: {
      // 默认指向 v1
      appC: 'appC@http://localhost:9004/v1/emp.js'
    },
    // ...
  }
}
```

### 3.4 版本切换核心流程

```
┌──────────┐     ┌──────────────┐     ┌─────────────────┐
│  加载 v1  │ ──→ │  运行 v1 组件  │ ──→ │  触发版本切换     │
└──────────┘     └──────────────┘     └────────┬────────┘
                                               │
                                               ▼
┌──────────────────────────────────────────────────────────┐
│ 1. 销毁 Vue 实例                                          │
│ 2. 移除 DOM                                              │
│ 3. 清理 webpack 模块缓存 (__webpack_require__.c)           │
│ 4. 加载 v2 的 emp.js（新 URL → 无去重问题）                 │
│ 5. 调用 v2 容器 init + get                                │
│ 6. 覆写 __webpack_require__.m[moduleId] 为 v2 工厂        │
│ 7. 渲染 v2 组件                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 4. 详细实现

### 4.1 远程模块 ID 的确定

webpack 构建时为远程模块分配 ID，格式取决于构建模式：

- **开发模式**：字符串，如 `"webpack/container/remote/appC/TodoList"`
- **生产模式**：数字，如 `123`

运行时可通过遍历 `__webpack_require__.m` 定位：

```javascript
function findRemoteModuleIds(remoteName, exposedModule) {
  const moduleFactories = __webpack_require__.m
  const moduleCache = __webpack_require__.c
  const ids = []

  for (const id in moduleCache) {
    const cachedModule = moduleCache[id]
    // 开发模式下 ID 包含 remote 信息
    if (typeof id === 'string' && id.includes(`remote`) && id.includes(exposedModule)) {
      ids.push(id)
    }
  }

  // 备选：通过模块工厂函数的 toString() 匹配
  for (const id in moduleFactories) {
    const factory = moduleFactories[id]
    const src = factory.toString()
    if (src.includes(exposedModule) && src.includes('exports')) {
      ids.push(id)
    }
  }

  return [...new Set(ids)]
}
```

> **建议**：开发阶段通过 `console.log(Object.keys(__webpack_require__.c))` 确认实际 ID，然后硬编码或通过约定规则匹配。

### 4.2 RemoteLoader 核心类

```javascript
// src/utils/remote-loader.js

/**
 * 远程模块动态版本加载器
 * 负责加载、卸载、切换远程模块版本
 */
class RemoteLoader {
  constructor(options) {
    this.remoteName = options.remoteName       // 容器名，如 'appC'
    this.currentVersion = null                 // 当前加载的版本
    this.currentUrl = null                     // 当前 emp.js 的 URL
    this.moduleIdCache = new Map()             // exposedModule → moduleId 映射
  }

  /**
   * 加载指定版本的远程容器
   * @param {string} url - emp.js 的完整 URL
   * @param {string} version - 版本标识（用于日志和状态管理）
   * @returns {Promise<object>} 容器对象
   */
  async loadContainer(url, version) {
    // 1. 通过 script 标签加载远程入口
    await this._loadScript(url)

    // 2. 获取容器
    const container = window[this.remoteName]
    if (!container) {
      throw new Error(`[RemoteLoader] 容器 window.${this.remoteName} 未找到，URL: ${url}`)
    }

    // 3. 初始化共享作用域
    const shareScope = __webpack_require__.S || {}
    if (!shareScope['default']) {
      // 如果 shared scope 尚未初始化，先初始化
      await __webpack_require__.I('default')
    }
    await container.init(__webpack_require__.S['default'])

    // 4. 更新状态
    this.currentVersion = version
    this.currentUrl = url

    return container
  }

  /**
   * 从容器中获取指定模块
   * @param {string} exposedModule - 暴露的模块名，如 './TodoList'
   * @returns {Promise<any>} 模块导出
   */
  async getModule(exposedModule) {
    const container = window[this.remoteName]
    if (!container) {
      throw new Error(`[RemoteLoader] 容器 window.${this.remoteName} 不存在`)
    }

    const factory = await container.get(exposedModule)
    return factory()
  }

  /**
   * 卸载当前版本（清理缓存，不涉及 Vue 实例销毁）
   */
  unload() {
    // 1. 清理 webpack 模块缓存
    this._clearModuleCache()

    // 2. 移除容器全局变量
    delete window[this.remoteName]

    // 3. 重置状态
    this.currentVersion = null
    this.currentUrl = null
  }

  /**
   * 切换到新版本
   * @param {string} newUrl - 新版本 emp.js 的 URL
   * @param {string} newVersion - 新版本标识
   * @param {string} exposedModule - 要获取的模块名
   * @returns {Promise<any>} 新版本的模块导出
   */
  async switchVersion(newUrl, newVersion, exposedModule) {
    // 1. 卸载当前版本
    this.unload()

    // 2. 加载新版本容器
    await this.loadContainer(newUrl, newVersion)

    // 3. 获取模块
    const module = await this.getModule(exposedModule)

    // 4. 覆写 webpack 模块工厂（使后续 import() 也能拿到新版本）
    this._overwriteModuleFactory(exposedModule, module)

    return module
  }

  /**
   * 注册模块 ID（首次加载后调用，记录 webpack 分配的 moduleId）
   * @param {string} exposedModule - 暴露的模块名
   * @param {string|number} moduleId - webpack 模块 ID
   */
  registerModuleId(exposedModule, moduleId) {
    this.moduleIdCache.set(exposedModule, moduleId)
  }

  // ─── 私有方法 ───

  _loadScript(url) {
    return new Promise((resolve, reject) => {
      // 移除同名旧 script（如果存在）
      const existing = document.querySelector(`script[data-remote="${this.remoteName}"]`)
      if (existing) {
        existing.parentNode.removeChild(existing)
      }

      const script = document.createElement('script')
      script.src = url
      script.setAttribute('data-remote', this.remoteName)
      script.onload = resolve
      script.onerror = () => reject(new Error(`[RemoteLoader] 加载失败: ${url}`))
      document.head.appendChild(script)
    })
  }

  _clearModuleCache() {
    const cache = __webpack_require__.c

    // 策略1：通过已注册的 moduleId 精确清理
    for (const [, moduleId] of this.moduleIdCache) {
      delete cache[moduleId]
    }

    // 策略2：通过 ID 模式匹配清理（开发模式下 ID 是字符串）
    for (const id in cache) {
      if (typeof id === 'string' && id.includes(this.remoteName)) {
        delete cache[id]
      }
    }
  }

  _overwriteModuleFactory(exposedModule, moduleExports) {
    const moduleId = this.moduleIdCache.get(exposedModule)
    if (moduleId && __webpack_require__.m[moduleId]) {
      // 覆写工厂函数，使后续 __webpack_require__(moduleId) 返回新版本
      __webpack_require__.m[moduleId] = function (module) {
        module.exports = moduleExports
      }
      // 同时清除缓存，确保下次执行新工厂
      delete __webpack_require__.c[moduleId]
    }
  }
}

export default RemoteLoader
```

### 4.3 Vue 组件封装

```vue
<!-- src/components/DynamicRemote.vue -->
<template>
  <div ref="container">
    <component
      v-if="remoteComponent"
      :is="remoteComponent"
      v-bind="$attrs"
      v-on="$listeners"
    />
    <slot v-else name="loading">
      <span>加载中...</span>
    </slot>
  </div>
</template>

<script>
import RemoteLoader from '@/utils/remote-loader'

export default {
  name: 'DynamicRemote',
  props: {
    // 容器名
    remoteName: {
      type: String,
      required: true
    },
    // 暴露的模块路径
    exposedModule: {
      type: String,
      required: true
    },
    // 版本配置 { version: string, url: string }
    versionConfig: {
      type: Object,
      required: true
    }
  },

  data() {
    return {
      remoteComponent: null,
      loader: null
    }
  },

  watch: {
    versionConfig: {
      async handler(newConfig, oldConfig) {
        if (oldConfig && newConfig.version !== oldConfig.version) {
          await this.switchVersion(newConfig)
        }
      },
      deep: true
    }
  },

  async created() {
    this.loader = new RemoteLoader({ remoteName: this.remoteName })
    await this.loadVersion(this.versionConfig)
  },

  beforeDestroy() {
    this.remoteComponent = null
  },

  methods: {
    async loadVersion(config) {
      try {
        await this.loader.loadContainer(config.url, config.version)
        const module = await this.loader.getModule(this.exposedModule)
        this.remoteComponent = module.default || module
      } catch (err) {
        console.error('[DynamicRemote] 加载失败:', err)
        this.$emit('error', err)
      }
    },

    async switchVersion(newConfig) {
      // 1. 销毁当前组件
      this.remoteComponent = null

      // 2. 等待 Vue 完成 DOM 更新（确保旧组件已销毁）
      await this.$nextTick()

      // 3. 切换版本
      try {
        const module = await this.loader.switchVersion(
          newConfig.url,
          newConfig.version,
          this.exposedModule
        )
        this.remoteComponent = module.default || module
        this.$emit('version-changed', newConfig.version)
      } catch (err) {
        console.error('[DynamicRemote] 版本切换失败:', err)
        this.$emit('error', err)
      }
    }
  }
}
</script>
```

### 4.4 业务使用示例

```vue
<!-- src/views/Home.vue -->
<template>
  <div>
    <h1>主应用</h1>

    <!-- 版本切换控制 -->
    <div class="version-control">
      <span>当前版本: {{ currentVersion }}</span>
      <button @click="switchTo('v1')">切换到 v1</button>
      <button @click="switchTo('v2')">切换到 v2</button>
    </div>

    <!-- 动态远程组件 -->
    <DynamicRemote
      remote-name="appC"
      exposed-module="./TodoList"
      :version-config="versionConfig"
      @version-changed="onVersionChanged"
      @error="onError"
    />
  </div>
</template>

<script>
import DynamicRemote from '@/components/DynamicRemote.vue'

const VERSION_MAP = {
  v1: 'http://localhost:9004/v1/emp.js',
  v2: 'http://localhost:9004/v2/emp.js'
}

export default {
  components: { DynamicRemote },

  data() {
    return {
      currentVersion: 'v1',
      versionConfig: {
        version: 'v1',
        url: VERSION_MAP.v1
      }
    }
  },

  methods: {
    switchTo(version) {
      this.versionConfig = {
        version,
        url: VERSION_MAP[version]
      }
    },

    onVersionChanged(version) {
      this.currentVersion = version
    },

    onError(err) {
      alert('远程模块加载失败: ' + err.message)
    }
  }
}
</script>
```

---

## 5. 首次加载的两种模式

### 5.1 模式 A：静态 remotes + 动态切换（推荐）

首次加载走 webpack 静态 remotes（DX 更好），后续切换走 RemoteLoader。

```javascript
// emp-config.js
remotes: { appC: 'appC@http://localhost:9004/v1/emp.js' }

// 首次加载（正常 import）
const TodoList = () => import('appC/TodoList')

// 切换时使用 RemoteLoader
```

**优点**：首次加载享受 webpack 的代码分割和 chunk 优化
**注意**：首次加载后需要记录 moduleId，供后续覆写使用

### 5.2 模式 B：全部走 RemoteLoader

不配置静态 remotes，所有版本加载都通过 RemoteLoader。

```javascript
// emp-config.js
remotes: {}  // 不配置

// 所有加载都通过 RemoteLoader
const loader = new RemoteLoader({ remoteName: 'appC' })
await loader.loadContainer('http://localhost:9004/v1/emp.js', 'v1')
const module = await loader.getModule('./TodoList')
```

**优点**：逻辑统一，无需处理静态/动态两套机制
**缺点**：失去 webpack 静态分析优化

### 5.3 推荐选择

**选模式 A**。理由：
- 首次加载是最常见路径，应该走最优化的通道
- 版本切换是低频操作，额外的手动加载开销可以接受
- 保持 `emp-config.js` 的声明式配置，团队理解成本低

---

## 6. 缓存清理细节

### 6.1 需要清理的内容

| 清理项 | 方式 | 必要性 |
|--------|------|--------|
| Vue 组件实例 | `vm.$destroy()` | ✅ 必须 |
| DOM 节点 | `el.innerHTML = ''` | ✅ 必须 |
| `__webpack_require__.c[moduleId]` | `delete` | ✅ 必须 |
| `__webpack_require__.m[moduleId]` | 覆写为新工厂 | ✅ 必须（确保后续 import 拿到新版本） |
| `window[remoteName]` | `delete` | ✅ 必须（为新容器腾位置） |
| 旧 script 标签 | `removeChild` | ⚠️ 建议（防止 DOM 堆积） |
| `__webpack_require__.S` | 不清理 | ❌ 不需要（v1/v2 共享同版本 Vue） |

### 6.2 不需要清理的内容

- **Shared scope**：v1 和 v2 使用相同 Vue 版本，shared scope 中的 Vue factory 可以复用
- **`data.p` 缓存**：无法清理，但不影响方案（v2 通过手动加载绕过）
- **`initPromises`**：闭包变量，无法清理，但 shared scope 已初始化过就不需要重新初始化

### 6.3 Script 加载器的行为确认

源码确认 `__webpack_require__.l` 的行为：
- 加载完成后 `delete inProgress[url]` — 不会阻塞后续加载
- 加载完成后 `script.parentNode.removeChild(script)` — DOM 中不残留
- 不同 URL（v1/emp.js vs v2/emp.js）不会触发去重

**结论**：script 加载层不构成障碍。

---

## 7. container.init() 的安全性

### 7.1 源码逻辑

```javascript
// 容器的 init 方法（每个 emp.js 内部）
var init = function(shareScope, initScope) {
  var name = "default"
  var oldScope = __webpack_require__.S[name]
  if (oldScope && oldScope !== shareScope)
    throw new Error("Container initialization failed...")
  __webpack_require__.S[name] = shareScope
  return __webpack_require__.I(name, initScope)
}
```

### 7.2 安全性分析

- v2 的 `emp.js` 是全新加载的脚本，其内部的 `__webpack_require__` 是 **v2 自己的 webpack runtime**
- v2 容器内部的 `__webpack_require__.S` 初始为空（新脚本，新作用域）
- 调用 `container.init(hostShareScope)` 时，`oldScope` 为 `undefined`，不会抛错

**结论**：v2 容器的 `init()` 调用是安全的。

---

## 8. 风险与缓解

| 风险 | 概率 | 缓解措施 |
|------|------|---------|
| moduleId 在生产构建中是数字，难以定位 | 高 | 构建时通过 webpack 插件固定远程模块 ID，或运行时首次加载后记录 |
| v2 组件依赖的 chunk 加载路径错误 | 中 | v2 构建时配置正确的 `publicPath`（如 `/appC/v2/`） |
| 全局 CSS 副作用残留 | 中 | 子应用使用 scoped CSS；切换时移除旧版本注入的 style 标签 |
| 内存泄漏（事件监听、定时器） | 中 | 子应用遵循卸载协议，在 `beforeDestroy` 中清理副作用 |
| v2 的 emp.js 加载失败 | 低 | RemoteLoader 提供错误回调，支持回退到 v1 |

---

## 9. 子应用构建要求

### 9.1 publicPath 配置

每个版本需要配置正确的 `publicPath`，确保异步 chunk 能正确加载：

```javascript
// app-c v1 的 emp-config.js
module.exports = {
  base: '/appC/v1/',  // 或 publicPath
  empShare: {
    name: 'appC',
    exposes: { './TodoList': './src/components/TodoList.vue' }
  }
}

// app-c v2 的 emp-config.js
module.exports = {
  base: '/appC/v2/',
  empShare: {
    name: 'appC',
    exposes: { './TodoList': './src/components/TodoList.vue' }
  }
}
```

### 9.2 容器名一致

v1 和 v2 的 `name` 必须相同（都是 `appC`），这样加载后都挂载到 `window.appC`。

### 9.3 卸载协议

子应用组件应在 `beforeDestroy` 中清理所有副作用：

```javascript
// 子应用组件约定
export default {
  beforeDestroy() {
    // 清理定时器
    // 清理全局事件监听
    // 清理第三方库实例
  }
}
```

---

## 10. 实际实现总结

### 10.1 最终项目结构

```
packages/
├── app-a-v2/                     (Host, 端口 8001)
│   ├── emp-config.js             (EMP 2.4, remotes 指向 v1)
│   └── src/
│       ├── utils/remote-loader.js (核心：动态加载/卸载/切换)
│       └── views/Home.vue         (版本切换 UI)
├── app-c-v1/                     (Remote v1, 端口 8002)
│   ├── emp-config.js             (容器名 appC, exposes ./TodoList)
│   └── src/components/TodoList.vue (基础版：增删 + 绿色主题)
└── app-c-v2/                     (Remote v2, 端口 8003)
    ├── emp-config.js             (容器名 appC, exposes ./TodoList)
    └── src/components/TodoList.vue (增强版：筛选+编辑+Element UI+紫色主题)
```

### 10.2 实际采用的方案：全部走 RemoteLoader（模式 B）

最终实现中，**首次加载和版本切换都通过 RemoteLoader 手动加载**，没有使用 webpack 静态 `import('appC/TodoList')`。原因：

1. shareLib 模式下 `__webpack_share_scopes__` 可能不存在，静态 remotes 的 init 流程会出问题
2. 全部走 RemoteLoader 逻辑统一，调试简单
3. 不需要处理 moduleId 记录和工厂覆写

### 10.3 清理子应用的关键逻辑

版本切换时，`RemoteLoader.unload()` 执行以下清理步骤：

```
┌─────────────────────────────────────────────────────────────┐
│  unload(containerName) 清理流程                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 移除 <script> 标签                                       │
│     → 防止 DOM 堆积，旧脚本已执行完毕不影响功能                  │
│                                                             │
│  2. 清除 window[containerName]                               │
│     → try delete，失败则设为 undefined                        │
│     → 为新 emp.js 加载后的赋值腾位置                           │
│                                                             │
│  3. 清理 webpack 闭包内的模块缓存                              │
│     → __webpack_module_cache__：已执行模块的 exports 缓存      │
│     → __webpack_modules__：模块工厂函数注册表                   │
│     → 匹配规则：key 包含 containerName/remote/container        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 关键点 1：`window.appC` 不能 delete

```javascript
// emp.js 构建产物开头：
var appC;  // var 声明在全局作用域创建不可配置(non-configurable)属性

// 因此 delete window.appC 会抛 TypeError
// 解决：try/catch + fallback 设为 undefined
try {
  delete window[containerName]
} catch (e) {
  window[containerName] = undefined  // 新 emp.js 加载后会重新赋值覆盖
}
```

#### 关键点 2：webpack 缓存变量是闭包局部变量

```javascript
// webpack 打包产物结构：
(() => {
  var __webpack_modules__ = { /* 模块工厂 */ };
  var __webpack_module_cache__ = {};
  // ... remote-loader.js 的代码在这里执行
  // 所以能访问这两个变量（同一闭包作用域）
})();

// 浏览器控制台在全局作用域，访问不到这些变量
// 但 bundle 内的代码可以正常操作它们
```

#### 关键点 3：shareLib 模式下 container.init() 传空对象

```javascript
// EMP 2.4 shareLib 模式：Vue/ElementUI 通过 CDN 加载为 window 全局变量
// 不走 webpack shared scope 机制，所以 __webpack_share_scopes__ 可能不存在

let shareScope = {}
if (typeof __webpack_share_scopes__ !== 'undefined') {
  shareScope = __webpack_share_scopes__.default || {}
}
await container.init(shareScope)  // 传空对象即可，依赖已在 window 上
```

#### 关键点 4：Vue 组件层面的清理由框架自动处理

```javascript
// Home.vue 中切换版本时：
this.RemoteComponent = null  // 触发 Vue 响应式更新
// → Vue 自动销毁旧组件实例（调用 beforeDestroy/destroyed）
// → Vue 自动移除旧 DOM
// → 然后加载新版本组件赋值给 RemoteComponent
```

### 10.4 完整切换时序

```
用户点击 "v2" 按钮
    │
    ▼
Home.vue: loadVersion('v2')
    │  this.RemoteComponent = null   ← Vue 销毁旧组件 + 移除 DOM
    │
    ▼
remoteLoader.switchVersion('appC', 'http://localhost:8003/emp.js', './TodoList')
    │
    ├─ 1. unload('appC')
    │     ├─ 移除旧 <script data-remote="appC">
    │     ├─ window.appC = undefined
    │     └─ 遍历 __webpack_module_cache__ 和 __webpack_modules__
    │        删除 key 包含 'appC'/'remote'/'container' 的条目
    │
    ├─ 2. loadContainer('appC', 'http://localhost:8003/emp.js')
    │     ├─ 创建新 <script src="http://localhost:8003/emp.js">
    │     ├─ 注入 document.head
    │     └─ onload: window.appC 已被新 emp.js 赋值为 v2 容器
    │
    └─ 3. getModule('appC', './TodoList')
          ├─ container.init({})        ← v2 容器初始化
          ├─ container.get('./TodoList') ← 获取模块工厂
          └─ factory()                  ← 执行工厂，返回模块 exports
    │
    ▼
Home.vue: this.RemoteComponent = module.default
    │
    ▼
Vue 渲染新组件 → 页面显示 v2 TodoList（紫色主题 + Element UI）
```

### 10.5 webpack 5.106 兼容性修复

实际开发中遇到两个 webpack 5.106.2 与 EMP 2.4 的兼容问题：

| 问题 | 根因 | 修复 |
|------|------|------|
| `Cannot read properties of undefined (reading 'exposes')` | webpack 5.106 将 `ModuleFederationPlugin._options` 改为 `.options`，`webpack-federated-stats-plugin` 仍访问 `._options` | `chain.plugins.delete('mfStats')` |
| `Invalid options object. Progress Plugin` | EMP 2.4 使用 webpackbar 传入 `name/color/reporters` 选项，webpack 5.106 的 ProgressPlugin 不接受 | `chain.plugins.delete('progress')` |

修复方式统一在 `emp-config.js` 中通过 `webpackChain` 移除不兼容插件：

```javascript
webpackChain(chain) {
  chain.plugins.delete('mfStats')
  chain.plugins.delete('progress')
}
```

### 10.6 验证结果

| 验证项 | 结果 |
|--------|------|
| app-c-v1 独立启动（http://localhost:8002），TodoList 正常渲染 | ✅ 通过 |
| app-c-v2 独立启动（http://localhost:8003），TodoList 正常渲染 | ✅ 通过 |
| app-a-v2 启动后首次加载 v1 组件 | ✅ 通过 |
| 点击切换到 v2，组件替换为增强版（紫色主题 + Element UI） | ✅ 通过 |
| 再切回 v1，组件恢复为基础版（绿色主题） | ✅ 通过 |
| 浏览器 console 无报错 | ✅ 通过 |
| DOM 中旧 script 标签被移除 | ✅ 通过 |
| Todo 功能正常（添加/删除/筛选） | ✅ 通过 |
