/**
 * RemoteRegistry — 远程模块版本注册中心（单例）
 *
 * 管理多版本远程组件的注册、切换和缓存加载。
 * 业务代码通过 getModule(remoteName, exposedModule) 获取组件，无需感知版本。
 */
class RemoteRegistry {
  constructor() {
    // { remoteName: { versions: { v1: { url, containerName }, ... }, current: 'v1' } }
    this.registry = new Map()
    // { `${containerName}` : containerProxy }
    this.containerCache = new Map()
    // { `${containerName}:${exposedModule}` : moduleFactory }
    this.moduleCache = new Map()
    // event listeners
    this.listeners = new Map()
  }

  /**
   * 注册远程模块的版本配置
   * @param {string} remoteName - 业务名称（如 'appC'）
   * @param {object} config - { versions: { v1: { url, containerName }, ... }, default: 'v1' }
   */
  register(remoteName, config) {
    this.registry.set(remoteName, {
      versions: config.versions,
      current: config.default || Object.keys(config.versions)[0],
    })
  }

  /**
   * 获取远程模块的所有版本信息
   */
  getVersions(remoteName) {
    const entry = this.registry.get(remoteName)
    if (!entry) return []
    return Object.keys(entry.versions)
  }

  /**
   * 获取当前激活版本
   */
  getCurrentVersion(remoteName) {
    const entry = this.registry.get(remoteName)
    return entry ? entry.current : null
  }

  /**
   * 切换版本
   */
  setVersion(remoteName, version) {
    const entry = this.registry.get(remoteName)
    if (!entry) throw new Error(`[RemoteRegistry] "${remoteName}" not registered`)
    if (!entry.versions[version]) throw new Error(`[RemoteRegistry] version "${version}" not found for "${remoteName}"`)
    if (entry.current === version) return

    entry.current = version
    this._emit(`remote:version-changed:${remoteName}`, { remoteName, version })
  }

  /**
   * 获取模块（业务唯一入口，版本无关）
   */
  async getModule(remoteName, exposedModule) {
    const entry = this.registry.get(remoteName)
    if (!entry) throw new Error(`[RemoteRegistry] "${remoteName}" not registered`)

    const versionConfig = entry.versions[entry.current]
    return this._loadModule(versionConfig.containerName, versionConfig.url, exposedModule)
  }

  /**
   * 预加载指定版本
   */
  async preload(remoteName, version) {
    const entry = this.registry.get(remoteName)
    if (!entry) return
    const versionConfig = entry.versions[version]
    if (!versionConfig) return

    await this._loadContainer(versionConfig.containerName, versionConfig.url)
  }

  /**
   * 预加载所有版本
   */
  async preloadAll(remoteName) {
    const versions = this.getVersions(remoteName)
    await Promise.all(versions.map(v => this.preload(remoteName, v)))
  }

  // --- 内部方法 ---

  async _loadContainer(containerName, url) {
    if (this.containerCache.has(containerName)) {
      return this.containerCache.get(containerName)
    }

    // 动态加载远程入口脚本
    await this._loadScript(url, containerName)

    // EMP 构建产物会将容器挂载到 window 上
    const container = window[containerName]
    if (!container) {
      throw new Error(`[RemoteRegistry] Container "${containerName}" not found on window after loading ${url}`)
    }

    // 初始化共享作用域
    // EMP 的共享依赖通过 CDN 全局变量加载（Vue、Vuex、Element UI），
    // 不依赖 webpack share scopes 传递，所以传空对象即可。
    // 如果 Host 有 __webpack_share_scopes__（EMP 构建时会生成），优先使用它。
    const shareScope = (typeof __webpack_share_scopes__ !== 'undefined')
      ? __webpack_share_scopes__['default']
      : {}
    await container.init(shareScope)
    this.containerCache.set(containerName, container)
    return container
  }

  async _loadModule(containerName, url, exposedModule) {
    const cacheKey = `${containerName}:${exposedModule}`
    if (this.moduleCache.has(cacheKey)) {
      return this.moduleCache.get(cacheKey)
    }

    const container = await this._loadContainer(containerName, url)
    const factory = await container.get(exposedModule)
    const module = factory()
    this.moduleCache.set(cacheKey, module)
    return module
  }

  _loadScript(url, name) {
    return new Promise((resolve, reject) => {
      // 检查是否已加载
      const existing = document.querySelector(`script[data-remote="${name}"]`)
      if (existing) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = url
      script.type = 'text/javascript'
      script.async = true
      script.dataset.remote = name
      script.onload = resolve
      script.onerror = () => reject(new Error(`Failed to load remote entry: ${url}`))
      document.head.appendChild(script)
    })
  }

  // --- 简易事件系统 ---

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(handler)
  }

  off(event, handler) {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    const idx = handlers.indexOf(handler)
    if (idx > -1) handlers.splice(idx, 1)
  }

  _emit(event, data) {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.forEach(fn => fn(data))
    }
  }
}

// 单例导出
const registry = new RemoteRegistry()
export default registry
