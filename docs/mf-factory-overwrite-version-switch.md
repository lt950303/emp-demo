# Module Federation import() + 工厂覆写版本切换方案

## 1. 背景与目标

### 1.1 需求

在 EMP 2.4（Webpack 5 Module Federation）微前端架构中，实现：

- 业务代码**始终使用标准 `import('appC/TodoList')` 语法**，不引入自定义加载 API
- 版本切换对业务组件透明，切换逻辑封装在底层工具中
- 运行时 SPA 内无刷新切换：v1 ↔ v2

### 1.2 与 app-a-v2（RemoteLoader 方案）的对比

| 维度 | app-a-v2 (RemoteLoader) | app-a-v3 (工厂覆写) |
|------|------------------------|---------------------|
| 业务代码调用方式 | `remoteLoader.switchVersion()` + 手动获取模块 | `import('appC/TodoList')` |
| 首次加载 | 也走 RemoteLoader 手动加载 | 走 webpack 静态 remotes（标准 MF 流程） |
| 切换机制 | 完全绕过 webpack，手动管理容器 | 操作 webpack 内部状态（覆写工厂 + 清缓存） |
| 侵入性 | 低（独立工具类，不依赖 webpack 内部） | 中（依赖 webpack runtime 内部结构） |
| DX 体验 | 需要学习 RemoteLoader API | 业务代码无感知，标准 import 语法 |

### 1.3 技术选型

| 决策项 | 选择 |
|--------|------|
| 构建框架 | EMP 2.4（Webpack 5 原生 MF） |
| 切换方式 | 覆写 webpack 模块工厂 + 清除模块缓存 |
| 组件卸载 | Vue 2 `v-if` 销毁/重建容器组件 |
| webpack require 获取 | `webpackChunk.push` 第三参数（runtime function） |

---

## 2. 核心原理

### 2.1 整体流程

```
首次加载：
  import('appC/TodoList')
    → webpack 静态 remotes 加载 http://localhost:8002/emp.js
    → container.init() + container.get('./TodoList')
    → 缓存到 __webpack_module_cache__[moduleId]
    → 返回 v1 组件

版本切换（v1 → v2）：
  1. 手动 <script> 加载 http://localhost:8003/emp.js
     → window.appC 被覆盖为 v2 容器
  2. v2 container.init(shareScope) + container.get('./TodoList')
     → 拿到 v2 模块
  3. 覆写 __webpack_modules__[moduleId] = () => v2模块
  4. 清除 __webpack_module_cache__[moduleId]
  5. v-if 销毁旧组件 → $nextTick → v-if 重建新组件
     → data() 产生新的 () => import('appC/TodoList')
     → webpack require 执行新工厂 → 返回 v2 组件
```

### 2.2 为什么需要覆写工厂

webpack 5 MF 的 `__webpack_require__.f.remotes` 内部有一个 `data.p` 闭包变量：

```javascript
// webpack 生成的 remotes 加载逻辑（简化）
var data = [moduleId, "default", "./TodoList", remoteModuleId]
// data.p 初始为 undefined

f.remotes = function(chunkId, promises) {
  if (data.p) return  // ← 已加载过，直接跳过！
  // ... 加载逻辑 ...
  data.p = 1  // 标记为已加载
}
```

`data.p = 1` 后，后续的 `import('appC/TodoList')` 不会再走远程加载流程，而是直接从 `__webpack_module_cache__` 取缓存。所以我们必须：
- 覆写 `__webpack_modules__` 中的工厂函数（让 require 执行新逻辑）
- 清除 `__webpack_module_cache__` 中的缓存（让 require 重新执行工厂）

### 2.3 获取 webpack require 的方法

`__webpack_module_cache__` 和 `__webpack_modules__` 是 webpack IIFE 闭包内的局部变量，无法从全局作用域访问。通过 `webpackChunk.push` 的第三个参数可以拿到 `__webpack_require__` 引用：

```javascript
globalThis.webpackChunkapp_a_v3.push([
  [`__probe_${Date.now()}`],  // chunkId（任意唯一值）
  {},                          // modules（空）
  function (req) {             // runtime function — 参数就是 __webpack_require__
    wpRequire = req
  },
])
```

