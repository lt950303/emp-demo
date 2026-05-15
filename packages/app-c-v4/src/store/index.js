import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    operationCount: 0,
  },
  mutations: {
    incrementOps(state) {
      state.operationCount++
    },
  },
})
