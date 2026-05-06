<template>
  <div id="app">
    <nav class="nav-bar">
      <div class="nav-brand">EMP Micro Frontend</div>
      <div class="nav-links">
        <router-link to="/">Home</router-link>
      </div>
    </nav>
    <div class="app-content">
      <router-view />
    </div>
  </div>
</template>

<script>
export default {
  name: 'App',
}
</script>

<style scoped lang="scss">
#app {
  font-family: Arial, Helvetica, sans-serif;
}

.nav-bar {
  display: flex;
  align-items: center;
  padding: 0 24px;
  height: 56px;
  background: #409eff;
  color: #fff;
}

.nav-brand {
  font-size: 18px;
  font-weight: bold;
  margin-right: 32px;
}

.nav-links a {
  color: #fff;
  text-decoration: none;
  margin-right: 16px;
  padding: 6px 12px;
  border-radius: 4px;

  &.router-link-active {
    background: rgba(255, 255, 255, 0.2);
  }
}

.app-content {
  padding: 24px;
}
</style>