拿到 `req` 后：
- `req.c` = `__webpack_module_cache__`
- `req.m` = `__webpack_modules__`
- `req.I('default')` = `__webpack_init_sharing__('default')`
- `req.S.default` = `__webpack_share_scopes__.default`

> ⚠️ **变量命名陷阱**：源码中不能将变量命名为 `__webpack_require__`，webpack 会将其重命名为 `__nested_webpack_require_XXXX__`，导致闭包引用断裂。必须使用其他名称（如 `wpRequire`）。

---

## 3. 卸载与更新机制

### 3.1 卸载流程总览

```
┌─────────────────────────────────────────────────────────────┐
│  版本切换卸载流程                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Vue 层 ─────────────────────────────────────────────┐   │
│  │  v-if="false" → 销毁 RemoteLoader 组件实例            │   │
│  │  → Vue 自动调用 beforeDestroy/destroyed               │   │
│  │  → Vue 自动移除 DOM                                   │   │
│  │  → 组件 data 中的工厂函数引用被 GC                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Webpack 层 ─────────────────────────────────────────┐   │
│  │  1. 移除旧 <script data-remote="appC"> 标签           │   │
│  │  2. 清除 window.appC（为新容器腾位置）                 │   │
│  │  3. 加载新版本 emp.js → window.appC = v2 容器         │   │
│  │  4. container.init(shareScope) + get('./TodoList')    │   │
│  │  5. 遍历 req.c，delete 包含 appC/remote/container 的  │   │
│  │  6. 遍历 req.m，覆写对应工厂为 () => newModule        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ 重建 ──────────────────────────────────────────────┐    │
│  │  $nextTick → v-if="true" → 新 RemoteLoader 实例      │   │
│  │  → data() 产生新的 () => import('appC/TodoList')      │   │
│  │  → Vue 调用工厂 → webpack require → 执行新工厂        │   │
│  │  → 返回 v2 组件 → 渲染                               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 需要清理的内容

| 清理项 | 方式 | 必要性 | 说明 |
|--------|------|--------|------|
| Vue 组件实例 | `v-if="false"` 触发 Vue 自动销毁 | ✅ 必须 | 释放旧组件的事件监听、定时器等 |
| DOM 节点 | Vue 自动移除 | ✅ 必须 | v-if 销毁时自动处理 |
| 旧 `<script>` 标签 | `removeChild` | ⚠️ 建议 | 防止 DOM 堆积 |
| `window.appC` | `try delete` / `= undefined` | ✅ 必须 | 为新容器腾位置 |
| `req.c[moduleId]` | `delete` | ✅ 必须 | 清除模块缓存，强制重新执行工厂 |
| `req.m[moduleId]` | 覆写为新工厂 | ✅ 必须 | 让后续 require 返回新版本模块 |
| 异步组件工厂函数缓存 | 销毁组件实例（v-if） | ✅ 必须 | Vue 2 在 factory.resolved 上缓存结果 |

### 3.3 不需要清理的内容

| 项目 | 原因 |
|------|------|
| `__webpack_require__.S`（shared scope） | v1/v2 共享同版本 Vue，scope 可复用 |
| `data.p`（remote 加载状态） | 闭包变量无法访问，但不影响方案（我们手动加载绕过了它） |
| CDN 加载的全局变量（Vue、ElementUI） | 所有版本共用，不需要重新加载 |

### 3.4 完整切换时序

```
用户点击 "v2" 按钮
    │
    ▼
Home.vue: onVersionChange('v2')
    │
    ├─ this.show = false
    │     → Vue 销毁 RemoteLoader 实例
    │     → 旧组件 beforeDestroy/destroyed 执行
    │     → DOM 移除
    │     → data 中的 () => import('appC/TodoList') 引用释放
    │
    ├─ await versionSwitcher.switchTo('v2')
    │     │
    │     ├─ 1. 移除旧 <script data-remote="appC">
    │     ├─ 2. delete window.appC（或设为 undefined）
    │     ├─ 3. 创建新 <script src="http://localhost:8003/emp.js">
    │     ├─ 4. onload:
    │     │     ├─ getWebpackRequire() → 通过 chunk push 获取 req
    │     │     ├─ await req.I('default')  ← init sharing
    │     │     ├─ container = window.appC（v2 容器）
    │     │     └─ await container.init(req.S.default)
    │     ├─ 5. factory = await container.get('./TodoList')
    │     ├─ 6. newModule = factory()
    │     └─ 7. overwriteWebpackFactory(newModule)
    │           ├─ 遍历 req.c，delete 含 appC/remote/container 的 key
    │           └─ 遍历 req.m，覆写对应工厂
    │
    └─ this.$nextTick(() => { this.show = true })
          → Vue 创建新 RemoteLoader 实例
          → data() 执行，产生新的 () => import('appC/TodoList')
          → Vue 解析异步组件，调用工厂函数
          → import() 触发 webpack require
          → cache miss → 执行覆写后的工厂 → 返回 v2 模块
          → 渲染 v2 组件
