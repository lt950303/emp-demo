import {defineConfig} from '@empjs/cli'
import vue from '@empjs/plugin-vue2'
import {pluginRspackEmpShare} from '@empjs/share'
export default defineConfig(store => {
  return {
    plugins: [
      vue(),
      pluginRspackEmpShare({
        name: 'appC_v2',
        exposes: {
          './TodoList': './src/components/TodoList',
        },
        empRuntime: {
          frameworkGlobal: 'window',
          runtimeLib: `https://unpkg.com/@empjs/share@3.13.8/output/sdk.js`,
          shareLib: {
            vue: 'Vue@https://unpkg.com/vue@2.7.14/dist/vue.min.js',
            vuex: `Vuex@https://unpkg.com/vuex@3.6.2/dist/vuex.min.js`,
            'element-ui': [
              'ELEMENT@https://unpkg.com/element-ui/lib/index.js',
              `https://unpkg.com/element-ui/lib/theme-chalk/index.css`,
            ],
          },
          framework: 'vue2',
        },
      }),
    ],
    html: {
      title: 'EMP3 App C v2 - TodoList Enhanced',
    },
    server: {port: 9009},
    appEntry: 'main.js',
  }
})
