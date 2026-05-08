<template>
  <div class="home">
    <h1>This is App E</h1>
    <p class="subtitle">Rspack + Vue 2 (No Module Federation)</p>

    <section class="card">
      <h2>HelloWorld</h2>
      <hello-world />
    </section>
  </div>
</template>

<script>
import HelloWorld from '../components/HelloWorld.vue'

export default {
  name: 'Home',
  components: {
    HelloWorld,
  },
}
</script>

<style lang="scss" scoped>
.home {
  padding: 24px;

  h1 {
    color: #67c23a;
    margin: 0 0 8px;
  }

  .subtitle {
    color: #909399;
    margin: 0 0 24px;
  }
}

.card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 20px;
  max-width: 480px;

  h2 {
    font-size: 16px;
    color: #303133;
    margin: 0 0 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #ebeef5;
  }
}
</style>