```

---

## 4. 静态导入 vs 动态导入：为什么 `import Comp from 'appC/TodoList'` 会导致切换失败

### 4.1 问题现象

将 RemoteLoader.vue 改为静态导入后，版本切换失败——始终显示 v1 组件：

```vue
<!-- ❌ 错误写法 -->
<script>
import Comp from 'appC/TodoList'  // 静态导入
export default {
  data() {
    return { Comp }  // 每次都是同一个引用
  }
}
</script>
```

### 4.2 根因分析

#### 静态导入的执行时机

`import Comp from 'appC/TodoList'` 是 ES Module 静态导入，在**模块加载时**（即 RemoteLoader.vue 文件首次被 webpack require 时）就已经 resolve：

```
时间线：
─────────────────────────────────────────────────────────────
t0: 页面加载
    → webpack 加载 RemoteLoader.vue 模块
    → 执行 import Comp from 'appC/TodoList'
    → webpack require('appC/TodoList') → 返回 v1 组件
    → Comp = v1 组件（模块作用域变量，此后不再变化）

t1: 首次渲染
    → new RemoteLoader() → data() → { Comp } → 渲染 v1 ✅

t2: 用户切换到 v2
    → versionSwitcher.switchTo('v2') → 覆写 webpack 工厂 ✅
    → v-if 销毁旧实例 → $nextTick → v-if 重建新实例
    → new RemoteLoader() → data() → { Comp }
    → 但 Comp 仍然是 t0 时 resolve 的 v1 引用！❌
─────────────────────────────────────────────────────────────
```

#### 关键区别

| | `import Comp from 'appC/TodoList'` | `() => import('appC/TodoList')` |
|---|---|---|
| 求值时机 | 模块加载时（一次性） | 函数被调用时（每次） |
| 结果存储 | 模块作用域变量（固定） | 无缓存，每次重新 require |
| v-if 重建后 | data() 引用同一个模块变量 | data() 产生新函数，调用时走新工厂 |
| 能否感知工厂覆写 | ❌ 不能 | ✅ 能 |

#### 本质原因

```javascript
// 静态导入编译后（简化）：
var Comp = __webpack_require__('appC/TodoList')  // 执行一次，结果固化

// 动态导入编译后（简化）：
() => __webpack_require__.e('appC/TodoList')
      .then(__webpack_require__.bind(null, 'appC/TodoList'))
// ↑ 每次调用都重新走 require，能命中覆写后的工厂
```

### 4.3 正确写法

```vue
<!-- ✅ 正确写法 -->
<script>
export default {
  data() {
    return {
      Comp: () => import('appC/TodoList')  // 延迟求值
    }
  }
}
</script>
```

每次组件实例被 `v-if` 重建时，`data()` 产生一个**新的函数对象**。Vue 2 解析异步组件时调用这个函数，此时 `import()` 走 webpack require，命中已覆写的工厂，返回新版本模块。

### 4.4 Vue 2 异步组件缓存机制

Vue 2 对异步组件工厂有额外的缓存层：

```javascript
// Vue 2 源码（src/core/vdom/helpers/resolve-async-component.js）
function resolveAsyncComponent(factory, ...) {
  if (factory.resolved) {
    return factory.resolved  // ← 直接返回缓存！
  }
  // ... 首次调用才执行 factory()
  // resolve 后设置 factory.resolved = component
}
```

这意味着：
- 同一个函数引用，resolve 一次后永远返回缓存
- 必须用**新的函数引用**才能绕过这个缓存
- `v-if` 销毁组件实例 → `data()` 重新执行 → 产生新函数 → 绕过缓存

---

## 5. 详细实现

### 5.1 项目结构

```
packages/app-a-v3/
├── package.json
├── emp-config.js
└── src/
    ├── main.js                    (异步入口)
    ├── bootstrap.js               (Vue 挂载)
    ├── App.vue                    (导航栏 + router-view)
    ├── router.js                  (路由配置)
    ├── components/
    │   └── RemoteLoader.vue       (容器组件：封装异步 import)
    └── utils/
        └── version-switcher.js    (核心：加载容器 + 覆写工厂 + 清缓存)
    └── views/
        └── Home.vue               (版本切换 UI，v-if 控制 RemoteLoader)
