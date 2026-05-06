<template>
  <div class="home">
    <h1>This is App D</h1>
    <p class="subtitle">Raw Rspack + Module Federation 2.0</p>

    <div class="grid">
      <section class="card">
        <h2>Local: HelloWorld</h2>
        <hello-world />
      </section>

      <section class="card">
        <h2>Remote: TodoList (from App C)</h2>
        <todo-list v-if="todoLoaded" />
        <p v-else class="loading">Loading TodoList from App C...</p>
      </section>
    </div>
  </div>
</template>

<script>
import HelloWorld from '../components/HelloWorld.vue'

export default {
  name: 'Home',
  components: {
    HelloWorld,
    TodoList: () =>
      import('appC/TodoList').catch(err => {
        console.error('[App D] Failed to load TodoList from App C:', err)
        return {
          render: h =>
            h('p', { style: { color: '#f56c6c' } }, [
              'Failed to load TodoList. Make sure App C is running on port 9004.',
            ]),
        }
      }),
  },
  data() {
    return {
      todoLoaded: true,
    }
  },
}
</script>

<style lang="scss" scoped>
.home {
  padding: 24px;

  h1 {
    color: #e6a23c;
    margin: 0 0 8px;
  }

  .subtitle {
    color: #909399;
    margin: 0 0 24px;
  }
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 20px;

  h2 {
    font-size: 16px;
    color: #303133;
    margin: 0 0 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #ebeef5;
  }
}

.loading {
  color: #909399;
  text-align: center;
  padding: 20px;
}
</style>
