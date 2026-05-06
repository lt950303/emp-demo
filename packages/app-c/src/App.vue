<template>
  <div class="main">
    <h1>App C - Standalone</h1>
    <todo-list />
  </div>
</template>

<script>
import TodoList from './components/TodoList.vue'

export default {
  components: {
    TodoList,
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
</style>
