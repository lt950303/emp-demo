<template>
  <div class="home">
    <h1>Host Application (App A)</h1>
    <p>Below are remote components loaded via Module Federation:</p>

    <div class="remote-components">
      <div class="remote-section">
        <h2>From App B - MultiCalc</h2>
        <div class="remote-wrapper">
          <multi-calc v-if="calcLoaded" />
          <p v-else class="loading">Loading MultiCalc...</p>
        </div>
      </div>

      <div class="remote-section">
        <h2>From App C - TodoList</h2>
        <div class="remote-wrapper">
          <todo-list v-if="todoLoaded" />
          <p v-else class="loading">Loading TodoList...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Home',
  components: {
    MultiCalc: () => import('appB/MultiCalc'),
    TodoList: () => import('appC/TodoList'),
  },
  data() {
    return {
      calcLoaded: true,
      todoLoaded: true,
    }
  },
}
</script>

<style scoped lang="scss">
.home {
  h1 {
    font-size: 28px;
    margin-bottom: 8px;
  }

  p {
    color: #666;
    margin-bottom: 24px;
  }
}

.remote-components {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.remote-section {
  h2 {
    font-size: 18px;
    color: #409eff;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 2px solid #409eff;
  }
}

.remote-wrapper {
  min-height: 200px;
}

.loading {
  color: #999;
  font-style: italic;
}
</style>
