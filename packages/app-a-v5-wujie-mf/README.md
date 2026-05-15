# Wujie 沙箱 + Module Federation 多版本隔离方案

## 1. 需求背景

### 1.1 业务场景

SaaS 多租户管理后台（A 站）基于 B 站代码改造而来。B 站存在多个历史版本（v1、v2），不同客户停留在不同版本。管理员在查看客户详情时，需要加载对应版本的 B 站模块，且可能**同时打开多个客户详情**（多版本同页面共存）。

### 1.2 核心挑战

| 挑战 | 说明 |
|------|------|
| 多版本共存 | 同一页面需同时运行 v1 和 v2 两个版本的子应用 |
| 同版本多实例 | 同一版本可能被多个客户详情 tab 同时使用，各实例状态互不影响 |
| 全局状态隔离 | 子应用依赖全局 Vuex store，无法改造为自包含组件 |
| CSS 隔离 | 不同版本的子应用样式不能互相污染 |
| 子应用不可改造 | B 站模块已有 EMP/MF 构建体系，不能为了嵌入而大幅重构 |

### 1.3 需求目标

1. 管理员点击客户列表中的客户，打开对应版本的子应用详情 tab
2. 多个 tab 可同时打开，各自独立运行（JS 隔离、CSS 隔离、Vuex 隔离）
3. 切换 tab 时已加载的子应用瞬时显示（缓存保活）
4. 关闭 tab 时释放资源
5. 主应用可向子应用传递客户上下文信息

---

## 2. 技术方案

### 2.1 方案选型

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| iframe 原生 | 天然隔离 | 通信复杂、性能差、无法共享资源 | ❌ |
| qiankun | 社区成熟 | 单实例模式，同一子应用无法多开 | ❌ |
| Module Federation 直接加载 | 性能好 | 无运行时隔离，全局变量/CSS 冲突 | ❌ |
| **Wujie + MF** | 独立沙箱 + 多实例 + alive 缓存 | 需要额外引入 wujie | ✅ |

**最终方案：Wujie 提供运行时隔离（独立 JS 沙箱、CSS 隔离），EMP/MF 是子应用的构建体系（已有，不变）。两者各管各的层面，不冲突。**

### 2.2 架构设计

```
┌─────────────────────────────────────────────────────────┐
│  app-a-v5-wujie-mf (Host, Rspack, port 9010)           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Customer Table (el-table)                      │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Tab Panel (el-tabs)                            │    │
│  │                                                 │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐        │    │
│  │  │ Tab A   │  │ Tab B   │  │ Tab C   │        │    │
│  │  │ Wujie   │  │ Wujie   │  │ Wujie   │        │    │
│  │  │ ↓       │  │ ↓       │  │ ↓       │        │    │
│  │  │app-c-v3 │  │app-c-v4 │  │app-c-v3 │        │    │
│  │  │port:9008│  │port:9009│  │port:9008│        │    │
│  │  │客户X    │  │客户Y    │  │客户Z    │        │    │
│  │  └─────────┘  └─────────┘  └─────────┘        │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

每个 Wujie 实例拥有：
- 独立的 `window` 对象（JS 沙箱）
- 独立的 Vuex store 实例
- 独立的 CSS 作用域
- 独立的 DOM 树

### 2.3 Wujie 关键配置

```vue
<WujieVue
  :name="`customer-${customer.id}`"
  :url="versionUrlMap[customer.version]"
  :alive="true"
  :props="{ customerId: customer.id, customerName: customer.name }"
