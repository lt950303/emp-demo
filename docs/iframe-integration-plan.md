# A 项目嵌入 B 项目功能模块 — iframe 集成方案

## 一、背景与需求

### 1.1 项目现状

| 维度 | A 项目（SaaS） | B 项目（单租户） |
|------|----------------|------------------|
| 租户模式 | 多租户，数据按客户/权限隔离 | 单租户，整站数据属于一个客户 |
| 部署方式 | 多节点，单版本 | 多节点，**多版本** |
| 版本管理 | 全部客户使用同一版本 | 不同客户可能运行不同版本 |

### 1.2 需求描述

A 项目在针对某一单个客户的场景下（如客户详情页），需要直接嵌入 B 项目的若干功能展示模块。

示例：A 网站中查看客户 X 的介绍页时，用 3 个嵌入区域展示 B 项目的 3 个功能模块（如 dashboard、订单列表、统计概览），不同客户展示不同 B 实例的内容。

---

## 二、技术选型分析

### 2.1 核心约束

| 约束 | 影响 |
|------|------|
| B 多版本部署 | 不同客户对应的 B 实例可能是不同代码版本，组件接口/依赖/行为都可能不同 |
| B 单租户设计 | B 的模块内部假设"所有数据属于当前唯一客户"，没有客户切换能力 |
| A 需要按客户动态切换 | 查看客户 X 时嵌入客户 X 对应的 B 实例模块 |

### 2.2 方案对比

| 维度 | iframe | Module Federation |
|------|--------|-------------------|
| 多版本兼容 | 天然支持 | 无法保证（不同版本接口可能不一致，运行时崩溃） |
| B 项目改造量 | 零或极少 | 大量（需新增客户上下文、改造所有被消费模块） |
| 团队协调成本 | 低 | 高（A/B 团队需持续协调接口契约） |
| 用户体验 | 中等（可通过工程优化提升） | 好（原生组件级集成） |
| 实施风险 | 低 | 高 |
| 长期维护 | 独立演进，互不影响 | 版本升级需双方协调 |

### 2.3 选型结论

**采用 iframe 方案。**

关键理由：

1. **多版本问题**：Module Federation 要求远程模块接口一致，B 的不同版本无法保证这一点。iframe 加载的是完整页面，B 自己负责自己的渲染，A 不需要关心 B 的内部实现。
2. **零改造成本**：B 是单租户设计，使用 MF 需要 B 的每个模块都改造为"可接受外部客户上下文"。而 iframe 只需要 SSO + URL 即可，B 基本不需要改造。
3. **解耦**：iframe 方案下 A 和 B 完全独立演进，不存在版本耦合。

### 2.4 成熟框架选型（增强型 iframe 方案）

原生 iframe 需要手动处理通信、高度自适应、预加载等问题。以下成熟框架在 iframe 基础上提供了工程化封装，可减少重复工作。

#### 2.4.1 候选框架

**Wujie（无界）— 腾讯出品**

核心原理：iframe 做 JS 隔离 + WebComponent 做 DOM 渲染。

```
传统 iframe：
┌─ A 页面 ─────────────────────┐
│  ┌─ iframe ───────────────┐  │  ← 独立渲染上下文，高度/通信都是问题
│  │  B 页面（完整文档）      │  │
│  └────────────────────────┘  │
└──────────────────────────────┘

Wujie：
┌─ A 页面 ─────────────────────┐
│  ┌─ WebComponent ─────────┐  │  ← DOM 在 A 的文档流中（高度自适应）
│  │  B 的 DOM 内容          │  │
│  └────────────────────────┘  │
│  ┌─ 隐藏 iframe ──────────┐  │  ← JS 在 iframe 中执行（天然沙箱）
│  │  B 的 JS 上下文         │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

内置能力：
- 事件总线通信（`$wujie.bus.$emit / $on`），替代手写 postMessage
- 生命周期钩子（`beforeLoad`、`activated`、`loadError`）
- 内置 `preloadApp()` 预加载 API
- `alive` 模式实现 keep-alive
- 路由同步机制
- WebComponent Shadow DOM CSS 隔离
- Vue 2/3 官方组件（`wujie-vue2` / `wujie-vue3`）

使用示例：

```vue
<WujieVue
  name="b-dashboard"
  :url="getBInstanceUrl(currentCustomerId, 'dashboard')"
  :alive="true"
  :props="{ token: ssoToken }"
  @beforeLoad="showLoading"
  @activated="hideLoading"
  @loadError="handleError"
