const vue = require('@efox/plugin-vue-2')
const {defineConfig} = require('@efox/emp')

module.exports = defineConfig({
  plugins: [vue],
  appEntry: 'main.js',
  server: {port: 8001},
  html: {title: 'EMP2 Host - Dynamic Version Switch', favicon: false},
  empShare: {
    name: 'appAV2',
    remotes: {
      appC: 'appC@http://localhost:8002/emp.js',
    },
    shareLib: {
      vue: 'Vue@https://unpkg.com/vue@2.7.14/dist/vue.min.js',
      'vue-router': 'VueRouter@https://unpkg.com/vue-router@3.6.5/dist/vue-router.min.js',
      'element-ui': [
        'ELEMENT@https://unpkg.com/element-ui/lib/index.js',
        'https://unpkg.com/element-ui/lib/theme-chalk/index.css',
      ],
    },
  },
  webpackChain(chain) {
    chain.plugins.delete('mfStats')
    chain.plugins.delete('progress')
  },
})
