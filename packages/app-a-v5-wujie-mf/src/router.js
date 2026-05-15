import VueRouter from 'vue-router'
import Home from './views/Home.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
  },
  {
    path: '/customers',
    name: 'Customers',
    component: () => import('./views/Customers.vue'),
  },
]

const router = new VueRouter({
  routes,
})

export default router
