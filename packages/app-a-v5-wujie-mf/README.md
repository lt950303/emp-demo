# Wujie + Module Federation 混搭方案：障碍分析与架构决策

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
| 子应用不可改造 | B 站模块已有 EMP/MF 构建体系，且子应用本身也是 MF Host |

### 1.3 关键约束

**子应用架构与主应用完全一致**——子应用本身也是 MF Host，内部消费其他 remote 组件，拥有完整的 MF 运行时、全局注册表、CDN 共享依赖链。这不是一个简单的"组件被加载"的场景，而是"一个完整的 MF 生态系统需要被隔离嵌入"。

---

## 2. 方案选型与结论

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| iframe 原生 | 天然完整隔离，子应用零改造 | 通信需 postMessage | ✅ **推荐** |
| Wujie + MF | 多实例 + alive 缓存 | 与 MF 架构根本性冲突 | ❌ **不可行** |
| qiankun | 社区成熟 | 单实例模式，同一子应用无法多开 | ❌ |
| MF 直接加载 | 性能好 | 无运行时隔离，全局变量/CSS 冲突 | ❌ |

**最终结论：MF 项目嵌套 MF 项目做多版本/灰度隔离，应使用原生 iframe。**

---

## 3. 为什么 Wujie + MF 不可行：根本性冲突

### 3.1 核心矛盾

Module Federation 和 Wujie 在底层设计哲学上天然相克：

- **Module Federation**：拼命想在全局 `window` 上共享一切（注册表、运行时、共享依赖）
- **Wujie 沙箱**：拼命想在 `iframe` 里隔离一切（劫持 window、代理 document、拦截 DOM 操作）

两者在同一个 `window` 战场上目标完全相反。

### 3.2 Wujie 不是"增强版 iframe"

很多人误以为 Wujie 就是一个 iframe 的封装，实际上它的架构是**拆分式**的：

```
普通 iframe（完整浏览上下文）:
┌─────────────────────────┐
│ iframe                  │
│  JS 执行 ← 在这里       │
│  DOM 渲染 ← 也在这里    │
└─────────────────────────┘

Wujie（拆分式架构）:
┌─────────────────────────┐
│ 隐藏 iframe (不可见)     │
│  JS 执行 ← 在这里       │
└─────────────────────────┘
         │ 劫持 document / window / DOM API
         │ 重定向所有 DOM 操作
         ▼
┌─────────────────────────┐
│ 主应用 Shadow DOM        │
│  DOM 渲染 ← 在这里       │
└─────────────────────────┘
```

Wujie 把子应用的 **JS 执行**和 **DOM 渲染**拆到了两个不同的上下文。为了让这个拆分能工作，它必须重度劫持 iframe 内的原生 API：

- `document.createElement` → 重定向到 Shadow DOM
- `Node.prototype.appendChild` → 拦截后插入主应用
- `window` 属性访问 → Proxy 代理
- `<script>` 动态加载 → 拦截并改写路径

MF 的运行时恰好大量依赖这些被劫持的 API。每一步都踩在 Wujie 的拦截层上。

---

## 4. 四大障碍详解

### 障碍一：静态资源路径丢失（404 伪装成 JS）

**现象**：子应用 HTML 中包含 `<base href="/static/">` 标签，Wujie 没有自动模拟浏览器的 `base` 解析行为，导致异步加载的 JS（如 `dayjs.min.js`、`emp.js`）丢失了路径前缀。

**次生灾害**：请求错误地打到了主应用或错误的路由上，后端兜底返回了主应用的 `index.html`（内容以 `<!DOCTYPE html>` 开头）。Wujie 误认为这是合法的 JS 文本并塞进 iframe 运行：

```
Uncaught SyntaxError: Invalid or unexpected token
```

**根因**：Wujie 的资源加载拦截层不理解 MF 的资源加载约定（动态 script、base href 解析）。

---

### 障碍二：沙箱环境下的全局上下文丢失

**现象**：修复 URL 路径后，JS 资源能以 200 状态码正确返回，但报错立刻转移。

**报错**：
```
iframe.ts:588 Uncaught TypeError: Illegal invocation
```

**根因**：`dayjs` 或 MF 的打包产物在初始化时，会调用原生 DOM 方法（如 `Node.prototype.appendChild`）。Wujie 为了实现 JS→Shadow DOM 的重定向，对这些方法进行了劫持。在复杂的沙箱代理机制下，第三方库调用原生方法时丢失了正确的 `this` 上下文。

**本质**：Wujie 的 DOM API 劫持破坏了 MF 产物的运行假设——它们期望操作的是一个真实的、未被代理的 document。

---

### 障碍三：MF 全局注册表被沙箱吞噬

**现象**：路径对了，资源加载也成功了，但 MF 运行时依然报错，提示找不到组件或依赖。

**根因**：MF 极其依赖全局唯一的注册表（例如 `window.EMP_SHARE_RUNTIME`、`window.appC`）。

- **在 Wujie 常规沙箱下**：子应用加载 `emp.js` 后，把变量挂在了隔离的 `iframeWindow` 上，外面的主应用根本看不见 → "失联"
- **多实例并发时**：如果强行突破沙箱去改写主应用的 `window`，后加载的子应用会**覆盖**先加载的 → 版本错乱或崩溃

**本质**：MF 的全局注册表是单例设计，与 Wujie 的多实例隔离在架构上互斥。

