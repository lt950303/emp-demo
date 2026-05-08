<template>
  <div class="hello-world">
    <p class="message">Hello from App E!</p>
    <div class="counter">
      <span class="count">Count: {{ count }}</span>
      <el-button type="success" size="small" @click="increment">+1</el-button>
      <el-button size="small" @click="reset">Reset</el-button>
    </div>
  </div>
</template>

<script>
import { mapState, mapMutations } from 'vuex'

export default {
  name: 'HelloWorld',
  computed: {
    ...mapState(['count']),
  },
  methods: {
    ...mapMutations(['increment', 'reset']),
  },
}
</script>

<style lang="scss" scoped>
.hello-world {
  text-align: center;

  .message {
    font-size: 16px;
    color: #67c23a;
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