/>
```

| 配置项 | 值 | 作用 |
|--------|-----|------|
| `name` | `customer-${id}` | 按客户 ID 唯一，确保每个客户独立沙箱 |
| `url` | 按版本映射 | v1 → port 9008, v2 → port 9009 |
| `alive` | `true` | 保持沙箱存活，切换 tab 时不销毁，瞬时恢复 |
| `props` | 客户上下文 | 子应用通过 `window.$wujie.props` 读取 |

### 2.4 端口分配

| 应用 | 端口 | 角色 | 构建工具 |
|------|------|------|----------|
| app-c-v3 | 9008 | 子应用 v1（Basic TodoList） | EMP 3.x (Rspack) |
| app-c-v4 | 9009 | 子应用 v2（Enhanced TodoList） | EMP 3.x (Rspack) |
| app-a-v5-wujie-mf | 9010 | Host 主应用 | Rspack + vue-loader |

### 2.5 数据流

```
主应用 Vuex Store                    子应用 Vuex Store (每实例独立)
┌──────────────────┐                ┌──────────────────┐
│ openTabs: []     │                │ operationCount: 0│
│ activeTab: null  │                └──────────────────┘
└──────────────────┘
        │                                    ▲
        │ openCustomerTab()                  │ incrementOps()
        │ closeCustomerTab()                 │
        │ setActiveTab()                     │
        ▼                                    │
┌──────────────────┐    props 通信    ┌──────────────────┐
│ Customers.vue    │ ──────────────→ │ 子应用 App.vue   │
│ (Tab 管理)       │  customerId     │ window.$wujie    │
│                  │  customerName   │   .props         │
└──────────────────┘                 └──────────────────┘
```

---

## 3. 实现详情

### 3.1 目录结构

```
packages/app-a-v5-wujie-mf/
├── package.json
├── index.html
├── rspack.config.mjs
└── src/
    ├── main.js                 # 入口：注册 Vue/Router/ElementUI/Wujie
    ├── App.vue                 # 导航栏 + router-view
    ├── router.js               # / → Home, /customers → Customers
    ├── store/index.js          # Vuex: openTabs[], activeTab
    ├── data/customers.js       # Mock 客户数据
    ├── views/
    │   ├── Home.vue            # 说明页
    │   └── Customers.vue       # 客户表 + Tab 详情面板
    └── components/
        ├── CustomerTable.vue   # el-table 客户列表
        └── CustomerDetail.vue  # Wujie 容器组件
```

### 3.2 核心组件实现

#### CustomerDetail.vue — Wujie 容器

```vue
<template>
  <div class="customer-detail">
    <WujieVue
      :name="`customer-${customer.id}`"
      :url="appUrl"
      :alive="true"
      :props="wujieProps"
      width="100%"
      height="500px"
    />
  </div>
</template>

<script>
const versionUrlMap = {
  v1: 'http://localhost:9008',
  v2: 'http://localhost:9009',
}

export default {
  name: 'CustomerDetail',
  props: {
    customer: { type: Object, required: true },
  },
  computed: {
    appUrl() {
      return versionUrlMap[this.customer.version]
    },
    wujieProps() {
      return {
        customerId: this.customer.id,
        customerName: this.customer.name,
      }
    },
  },
}
</script>
```

#### Customers.vue — Tab 管理 + 资源释放

```vue
<script>
import { destroyApp } from 'wujie'

export default {
  methods: {
    closeTab(customerId) {
      destroyApp(`customer-${customerId}`)  // 释放 Wujie 沙箱
      this.$store.commit('closeCustomerTab', customerId)
    },
  },
}
</script>
```

### 3.3 子应用改造（app-c-v3 / app-c-v4）

改动极小，仅添加：

1. **Vuex Store** — `operationCount` 计数器，验证多实例隔离
2. **Wujie Props 读取** — `window.$wujie?.props` 显示客户上下文
3. **操作计数** — TodoList 增删时 `this.$store.commit('incrementOps')`

子应用的 EMP 构建配置、Module Federation 暴露方式均**不需要任何修改**。

### 3.4 构建配置要点

#### resolve.alias 解决 Vue 实例重复问题

```js
// rspack.config.mjs
resolve: {
  alias: {
    vue$: path.resolve(__dirname, 'node_modules/vue/dist/vue.esm.js'),
  },
}
```

**原因**：pnpm 严格依赖隔离下，Element UI 内部的 `require("vue")` 可能解析到与应用代码不同的 Vue 实例。两个 Vue 实例意味着两套独立的响应式系统，导致 Element UI 组件（如 el-table）内部状态变更无法触发视图更新。通过 alias 强制所有模块共享同一个 Vue。

---

## 4. 隔离验证

### 4.1 验证矩阵

| 验证项 | 预期结果 | 验证方式 |
|--------|----------|----------|
| 多版本加载 | v1 客户加载 app-c-v3，v2 客户加载 app-c-v4 | 观察 UI 差异（绿色 vs 紫色主题） |
| JS 隔离 | Tab A 添加 todo 不影响 Tab B | 在不同 tab 操作，观察列表独立 |
| Vuex 隔离 | 各 tab 的 operationCount 独立递增 | 在 Tab A 操作 3 次显示 3，Tab B 显示 0 |
| CSS 隔离 | 不同版本样式不互相污染 | v1 绿色边框，v2 紫色边框，互不影响 |
| alive 缓存 | 切换 tab 时已加载的子应用瞬时显示 | 切换 tab 无白屏/重新加载 |
| 资源释放 | 关闭 tab 后沙箱销毁 | 关闭后重新打开同一客户，状态重置 |
| Props 通信 | 子应用显示 "Viewing as: [客户名]" | 观察 context-banner |

### 4.2 启动方式

```bash
# 终端 1：子应用 v1
cd packages/app-c-v3 && pnpm dev    # port 9008

