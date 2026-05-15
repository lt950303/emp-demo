import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    openTabs: [],
    activeTab: null,
  },
  mutations: {
    openCustomerTab(state, customer) {
      const exists = state.openTabs.find(t => t.id === customer.id)
      if (!exists) {
        state.openTabs.push(customer)
      }
      state.activeTab = customer.id
    },
    closeCustomerTab(state, customerId) {
      state.openTabs = state.openTabs.filter(t => t.id !== customerId)
      if (state.activeTab === customerId) {
        const tabs = state.openTabs
        state.activeTab = tabs.length > 0 ? tabs[tabs.length - 1].id : null
      }
    },
    setActiveTab(state, customerId) {
      state.activeTab = customerId
    },
  },
})
