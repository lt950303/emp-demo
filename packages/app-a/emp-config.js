import {defineConfig} from '@empjs/cli'
import vue from '@empjs/plugin-vue2'
import {pluginRspackEmpShare} from '@empjs/share'
export default defineConfig(store => {
  return {
    plugins: [
      vue(),
      pluginRspackEmpShare({
        name: 'appA',
        remotes: {
          appB: 'appB@http://localhost:9003/emp.js',
          appC: 'appC@http://localhost:9004/emp.js',
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
      title: 'EMP3 App A - Host',
    },
    server: {port: 9002},
    appEntry: 'main.js',
  }
})