# 终端 2：子应用 v2
cd packages/app-c-v4 && pnpm dev    # port 9009

# 终端 3：主应用
cd packages/app-a-v5-wujie-mf && pnpm dev    # port 9010
```

访问 http://localhost:9010/#/customers

---

## 5. 踩坑记录

### 5.1 Element UI el-table 空白不渲染

**现象**：表格有行但单元格内容为空，表头也为空。

**根因**：pnpm monorepo 中 Rspack 打包时，Element UI 内部引用的 Vue 构造函数和应用代码引用的 Vue 构造函数不是同一个对象引用（`appVueCtor === storeVueCtor` 为 `false`）。两套 Vue 实例的响应式系统（Dep/Watcher）互不相通，导致 Element UI table store 的数据变更无法触发 table-body/table-header 组件的 computed 更新。

**修复**：`rspack.config.mjs` 添加 `resolve.alias.vue$` 指向项目自身的 Vue ESM 文件。

### 5.2 Element UI el-select 下拉浮层在 Wujie 沙箱中不显示

**现象**：子应用中的 `el-select` 点击后无下拉浮层弹出，看不到选项列表。

**根因**：Element UI 的 `el-select` 默认将下拉面板（Popper）通过 `append-to-body` 追加到 `document.body`。在 Wujie 沙箱中，子应用的 JS 运行在 iframe 内，而 DOM 渲染在主应用的 WebComponent（Shadow DOM）中。Popper 追加到 iframe 的 `body` 后，该 DOM 节点不在可见的渲染树中，导致浮层不可见。

**修复**：给 `el-select` 添加 `:popper-append-to-body="false"`，使下拉面板渲染在组件自身的 DOM 树内。

```vue
<el-select v-model="value" :popper-append-to-body="false">
```

**影响范围**：所有使用 Popper 的 Element UI 组件在 Wujie 沙箱中都可能有此问题，包括 `el-select`、`el-date-picker`、`el-popover`、`el-tooltip`、`el-dropdown` 等。统一加 `:popper-append-to-body="false"` 或 `:append-to-body="false"` 即可。

### 5.3 wujie-vue2 的 "style" reserved attribute 警告

**现象**：控制台出现 `[Vue warn]: "style" is a reserved attribute and cannot be used as component prop`。

**根因**：wujie-vue2 库内部的 render 函数实现问题，非应用代码导致。

**处理**：忽略，不影响功能。

---

## 6. 总结

本方案通过 **Wujie 沙箱**实现了多版本微前端的运行时隔离，解决了 SaaS 多租户场景下同页面加载多个版本子应用的核心需求。关键优势：

1. **子应用零改造** — EMP/MF 构建体系不变，仅添加少量 Vuex 和 props 读取代码用于验证
2. **真正的多实例隔离** — 每个客户详情 tab 拥有独立的 JS 沙箱、CSS 作用域、Vuex store
3. **性能友好** — alive 模式保持沙箱存活，tab 切换无需重新加载
4. **资源可控** — 关闭 tab 时通过 `destroyApp` 显式释放沙箱资源
5. **通信简洁** — 通过 Wujie props 机制传递客户上下文，无需复杂的跨应用通信
