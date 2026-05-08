import VueRouter from 'vue-router'
import Home from './views/Home.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
  },
  {
    path: '/todolist',
    name: 'TodoList',
    component: () => import('./views/TodoList.vue'),
  },
]

const router = new VueRouter({
  routes,
})

export default router
