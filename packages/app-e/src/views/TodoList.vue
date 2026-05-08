<template>
  <div class="todolist-container">
    <div class="left-panel">
      <div class="hello-world">
        <h2>Hello World</h2>
        <p>This is App E's local component.</p>
      </div>
    </div>
    <div class="right-panel">
      <h2>无界</h2>
      <WujieVue
        name="app-c"
        url="http://localhost:9004"
        :alive="true"
      />
      <h2>iframe 方案</h2>
      <iframe id="test-iframe" src="http://localhost:9004" frameborder="0" width="800" height="500"></iframe>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TodoList',
}
</script>

<style lang="scss" scoped>
.todolist-container {
  display: flex;
  height: calc(100vh - 56px);
}

.left-panel {
  width: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hello-world {
  text-align: center;
  color: #303133;

  h2 {
    font-size: 28px;
    margin: 0 0 8px;
  }

  p {
    font-size: 14px;
    color: #909399;
  }
}

.right-panel {
  width: 50%;
  border-left: 1px solid #e4e7ed;
}
</style>
