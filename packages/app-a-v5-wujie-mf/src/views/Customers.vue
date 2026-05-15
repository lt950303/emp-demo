<template>
  <div class="customers-page">
    <customer-table @open="openCustomer" />

    <div v-if="openTabs.length > 0" class="detail-panel">
      <el-tabs
        v-model="activeTabId"
        type="card"
        closable
        @tab-remove="closeTab"
        @tab-click="onTabClick"
      >
        <el-tab-pane
          v-for="tab in openTabs"
          :key="tab.id"
          :label="tab.name"
          :name="tab.id"
        />
      </el-tabs>

      <div class="tab-content">
        <customer-detail
          v-for="tab in openTabs"
          v-show="activeTabId === tab.id"
          :key="tab.id"
          :customer="tab"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { destroyApp } from 'wujie'
import CustomerTable from '../components/CustomerTable.vue'
import CustomerDetail from '../components/CustomerDetail.vue'

export default {
  name: 'CustomersView',
  components: {
    CustomerTable,
    CustomerDetail,
  },
  computed: {
    openTabs() {
      return this.$store.state.openTabs
    },
    activeTabId: {
      get() {
        return this.$store.state.activeTab
      },
      set(val) {
        this.$store.commit('setActiveTab', val)
      },
    },
  },
  methods: {
    openCustomer(customer) {
      this.$store.commit('openCustomerTab', customer)
    },
    closeTab(customerId) {
      destroyApp(`customer-${customerId}`)
      this.$store.commit('closeCustomerTab', customerId)
    },
    onTabClick(tab) {
      this.$store.commit('setActiveTab', tab.name)
    },
  },
}
</script>

<style scoped lang="scss">
.customers-page {
  padding: 24px;
}

.detail-panel {
  margin-top: 24px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 16px;
  background: #fafafa;
}

.tab-content {
  min-height: 400px;
}
</style>
