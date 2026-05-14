<template>
  <div id="app">
    <div class="app-header">
      <h2>EMP 2.4 Import() + Factory Overwrite Demo</h2>
      <nav>
        <router-link to="/">Home</router-link>
      </nav>
    </div>
    <router-view />
  </div>
</template>

<script>
export default {
  name: 'App',
}
</script>

<style>
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

#app {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.app-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #ebeef5;
}

.app-header h2 {
  margin: 0 0 8px;
  color: #303133;
}

.app-header nav a {
  color: #409eff;
  text-decoration: none;
  margin-right: 16px;
}

.app-header nav a:hover {
  text-decoration: underline;
}
</style>