```

### 5.2 version-switcher.js（核心）

```javascript
/**
 * VersionSwitcher - 通过动态加载远程容器 + 覆写 webpack 模块工厂实现版本切换
 *
 * 核心原理：
 * - 通过 webpackChunk push 的第三个参数（runtime function）获取 __webpack_require__
 * - __webpack_require__.c = 模块缓存（__webpack_module_cache__）
 * - __webpack_require__.m = 模块注册表（__webpack_modules__）
 * - 覆写 .m 中 remote 模块的工厂 + 清除 .c 中的缓存
 * - 再次 import('appC/TodoList') 时 webpack 执行新工厂，返回新版本组件
 */

const VERSION_MAP = {
  v1: 'http://localhost:8002/emp.js',
  v2: 'http://localhost:8003/emp.js',
}

// 注意：变量名不能用 __webpack_require__，否则会被 webpack 重命名
let wpRequire = null

function getWebpackRequire() {
  if (wpRequire) return wpRequire

  const chunkName = 'app_a_v3'
  const globalChunk = globalThis[`webpackChunk${chunkName}`]
  if (!globalChunk) {
    throw new Error(`[VersionSwitcher] webpackChunk${chunkName} not found`)
  }

  globalChunk.push([
    [`__version_switcher_probe_${Date.now()}`],
    {},
    function (req) {
      wpRequire = req
    },
  ])

  if (!wpRequire) {
    throw new Error('[VersionSwitcher] Failed to obtain webpack require')
  }

  return wpRequire
}

/**
 * 动态加载远程容器
 */
function loadRemoteApp(remoteUrl, scope) {
  return new Promise((resolve, reject) => {
    const oldScript = document.querySelector(`script[data-remote="${scope}"]`)
    if (oldScript) {
      oldScript.parentNode.removeChild(oldScript)
    }

    try { delete window[scope] } catch (e) { window[scope] = undefined }

    const script = document.createElement('script')
    script.src = remoteUrl
    script.type = 'text/javascript'
    script.async = true
    script.setAttribute('data-remote', scope)

    script.onload = async () => {
      const req = getWebpackRequire()
      await req.I('default')
      const container = window[scope]
      if (!container) {
        reject(new Error(`容器 "${scope}" 加载后未在 window 上注册`))
        return
      }
      await container.init(req.S.default)
      resolve(container)
    }

    script.onerror = () => reject(new Error(`加载子应用失败: ${remoteUrl}`))
    document.head.appendChild(script)
  })
}

/**
 * 动态获取远程模块
 */
async function getRemoteComponent(remoteUrl, scope, module) {
  const container = await loadRemoteApp(remoteUrl, scope)
  const factory = await container.get(module)
  return factory()
}

/**
 * 覆写 webpack 模块工厂 + 清除缓存
 */
function overwriteWebpackFactory(newModule) {
  const req = getWebpackRequire()
  const cache = req.c
  const modules = req.m

  Object.keys(cache).forEach(key => {
    if (key.includes('appC') || key.includes('remote') || key.includes('container')) {
      delete cache[key]
    }
  })

  Object.keys(modules).forEach(key => {
    if (key.includes('appC') || key.includes('remote') || key.includes('container')) {
      modules[key] = (module) => {
        module.exports = newModule
      }
    }
  })
}

class VersionSwitcher {
  constructor() {
    this.currentVersion = 'v1'
  }

  async switchTo(version) {
    if (version === this.currentVersion) return

    const url = VERSION_MAP[version]
    if (!url) throw new Error(`未知版本: ${version}`)

    // 1. 动态加载新版本容器并获取模块
    const newModule = await getRemoteComponent(url, 'appC', './TodoList')

    // 2. 覆写 webpack 工厂 + 清缓存
    overwriteWebpackFactory(newModule)

    this.currentVersion = version
  }

