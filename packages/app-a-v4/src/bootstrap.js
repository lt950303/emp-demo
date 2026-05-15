import Vue from 'vue'
import VueRouter from 'vue-router'
import ElementUI from 'element-ui'
import App from './App'
import router from './router'
import registry from './utils/remote-registry'

Vue.use(VueRouter)
Vue.use(ElementUI)

// 注册远程模块版本配置
registry.register('appC', {
  versions: {
    v1: {
      url: 'http://localhost:9008/emp.js',
      containerName: 'appC_v1',
      label: 'v1 Basic (Green)',
    },
    v2: {
      url: 'http://localhost:9009/emp.js',
      containerName: 'appC_v2',
      label: 'v2 Enhanced (Purple)',
    },
  },
  default: 'v1',
})

new Vue({
  router,
  render: h => h(App),
}).$mount('#emp-root')
