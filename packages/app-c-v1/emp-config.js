const vue = require('@efox/plugin-vue-2')
const {defineConfig} = require('@efox/emp')

module.exports = defineConfig({
  plugins: [vue],
  appEntry: 'main.js',
  server: {port: 8002},
  html: {title: 'EMP2 App C v1 - TodoList Basic'},
  empShare: {
    name: 'appC',
    exposes: {
      './TodoList': './src/components/TodoList',
    },
    shareLib: {
      vue: 'Vue@https://unpkg.com/vue@2.7.14/dist/vue.min.js',
      'element-ui': [
        'ELEMENT@https://unpkg.com/element-ui/lib/index.js',
        'https://unpkg.com/element-ui/lib/theme-chalk/index.css',
      ],
    },
  },
  // webpack 5.106 兼容性修复：
  // 1. ModuleFederationPlugin._options → options，导致 stats 插件报错
  // 2. webpackbar 的 options 不兼容新版 ProgressPlugin schema
  webpackChain(chain) {
    chain.plugins.delete('mfStats')
    chain.plugins.delete('progress')
  },
})
