import Vue from 'vue'
import ElementUI from 'element-ui'
import store from './store'
import App from './App'

Vue.use(ElementUI)

new Vue({
  store,
  render: h => h(App),
}).$mount('#emp-root')
