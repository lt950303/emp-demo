const vue = require('@efox/plugin-vue-2')
const {defineConfig} = require('@efox/emp')

module.exports = defineConfig({
  plugins: [vue],
  appEntry: 'main.js',
  server: {port: 8003},
  html: {title: 'EMP2 App C v2 - TodoList Enhanced'},
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
  webpackChain(chain) {
    chain.plugins.delete('mfStats')
    chain.plugins.delete('progress')
  },
})