/>
```

> **跨域限制**：WebComponent 渲染模式在跨域场景下会降级为纯 iframe 模式（`degrade` 模式）。降级后通信、生命周期、预加载等框架能力仍然保留，但高度自适应需要回退到 postMessage 方案。

**Micro App — 京东出品**

从 v1.0 起支持 `iframe` 沙箱模式，思路类似 Wujie。

```vue
<micro-app
  name="b-dashboard"
  :url="getBInstanceUrl(currentCustomerId, 'dashboard')"
  iframe
  keep-alive
/>
```

内置能力与 Wujie 类似：事件通信、生命周期、预加载、keep-alive。

**Luigi — SAP 出品**

企业级 iframe 编排框架，设计初衷就是通过 iframe 集成独立应用。

特点：
- 纯 iframe 架构，不做 DOM 代理，跨域行为完全可预测
- 内置导航管理、权限控制、通信 API
- 子应用只需引入轻量 `@luigi-project/client` SDK（约 5KB）
- 企业级场景验证（SAP 自身产品在用）
- 技术栈无关

#### 2.4.2 框架对比（针对本场景）

| 维度 | Wujie | Micro App | Luigi | 手写 iframe |
|------|:-----:|:---------:|:-----:|:----------:|
| B 多版本支持 | 支持 | 支持 | 支持 | 支持 |
| 跨域支持 | 降级为纯 iframe | 降级为纯 iframe | 原生 iframe | 原生 iframe |
| B 侧改造量 | 极少 | 极少 | 引入 Client SDK | 手写 postMessage |
| 通信机制 | 事件总线 | getData/setData | Luigi Client API | 手写 postMessage |
| 高度自适应 | 同域自动 / 跨域手动 | 同域自动 / 跨域手动 | 需配置 | 手动 |
| 预加载 | 内置 | 内置 | 内置 | 手动 |
| keep-alive | 内置 | 内置 | 内置 | 手动 |
| 生态 / 文档 | 中文生态好 | 中文生态好 | 英文为主，企业级 | — |
| 学习成本 | 低 | 低 | 中 | 低（但工作量大） |

#### 2.4.3 框架选型建议

| 场景 | 推荐方案 | 理由 |
|------|---------|------|
| A 是 Vue 技术栈，追求开发效率 | **Wujie** | Vue 官方组件开箱即用，中文社区活跃，跨域降级后仍保留框架能力 |
| 更看重跨域稳定性和可预测性 | **Luigi** | 纯 iframe 架构，不存在降级问题，企业级验证 |
| 只嵌入 2-3 个简单展示模块 | **手写 iframe** | 引入框架的 ROI 不高，本文档第四章的工程优化方案已足够 |

---

## 三、架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────┐
│  A 项目（SaaS 多租户）                                │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  客户详情页（客户 X）                            │  │
│  │                                               │  │
│  │  ┌─────────────┐ ┌────────────┐ ┌──────────┐  │  │
│  │  │ IframeModule│ │IframeModule│ │IframeModule│ │  │
│  │  │ dashboard   │ │ order-list │ │ stats    │  │  │
│  │  └──────┬──────┘ └─────┬──────┘ └────┬─────┘  │  │
│  └─────────┼──────────────┼─────────────┼────────┘  │
│            │              │             │            │
│     ┌──────┴──────────────┴─────────────┴──────┐    │
│     │         映射服务 / 配置中心                 │    │
│     │   客户 X → https://b-x.example.com        │    │
│     └──────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────┘
                         │ SSO + iframe
        ┌────────────────┼───────────────────┐
        ▼                ▼                   ▼
┌──────────────┐ ┌──────────────┐  ┌──────────────┐
│ B 实例(客户X) │ │ B 实例(客户Y) │  │ B 实例(客户Z) │
│ v2.1.0       │ │ v2.3.0       │  │ v1.9.0       │
│ 端口 8080     │ │ 端口 8080     │  │ 端口 8080     │
└──────────────┘ └──────────────┘  └──────────────┘
```

### 3.2 URL 拼接规范

```
{B实例地址}/embed/{模块名}?token={ssoToken}&theme={主题}&lang={语言}
```

| 部分 | 来源 | 说明 |
|------|------|------|
| B 实例地址 | 映射服务根据 customerId 返回 | 如 `https://b-001.example.com` |
| `/embed/` | 与 B 团队约定的嵌入专用路由前缀 | B 在此路由下隐藏导航栏/侧边栏 |
| 模块名 | A 侧配置 | 如 `dashboard`、`order-list`、`stats-overview` |
| token | A 生成的一次性短期 token | 用于跨域 SSO 免登 |
| theme / lang | A 当前状态 | 可选，用于主题和语言同步 |

