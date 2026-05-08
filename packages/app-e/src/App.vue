<template>
  <div id="app-e">
    <nav class="navbar">
      <span class="title">App E - Rspack + Vue 2</span>
      <router-link to="/">Home</router-link>
      <router-link to="/todolist">TodoList (Wujie)</router-link>
    </nav>
    <router-view />
  </div>
</template>

<script>
export default {
  name: 'AppE',
}
</script>

<style lang="scss" scoped>
.navbar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 24px;
  height: 56px;
  background: #67c23a;
  color: #fff;

  .title {
    font-size: 18px;
    font-weight: bold;
    margin-right: auto;
  }

  a {
    color: #fff;
    text-decoration: none;
    font-size: 14px;
    padding: 6px 12px;
    border-radius: 4px;
    transition: background 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    &.router-link-active {
      background: rgba(255, 255, 255, 0.3);
    }
  }
}
</style>