---

### 障碍四：Webpack MF 运行时的严格契约校验

**现象**：为解决同名冲突，尝试使用 `Proxy` 代理对象做白名单共享（对白名单放行，其余隔离）。结果引来 MF 更底层的反弹：

```
The remote entry interface does not contain "init"
```

**根因**：Webpack 的 MF 运行时在加载 Remote 端时，有严格的强类型校验机制：

- 读取 `.init` 和 `.get` 方法
- 通过 `in` 操作符检测属性存在性
- 通过 `typeof` 检测类型
- 内部 `Symbol` 属性进行合法性检测

Proxy 对象无法完美欺骗 Webpack 极其严苛的运行时检查，Webpack 认为这个对象"不合法"而直接拒收。

**本质**：MF 运行时的设计假设是操作真实对象，任何代理层都会破坏其内部契约。

---

## 5. 障碍因果链

```
障碍一（路径丢失）
  ↓ 修复路径
障碍二（DOM API 劫持导致 this 丢失）
  ↓ 修复调用上下文
障碍三（全局注册表被隔离吞噬）
  ↓ 尝试 Proxy 白名单共享
障碍四（Webpack 拒绝 Proxy 对象）
  ↓ 无解 — 架构层面的根本性冲突
```

每修一个障碍就暴露下一个，因为根因不是某个具体 bug，而是两套架构在设计哲学上的对抗。

---

## 6. 灰度场景的额外恶化因素

当子应用本身也是 MF Host，且需要加载**同项目的不同灰度版本**时，问题进一步恶化：

| 恶化因素 | 说明 |
|----------|------|
| MF 容器名相同 | 两个版本的 MF 容器名相同或高度相似，全局注册表 key 冲突 |
| CDN 共享依赖版本不同 | v1 用 Vue 2.7.14，v2 可能用 Vue 2.7.16，CDN 全局变量互相覆盖 |
| 子应用内部也有 remote | 子应用自己也消费其他 MF remote，嵌套层级更深，冲突面更大 |
| EMP_SHARE_RUNTIME 单例 | EMP SDK 的运行时是全局单例，多版本无法共存 |

这不只是 Wujie 劫持的问题，还叠加了**同名 MF 容器在沙箱内外互相覆盖**的问题。

---

## 7. 正确方案：原生 iframe

### 7.1 为什么 iframe 可行

原生 iframe 提供**完整的、不被干扰的浏览器上下文**：

- JS 和 DOM 在同一个上下文里，没有拆分、没有劫持、没有代理
- 子应用在 iframe 里跑，和独立打开一个浏览器 tab 完全一样
- 子应用的 MF 生态（运行时、注册表、CDN 依赖、remote 加载）原封不动地工作
- 多个 iframe 之间天然隔离，不存在全局变量冲突

### 7.2 需求满足度

| 需求 | iframe 方案 | 实现方式 |
|------|-------------|----------|
| 多版本共存 | ✅ | 不同 iframe 加载不同版本 URL |
| 同版本多实例隔离 | ✅ | 每个 iframe 是独立浏览上下文 |
| JS/CSS/Vuex 隔离 | ✅ | iframe 天然完全隔离 |
| 子应用零改造 | ✅ | 子应用原样运行 |
| Tab 保活 | ✅ | v-show 控制 iframe 显隐 |
| 资源释放 | ✅ | 移除 iframe DOM 节点 |
| 主子通信 | ✅ | URL query params / postMessage |

### 7.3 实现示例

**主应用 — CustomerDetail.vue**

```vue
<template>
  <div class="customer-detail">
    <iframe
      :src="appUrl"
      width="100%"
      height="500px"
      frameborder="0"
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
      const base = versionUrlMap[this.customer.version]
      return `${base}?customerId=${this.customer.id}&customerName=${encodeURIComponent(this.customer.name)}`
    },
  },
}
</script>
```

**子应用 — 读取上下文参数**

```js
// bootstrap.js 中
const params = new URLSearchParams(window.location.search)
const customerId = params.get('customerId')
const customerName = params.get('customerName')
```

### 7.4 之前否掉 iframe 的理由复盘

| 当初的顾虑 | 实际情况 |
|------------|----------|
| 通信复杂 | 只需传 customerId/customerName，URL query param 即可，无需复杂的双向通信 |
| 性能差 | v-show 控制显隐即可保活，不需要反复加载；alive 场景下和 Wujie 无本质差异 |
| 无法共享资源 | 需求恰恰是**不共享**——要的就是隔离。共享反而是冲突的根源 |

---

## 8. 总结

### 决策原则

> **MF 项目嵌套 MF 项目做多版本/灰度隔离，用原生 iframe。**

### 原因

1. Wujie 的拆分式架构（JS 在 iframe，DOM 在 Shadow DOM）需要重度劫持原生 API，与 MF 运行时的设计假设根本性冲突
2. MF 的全局单例注册表与 Wujie 的多实例隔离在架构上互斥
3. Webpack MF 运行时的严格校验无法被任何代理层欺骗
4. 原生 iframe 提供完整的浏览上下文，子应用的 MF 生态原封不动运行，零冲突零改造

### 适用场景判断

- 子应用是**简单的独立页面**（无 MF、无全局依赖）→ Wujie 可用
- 子应用是**MF 应用**（有全局注册表、CDN 共享、动态 script 加载）→ 必须用原生 iframe
