<template>
  <div class="hello-world">
    <p class="message">Hello from App D!</p>
    <div class="counter">
      <span class="count">Count: {{ count }}</span>
      <el-button type="warning" size="small" @click="count++">+1</el-button>
      <el-button size="small" @click="count = 0">Reset</el-button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HelloWorld',
  data() {
    return {
      count: 0,
    }
  },
}
</script>

<style lang="scss" scoped>
.hello-world {
  text-align: center;

  .message {
    font-size: 16px;
    color: #e6a23c;
    margin: 0 0 16px;
  }

  .counter {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;

    .count {
      font-size: 18px;
      font-weight: bold;
      color: #303133;
      min-width: 80px;
    }
  }
}
</style>