  getVersion() {
    return this.currentVersion
  }
}

export default new VersionSwitcher()
```

### 5.3 RemoteLoader.vue（容器组件）

```vue
<template>
  <component :is="Comp" />
</template>

<script>
export default {
  name: 'RemoteLoader',
  data() {
    return {
      Comp: () => import('appC/TodoList')
    }
  }
}
</script>
```

**设计要点**：
- 每次实例化时 `data()` 产生新的工厂函数
- `v-if` 销毁实例后，旧函数上的 `factory.resolved` 缓存随之消失
- 重建时新函数无缓存，Vue 重新调用 → 命中覆写后的 webpack 工厂

### 5.4 Home.vue（业务页面）

```vue
<template>
  <div class="home">
    <div class="version-control">
      <el-radio-group v-model="currentVersion" @change="onVersionChange">
        <el-radio-button label="v1">v1 - Basic (port 8002)</el-radio-button>
        <el-radio-button label="v2">v2 - Enhanced (port 8003)</el-radio-button>
      </el-radio-group>
    </div>

    <div class="remote-container">
      <RemoteLoader v-if="show" />
    </div>
  </div>
</template>

<script>
import versionSwitcher from '../utils/version-switcher'
import RemoteLoader from '../components/RemoteLoader.vue'

export default {
  name: 'Home',
  components: { RemoteLoader },
  data() {
    return {
      currentVersion: 'v1',
      show: true,
    }
  },
  methods: {
    async onVersionChange(version) {
      this.show = false                      // 1. 销毁旧组件
      await versionSwitcher.switchTo(version) // 2. 加载新版本 + 覆写工厂
      this.$nextTick(() => {
        this.show = true                     // 3. 重建组件（新工厂生效）
      })
    },
  },
}
</script>
```

---

## 6. 关键实现细节

### 6.1 `$nextTick` 的必要性

```javascript
this.show = false
await versionSwitcher.switchTo(version)
this.show = true  // ❌ 同一个 tick 内，Vue 批处理会合并为 "无变化"
```

Vue 2 的响应式更新是异步批处理的。如果 `show` 在同一个微任务中从 `false` 变回 `true`，Vue 的 watcher 队列会认为值没有变化，不会触发 DOM 更新。必须用 `$nextTick` 确保 `false` 的 DOM 更新已完成后再设为 `true`。

### 6.2 `window.appC` 的 delete 问题

```javascript
// emp.js 构建产物开头：
var appC;  // var 声明在全局作用域创建不可配置属性

// 因此 delete window.appC 可能抛 TypeError
try {
  delete window[scope]
} catch (e) {
  window[scope] = undefined  // fallback：新 emp.js 加载后会重新赋值覆盖
}
```

### 6.3 container.init() 的安全性

v2 的 `emp.js` 是全新加载的脚本，其内部有独立的 webpack runtime。调用 `container.init(req.S.default)` 时：
- `req.S.default` 是 Host（app-a-v3）的 shared scope
- v2 容器内部的 `__webpack_require__.S` 初始为空
- 不会触发 "Container initialization failed" 错误

### 6.4 模块 ID 匹配策略

开发模式下 webpack 模块 ID 是字符串（如 `"webpack/container/remote/appC/TodoList"`），通过 `key.includes('appC')` 匹配。生产模式下 ID 可能是数字，需要更精确的定位策略（如构建时固定 ID 或首次加载后记录）。

---

## 7. 风险与局限

| 风险 | 概率 | 缓解措施 |
|------|------|---------|
| 生产模式 moduleId 为数字，`includes('appC')` 匹配失败 | 高 | 通过 webpack 插件固定 ID，或首次加载后记录映射 |
| webpack 版本升级改变内部结构（req.c/req.m） | 中 | 锁定 webpack 版本，升级时验证 |
| `webpackChunk` 全局变量名与 output.uniqueName 不一致 | 低 | 确保 chunk 名与 emp-config 中的 name 对应 |
| 多个 remote 同时使用时，模糊匹配误清其他 remote 的缓存 | 中 | 使用更精确的 moduleId 匹配（如 `key.startsWith('webpack/container/remote/appC')`) |

---

## 8. 复杂项目适用性分析

### 8.1 问题：静态导入无法被切换

在真实复杂项目中，Remote 暴露的不只是一个组件，还有常量、工具函数、配置对象等。消费方通常大量使用静态导入：

```javascript
import { API_URL, THEME } from 'appC/config'
import { formatDate } from 'appC/utils'
import TodoList from 'appC/TodoList'
```

这些静态导入在模块加载时就已 resolve，变量绑定固定在模块作用域中。无论后续如何覆写 webpack 工厂、清除缓存，**已执行过的模块不会重新执行**，这些变量永远指向 v1 的值。

### 8.2 能切换 vs 不能切换

| 场景 | 能否切换 | 原因 |
|------|---------|------|
| Remote 组件内部使用自己的常量/函数 | ✅ 能 | 整个 remote 模块从 v2 容器重新获取，内部引用自然是 v2 的 |
| Host 通过 `() => import('appC/xxx')` 动态导入 | ✅ 能 | 每次调用走 webpack require，命中新工厂 |
| Host 通过 `import { xxx } from 'appC/xxx'` 静态导入 | ❌ 不能 | 模块已执行完毕，变量绑定固定为 v1 |
| Host 多个文件分散静态导入 remote 的不同模块 | ❌ 不能 | 每个文件的模块作用域变量都已固化 |

### 8.3 改造成本评估

如果要让复杂项目中所有 remote 导入都支持版本切换，需要将所有静态导入改为动态导入：

```javascript
// ❌ 改造前（散落在几十个文件中）
import { API_URL } from 'appC/config'
console.log(API_URL)

