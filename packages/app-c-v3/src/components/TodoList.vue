<template>
  <div class="todo-list-v1">
    <div class="header">
      <h2>TodoList <span class="version-badge">v1 Basic</span></h2>
    </div>

    <div class="input-row">
      <el-input
        v-model="newTodo"
        placeholder="Add a new todo..."
        @keyup.enter.native="addTodo"
        size="medium"
      />
      <el-button type="success" size="medium" @click="addTodo">Add</el-button>
    </div>

    <div class="filter-row">
      <el-radio-group v-model="filter" size="small">
        <el-radio-button label="all">All</el-radio-button>
        <el-radio-button label="active">Active</el-radio-button>
        <el-radio-button label="done">Done</el-radio-button>
      </el-radio-group>
    </div>

    <ul class="todo-items">
      <li v-for="item in filteredTodos" :key="item.id" class="todo-item">
        <el-checkbox v-model="item.done" @change="onToggle(item)">
          <span :class="{ completed: item.done }">{{ item.text }}</span>
        </el-checkbox>
        <el-button
          type="danger"
          icon="el-icon-delete"
          size="mini"
          circle
          @click="removeTodo(item.id)"
        />
      </li>
    </ul>

    <p v-if="filteredTodos.length === 0" class="empty-tip">No items to show.</p>

    <div class="ops-counter">
      Operations: <strong>{{ $store.state.operationCount }}</strong>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TodoListV1',
  data() {
    return {
      newTodo: '',
      filter: 'all',
      nextId: 3,
      todos: [
        { id: 1, text: 'Learn Module Federation', done: false },
        { id: 2, text: 'Build micro-frontend demo', done: true },
      ],
    }
  },
  computed: {
    filteredTodos() {
      if (this.filter === 'active') return this.todos.filter(t => !t.done)
      if (this.filter === 'done') return this.todos.filter(t => t.done)
      return this.todos
    },
  },
  methods: {
    addTodo() {
      const text = this.newTodo.trim()
      if (!text) return
      this.todos.push({ id: this.nextId++, text, done: false })
      this.newTodo = ''
      this.$store.commit('incrementOps')
    },
    removeTodo(id) {
      this.todos = this.todos.filter(t => t.id !== id)
      this.$store.commit('incrementOps')
    },
    onToggle() {},
  },
}
</script>

<style scoped lang="scss">
.todo-list-v1 {
  max-width: 500px;
  padding: 20px;
  border: 2px solid #67c23a;
  border-radius: 8px;
  background: #f0f9eb;

  .header {
    margin-bottom: 16px;

    h2 {
      margin: 0;
      color: #67c23a;
      font-size: 20px;
    }

    .version-badge {
      font-size: 12px;
      background: #67c23a;
      color: #fff;
      padding: 2px 8px;
      border-radius: 10px;
      vertical-align: middle;
    }
  }

  .input-row {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .filter-row {
    margin-bottom: 16px;
  }

  .todo-items {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .todo-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid #e1f3d8;

    .completed {
      text-decoration: line-through;
      color: #999;
    }
  }

  .empty-tip {
    text-align: center;
    color: #999;
    padding: 20px 0;
  }

  .ops-counter {
    margin-top: 16px;
    padding: 8px 12px;
    background: #f4f4f5;
    border-radius: 4px;
    font-size: 13px;
    color: #606266;
  }
}
</style>
