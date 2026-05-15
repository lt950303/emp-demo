<template>
  <div class="main">
    <div v-if="customerContext" class="context-banner">
      Viewing as: <strong>{{ customerContext.customerName }}</strong>
    </div>
    <h1>App C v2 - Enhanced TodoList</h1>
    <todo-list />
  </div>
</template>

<script>
import TodoList from './components/TodoList.vue'

export default {
  components: {
    TodoList,
  },
  computed: {
    customerContext() {
      return window.$wujie?.props || null
    },
  },
}
</script>

<style scoped lang="scss">
.main {
  padding: 24px;
  font-family: Arial, Helvetica, sans-serif;

  h1 {
    font-size: 24px;
    margin-bottom: 16px;
  }
}

.context-banner {
  background: #f3e8ff;
  border: 1px solid #d3adf7;
  border-radius: 4px;
  padding: 8px 16px;
  margin-bottom: 16px;
  font-size: 14px;
  color: #722ed1;
}
</style>
