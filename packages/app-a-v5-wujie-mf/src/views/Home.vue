<template>
  <div class="home">
    <h1>Wujie + MF Multi-Version Isolation Demo</h1>
    <div class="description">
      <p>This demo showcases how <strong>Wujie sandboxing</strong> enables runtime isolation for multiple versions of the same micro-frontend application running simultaneously on a single page.</p>
      <h3>Architecture</h3>
      <ul>
        <li><strong>Host (this app)</strong> — Rspack + Vue 2, manages customer tabs</li>
        <li><strong>app-c-v3 (port 9008)</strong> — EMP-built sub-app, TodoList v1 Basic</li>
        <li><strong>app-c-v4 (port 9009)</strong> — EMP-built sub-app, TodoList v2 Enhanced</li>
      </ul>
      <h3>Key Points</h3>
      <ul>
        <li>Each customer detail tab runs in an independent Wujie sandbox</li>
        <li>Same-version instances have isolated JS/CSS/Vuex state</li>
        <li>Wujie provides runtime isolation; EMP/MF is the build system (unchanged)</li>
        <li>Props communication passes customer context to sub-apps</li>
      </ul>
      <el-button type="primary" @click="$router.push('/customers')">Go to Customers</el-button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HomeView',
}
</script>

<style scoped lang="scss">
.home {
  padding: 32px;
  max-width: 700px;

  h1 {
    font-size: 24px;
    margin-bottom: 20px;
    color: #303133;
  }

  .description {
    line-height: 1.8;
    color: #606266;

    h3 {
      margin-top: 20px;
      margin-bottom: 8px;
      color: #303133;
    }

    ul {
      padding-left: 20px;
    }

    li {
      margin-bottom: 4px;
    }
  }
}
</style>
