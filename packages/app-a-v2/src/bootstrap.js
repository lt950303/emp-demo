import Vue from 'vue'
import VueRouter from 'vue-router'
import ElementUI from 'element-ui'
import App from './App.vue'
import router from './router'

Vue.use(VueRouter)
Vue.use(ElementUI)

new Vue({
  router,
  render: h => h(App),
}).$mount('#emp-root')
