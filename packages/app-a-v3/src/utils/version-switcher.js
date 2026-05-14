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

// 通过 webpackChunk push 获取 webpack require 引用
// 注意：变量名不能用 __webpack_require__，否则会被 webpack 重命名导致闭包引用断裂
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
    // 移除旧的同名 script（版本切换场景）
    const oldScript = document.querySelector(`script[data-remote="${scope}"]`)
    if (oldScript) {
      oldScript.parentNode.removeChild(oldScript)
    }

    // 清除旧容器引用，让新 emp.js 覆盖
    try { delete window[scope] } catch (e) { window[scope] = undefined }

    const script = document.createElement('script')
    script.src = remoteUrl
    script.type = 'text/javascript'
    script.async = true
    script.setAttribute('data-remote', scope)

    script.onload = async () => {
      const req = getWebpackRequire()
      // 使用 webpack runtime 的 __webpack_init_sharing__ (req.I)
      await req.I('default')
      const container = window[scope]
      if (!container) {
        reject(new Error(`容器 "${scope}" 加载后未在 window 上注册`))
        return
      }
      // 使用 webpack runtime 的 __webpack_share_scopes__ (req.S)
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
 * 使得后续 import('appC/TodoList') 返回新版本模块
 */
function overwriteWebpackFactory(newModule) {
  const req = getWebpackRequire()
  const cache = req.c  // __webpack_module_cache__
  const modules = req.m  // __webpack_modules__

  // 清除相关模块缓存 + 覆写工厂
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

  console.log('[VersionSwitcher] webpack 模块工厂已覆写，缓存已清除')
}

class VersionSwitcher {
  constructor() {
    this.currentVersion = 'v1' // 默认版本（与 emp-config.js remotes 一致）
  }

  /**
   * 切换到指定版本
   * @param {string} version - 'v1' 或 'v2'
   * @returns {Promise<void>}
   */
  async switchTo(version) {
    if (version === this.currentVersion) return

    const url = VERSION_MAP[version]
    if (!url) throw new Error(`未知版本: ${version}`)

    console.log(`[VersionSwitcher] 切换到 ${version}: ${url}`)

    // 1. 动态加载新版本容器并获取模块
    const newModule = await getRemoteComponent(url, 'appC', './TodoList')

    // 2. 覆写 webpack 工厂 + 清缓存
    overwriteWebpackFactory(newModule)

    this.currentVersion = version
    console.log(`[VersionSwitcher] 已切换到 ${version}`)
  }

  /**
   * 获取当前版本
   */
  getVersion() {
    return this.currentVersion
  }
}

export default new VersionSwitcher()