---

## 四、工程优化方案

### 4.1 基础架构层

#### 4.1.1 客户-实例地址映射服务

A 项目需要一个集中的映射关系，知道"当前客户对应哪个 B 实例"。

**方式一：配置表（简单场景）**

```
┌──────────┬──────────────────────────────────┬─────────┐
│ 客户 ID  │ B 实例地址                        │ B 版本  │
├──────────┼──────────────────────────────────┼─────────┤
│ cust-001 │ https://b-001.example.com        │ v2.1.0  │
│ cust-002 │ https://b-002.example.com        │ v2.3.0  │
│ cust-003 │ https://b-003.internal.com:8080  │ v1.9.0  │
└──────────┴──────────────────────────────────┴─────────┘
```

**方式二：接口动态获取（推荐）**

```
GET /api/customers/{customerId}/b-instance
→ { "baseUrl": "https://b-001.example.com", "version": "2.1.0" }
```

接口方式的好处：B 实例迁移、扩缩容时 A 不需要改代码，运维层面直接更新映射即可。

---

### 4.2 组件封装层

#### 4.2.1 IframeModule 通用组件

A 项目中所有 iframe 嵌入收敛到一个组件，避免散落裸 iframe 标签。

**组件职责：**

```
IframeModule
├── 根据 customerId 获取 B 实例地址
├── 拼接完整 URL（模块路径 + 认证 token + 参数）
├── 渲染 iframe 并管理生命周期
├── 展示 loading / error / timeout 三种状态
├── 监听 postMessage 进行双向通信
└── 销毁时清理事件监听和 iframe 引用
```

**调用方式：**

```vue
<IframeModule
  :customer-id="currentCustomerId"
  module="dashboard"
/>

<IframeModule
  :customer-id="currentCustomerId"
  module="order-list"
/>

<IframeModule
  :customer-id="currentCustomerId"
  module="stats-overview"
/>
```

#### 4.2.2 状态管理（loading / error / timeout）

```
时序：

A 渲染 iframe
  │
  ├─ 立即显示 loading 骨架屏
  │
  ├─ iframe 开始加载 ──→ 监听 iframe.onload
  │                        │
  │                        ├─ 成功 → 等待 B postMessage ready → 隐藏骨架屏
  │                        │
  │                        └─ 失败 → 显示错误提示 + 重试按钮
  │
  └─ 超时计时器（如 15s）
                           │
                           └─ 触发 → 显示"加载超时，请检查网络"+ 重试
```

> 注意：`iframe.onload` 只能告诉你"页面加载了"，但不能告诉你"B 的模块渲染完了"。更精确的做法是让 B 在模块渲染完成后主动 postMessage 一个 `ready` 事件，A 收到后才隐藏骨架屏。

---

### 4.3 通信层

#### 4.3.1 postMessage 通信协议

A 和 B 之间通过 `postMessage` 通信，需要定义统一的消息格式：

```json
{
  "source": "app-a | app-b",
  "type": "事件类型",
  "payload": {}
}
```

**B → A 方向（B 主动通知 A）：**

| type | payload | 用途 |
|------|---------|------|
| `ready` | `{ module, version }` | B 模块渲染完成，A 隐藏 loading |
| `resize` | `{ height }` | B 内容高度变化，A 调整 iframe 高度 |
| `navigate` | `{ path }` | B 内部发生跳转，A 可能需要同步状态 |
| `error` | `{ code, message }` | B 内部出错（如 token 过期），A 展示错误 |

**A → B 方向（A 主动控制 B）：**

| type | payload | 用途 |
|------|---------|------|
| `theme-change` | `{ theme: 'dark' }` | A 切换主题，通知 B 同步 |
| `token-refresh` | `{ token }` | A 刷新了 token，传给 B 续期 |
| `destroy` | — | A 即将卸载 iframe，B 做清理 |

#### 4.3.2 安全校验

postMessage 必须校验来源，防止第三方页面伪造消息：

```
收到消息时：
1. 检查 event.origin 是否在白名单内
2. 检查 event.data.source 是否是预期的标识
3. 都通过后才处理消息
```

iframe 的 `sandbox` 属性按需配置：

```html
<iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups">
```

| 属性 | 用途 |
|------|------|
| `allow-scripts` | 允许执行 JS |
| `allow-same-origin` | 允许访问 cookie/storage（SSO 需要） |
| `allow-forms` | 允许表单提交 |
| `allow-popups` | 允许新窗口（如下载） |

