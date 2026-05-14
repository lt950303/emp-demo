/**
 * RemoteLoader - 动态加载/卸载/切换 Module Federation 远程容器
 *
 * 核心原理：
 * 1. 通过 script 标签注入远程 emp.js
 * 2. emp.js 执行后在 window 上注册容器（如 window.appC）
 * 3. 调用 container.init(shareScope) + container.get(moduleName) 获取模块
 * 4. 切换版本时：移除旧 script → 清理缓存 → 加载新版本
 */
class RemoteLoader {
  constructor() {
    // 已加载的容器记录 { containerName: { url, scriptEl } }
    this.containers = {}
  }

  /**
   * 加载远程容器（注入 script 标签）
   * @param {string} containerName - 容器名（如 'appC'）
   * @param {string} url - 远程入口 URL（如 'http://localhost:8002/emp.js'）
   * @returns {Promise<object>} window[containerName] 容器对象
   */
  loadContainer(containerName, url) {
    return new Promise((resolve, reject) => {
      // 如果已加载相同 URL，直接返回
      if (this.containers[containerName] && this.containers[containerName].url === url) {
        resolve(window[containerName])
        return
      }

      // 如果已加载不同 URL，先卸载
      if (this.containers[containerName]) {
        this.unload(containerName)
      }

      const script = document.createElement('script')
      script.src = url
      script.type = 'text/javascript'
      script.async = true
      script.setAttribute('data-remote', containerName)

      script.onload = () => {
        const container = window[containerName]
        if (!container) {
          reject(new Error(`[RemoteLoader] Container "${containerName}" not found on window after loading ${url}`))
          return
        }
        this.containers[containerName] = {url, scriptEl: script}
        console.log(`[RemoteLoader] Loaded container "${containerName}" from ${url}`)
        resolve(container)
      }

      script.onerror = () => {
        document.head.removeChild(script)
        reject(new Error(`[RemoteLoader] Failed to load script: ${url}`))
      }

      document.head.appendChild(script)
    })
  }

  /**
   * 初始化容器并获取模块
   * @param {string} containerName - 容器名
   * @param {string} moduleName - 模块路径（如 './TodoList'）
   * @returns {Promise<object>} 模块导出
   */
  async getModule(containerName, moduleName) {
    const container = window[containerName]
    if (!container) {
      throw new Error(`[RemoteLoader] Container "${containerName}" not available on window`)
    }

    // shareLib 模式下，依赖通过 CDN 全局变量解决，share scope 传空对象即可
    // 兼容处理：如果 webpack share scope 存在则使用，否则传空对象
    let shareScope = {}
    if (typeof __webpack_share_scopes__ !== 'undefined') {
      shareScope = __webpack_share_scopes__.default || {}
    }

    // 初始化容器（如果已初始化会被忽略）
    await container.init(shareScope)

    // 获取模块工厂函数并执行
    const factory = await container.get(moduleName)
    const module = factory()
    console.log(`[RemoteLoader] Got module "${moduleName}" from "${containerName}"`)
    return module
  }

  /**
   * 卸载容器：移除 script 标签 + 删除 window 全局变量 + 清理 webpack 缓存
   * @param {string} containerName - 容器名
   */
  unload(containerName) {
    const record = this.containers[containerName]
    if (record) {
      // 移除 script 标签
      if (record.scriptEl && record.scriptEl.parentNode) {
        record.scriptEl.parentNode.removeChild(record.scriptEl)
      }
      delete this.containers[containerName]
    }

    // 清除 window 上的容器全局变量
    // 注意：emp.js 使用 var 声明（如 `var appC;`），创建的是不可配置属性，
    // 不能 delete，只能设为 undefined。新 emp.js 加载后会重新赋值覆盖。
    try {
      delete window[containerName]
    } catch (e) {
      window[containerName] = undefined
    }

    // 清理 webpack 模块缓存
    this._cleanWebpackCache(containerName)

    console.log(`[RemoteLoader] Unloaded container "${containerName}"`)
  }

  /**
   * 完整版本切换：卸载旧版 → 加载新版 → 获取模块
   * @param {string} containerName - 容器名
   * @param {string} newUrl - 新版本的远程入口 URL
   * @param {string} moduleName - 要获取的模块路径
   * @returns {Promise<object>} 新版本的模块导出
   */
  async switchVersion(containerName, newUrl, moduleName) {
    console.log(`[RemoteLoader] Switching "${containerName}" to ${newUrl}`)

    // 1. 卸载旧版本
    this.unload(containerName)

    // 2. 加载新版本容器
    await this.loadContainer(containerName, newUrl)

    // 3. 获取并返回模块
    return this.getModule(containerName, moduleName)
  }

  /**
   * 清理 webpack 模块缓存中与指定容器相关的条目
   * webpack 5 内部使用 __webpack_module_cache__ 和 __webpack_modules__
   * @param {string} containerName - 容器名
   * @private
   */
  _cleanWebpackCache(containerName) {
    // 清理模块缓存
    if (typeof __webpack_module_cache__ !== 'undefined') {
      console.log(111);
      
      Object.keys(__webpack_module_cache__).forEach(key => {
        if (key.includes(containerName) || key.includes('remote') || key.includes('container')) {
          delete __webpack_module_cache__[key]
        }
      })
    }

    // 清理模块工厂
    if (typeof __webpack_modules__ !== 'undefined') {
      console.log('1111');
      
      Object.keys(__webpack_modules__).forEach(key => {
        if (key.includes(containerName) || key.includes('remote') || key.includes('container')) {
          delete __webpack_modules__[key]
        }
      })
    }
  }
}

// 导出单例
export default new RemoteLoader()
