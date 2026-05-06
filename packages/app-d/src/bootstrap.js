import Vue from 'vue'
import VueRouter from 'vue-router'
import Vuex from 'vuex'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import App from './App'
import router from './router'

// 桥接: 将 npm 安装的包暴露为 window 全局变量
// app-c (EMP) 的远程模块通过 externals 引用 window.Vue / window.Vuex / window.ELEMENT
window.Vue = Vue
window.Vuex = Vuex
window.ELEMENT = ElementUI

Vue.use(VueRouter)
Vue.use(ElementUI)

new Vue({
  router,
  render: h => h(App),
}).$mount('#emp-root')