---

### 4.4 认证层

#### 4.4.1 SSO 免登方案

根据 A 和 B 的部署关系选择：

**场景一：A 和 B 同主域（如 `*.example.com`）**

共享 cookie，B 直接读取登录态，最简单。

**场景二：A 和 B 跨域**

方案 a — URL 参数传递一次性 token：

```
A 生成短期 token → 拼入 iframe URL → B 校验 token 换取 session
注意：token 必须一次性且短有效期，防止 URL 泄露后被重放
```

方案 b — postMessage 传递 token：

```
iframe 加载后 B 发送 "need-auth"
→ A 通过 postMessage 传 token
→ B 校验
好处：token 不暴露在 URL 中
```

#### 4.4.2 Token 续期流程

```
A 的 token 即将过期
  → A 刷新自己的 token
  → A 通过 postMessage 发 token-refresh 给所有 iframe
  → B 收到后更新本地 token
```

---

### 4.5 体验优化层

#### 4.5.1 iframe 高度自适应

目标：消除 iframe 内部滚动条，让 B 的内容像 A 的原生内容一样自然撑开。

```
B 侧：
  - 用 ResizeObserver 监听内容区域高度变化
  - 高度变化时 postMessage({ type: 'resize', payload: { height } })

A 侧：
  - 收到 resize 消息后设置 iframe style.height
  - 加 transition 让高度变化平滑
  - 设置一个最大高度上限，超出后降级为 iframe 内部滚动
```

#### 4.5.2 预加载与缓存

**策略一：路由级预加载**

用户进入"客户详情"页时，立即创建隐藏的 iframe 开始加载。用户切到"展示模块" tab 时，iframe 已经 ready，无白屏。

**策略二：keep-alive**

用户切走再切回时，不销毁 iframe，用 `v-show` 控制显隐。避免重复加载（3 个 iframe 以内内存占用可接受）。

#### 4.5.3 主题与样式同步

```
初始化时：iframe src 拼上 ?theme=dark，B 根据参数初始化主题
运行时切换：A postMessage({ type: 'theme-change' }) → B 响应切换
```

---

### 4.6 容错与监控层

#### 4.6.1 错误处理分级

| 级别 | 场景 | 处理 |
|------|------|------|
| 级别 1 | B 实例不可达，iframe 加载超时 | 展示"该客户的 XX 模块暂时不可用" + 重试按钮，可选上报告警 |
| 级别 2 | B 实例可达但认证失败 | B 通过 postMessage 发 `error({ code: 'AUTH_FAILED' })`，A 尝试刷新 token 重传，仍失败则提示重新登录 |
| 级别 3 | B 模块内部异常 | B 通过 postMessage 发 `error({ code: 'MODULE_ERROR', message })`，A 展示友好错误提示 |

#### 4.6.2 监控埋点

```
需要采集的指标：
├── iframe 加载耗时（从创建到 ready 事件）
├── 加载失败率（按客户 / B 版本维度）
├── postMessage 通信失败次数
└── 用户在 iframe 模块上的停留时长和交互行为
```

**价值：**
- 发现某个 B 版本的加载成功率异常低 → 推动该客户升级
- 发现某个模块加载慢 → 针对性优化

---

## 五、B 侧最小改造清单

虽然 iframe 方案的核心优势是"B 不需要改"，但以下改造成本极低且收益明显：

| 改造项 | 工作量 | 收益 |
|--------|--------|------|
| 提供 `/embed/*` 路由，隐藏导航栏/侧边栏 | 小 | 嵌入后不会出现双重导航 |
| 渲染完成后 postMessage `ready` | 极小 | A 可以精确控制 loading 状态 |
| 内容高度变化时 postMessage `resize` | 小 | 消除 iframe 滚动条 |
| 支持 URL query 接收 theme/lang | 小 | 主题语言同步 |
| 支持 URL query 或 postMessage 接收 token | 中 | 跨域 SSO 免登 |

建议前三项优先做，后两项按需。

---

## 六、实施优先级

```
P0（必须做）
 ├── 客户-实例地址映射服务
 ├── IframeModule 通用组件封装
 ├── SSO 免登认证
 └── loading / error / timeout 状态处理

P1（体验显著提升）
 ├── postMessage 通信协议
 ├── B 提供 /embed/ 路由
 ├── iframe 高度自适应
 └── 安全校验（origin 白名单 + sandbox）

P2（锦上添花）
 ├── 预加载 / keep-alive
 ├── 主题与语言同步
 └── 监控埋点
```
