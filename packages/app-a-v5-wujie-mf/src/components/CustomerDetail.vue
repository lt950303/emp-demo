<template>
  <div class="customer-detail">
    <WujieVue
      :name="`customer-${customer.id}`"
      :url="appUrl"
      :alive="true"
      :props="wujieProps"
      width="100%"
      height="500px"
    />
  </div>
</template>

<script>
const versionUrlMap = {
  v1: 'http://localhost:9008',
  v2: 'http://localhost:9009',
}

export default {
  name: 'CustomerDetail',
  props: {
    customer: {
      type: Object,
      required: true,
    },
  },
  computed: {
    appUrl() {
      return versionUrlMap[this.customer.version]
    },
    wujieProps() {
      return {
        customerId: this.customer.id,
        customerName: this.customer.name,
      }
    },
  },
}
</script>

<style scoped lang="scss">
.customer-detail {
  padding: 8px 0;
}
</style>