// ✅ 改造后
const mod = await import('appC/config')
console.log(mod.API_URL)
```

这意味着：
- 所有使用 remote 导出的文件都需要改造
- 代码从同步变为异步，调用方式变丑
- 无法在模块顶层使用 remote 的常量（顶层 await 需要 ES Module 环境）
- 改造成本与 remote 被消费的广度成正比

### 8.4 各方案对比

| 方案 | 组件切换 | 常量/函数切换 | 改造成本 | 适用场景 |
|------|---------|-------------|---------|---------|
| **覆写工厂 (app-a-v3)** | 需动态导入 | 需动态导入 | 高（全改 dynamic import） | 单组件 demo、原理验证 |
| **RemoteLoader (app-a-v2)** | ✅ | 同样不覆盖静态导入 | 中 | 组件级切换 |
| **整页刷新 + 切换 remotes URL** | ✅ | ✅ | 低 | 全量版本切换（灰度发布） |
| **iframe 隔离 (wujie 等)** | ✅ | ✅ | 低 | 完全隔离的子应用 |

### 8.5 结论

**覆写工厂方案不适合作为复杂项目的通用版本切换策略。**

其根本局限在于：webpack 模块系统中，已执行的模块不会因为工厂被覆写而重新执行。只有**尚未执行**或**通过动态 import() 重新触发**的模块才能感知到工厂变化。

适用场景：
- ✅ 原理研究和教学演示
- ✅ 单个组件的动态版本切换（如 A/B 测试某个组件）
- ✅ Remote 只暴露组件、且 Host 只通过动态 import 消费的简单架构

不适用场景：
- ❌ Remote 暴露大量模块（组件 + 常量 + 工具函数），Host 多处静态导入
- ❌ 需要整个子应用从 v1 完整切换到 v2（包括所有导出）
- ❌ 对生产环境稳定性要求高的场景（依赖 webpack 内部结构）

**如果目标是"整个 remote 应用从 v1 切到 v2，包括它暴露的一切"，最可靠的方式是：**

1. **整页刷新** — 切换 remotes 入口 URL 后 `location.reload()`，零改造成本，所有模块重新加载
2. **iframe 隔离** — 子应用完全独立运行，版本切换就是换 iframe src

---

## 9. 验证结果

| 验证项 | 结果 |
|--------|------|
| 首次加载走 webpack 静态 remotes，v1 组件正常显示 | ✅ 通过 |
| 切换到 v2，组件替换为增强版（紫色主题 + 筛选功能） | ✅ 通过 |
| 切回 v1，组件恢复为基础版（绿色主题） | ✅ 通过 |
| 浏览器 console 无报错 | ✅ 通过 |
| DOM 中旧 script 标签被移除 | ✅ 通过 |
| Todo 功能正常（添加/删除/筛选） | ✅ 通过 |
