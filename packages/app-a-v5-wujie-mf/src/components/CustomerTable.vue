<template>
  <div class="customer-table">
    <h2>Customer List</h2>
    <el-table :data="customers" border style="width: 100%">
      <el-table-column prop="id" label="ID" width="100" />
      <el-table-column prop="name" label="Name" />
      <el-table-column prop="version" label="Version" width="100">
        <template slot-scope="{ row }">
          <el-tag :type="row.version === 'v1' ? 'success' : 'warning'" size="small">
            {{ row.version }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="plan" label="Plan" width="120" />
      <el-table-column label="Action" width="120">
        <template slot-scope="{ row }">
          <el-button type="primary" size="mini" @click="$emit('open', row)">
            View
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
import customers from '../data/customers'

export default {
  name: 'CustomerTable',
  data() {
    return {
      customers,
    }
  },
}
</script>

<style scoped lang="scss">
.customer-table {
  h2 {
    font-size: 18px;
    margin-bottom: 16px;
    color: #303133;
  }
}
</style>
