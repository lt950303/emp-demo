<template>
  <div class="todo-list-v2">
    <div class="header">
      <h2>TodoList <span class="version-badge">v2 Enhanced</span></h2>
      <div class="stats">
        <span class="stat-item">Total: {{ todos.length }}</span>
        <span class="stat-item active">Active: {{ activeTodos.length }}</span>
        <span class="stat-item done">Done: {{ doneTodos.length }}</span>
      </div>
    </div>

    <div class="input-row">
      <el-input
        v-model="newTodo"
        placeholder="Add a new todo..."
        @keyup.enter.native="addTodo"
        size="medium"
      />
      <el-select v-model="newPriority" size="medium" style="width: 120px" :popper-append-to-body="false">
        <el-option label="Low" value="low" />
        <el-option label="Medium" value="medium" />
        <el-option label="High" value="high" />
      </el-select>
      <el-button type="primary" size="medium" @click="addTodo">Add</el-button>
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
        <div class="item-left">
          <el-checkbox v-model="item.done" />
          <el-tag
            :type="priorityType(item.priority)"
            size="mini"
            class="priority-tag"
          >{{ item.priority }}</el-tag>
          <span v-if="editingId !== item.id" :class="{ completed: item.done }">
            {{ item.text }}
          </span>
          <el-input
            v-else
            v-model="editText"
            size="mini"
            @keyup.enter.native="saveEdit(item)"
            @blur="saveEdit(item)"
          />
        </div>
        <div class="item-actions">
          <el-button
            v-if="editingId !== item.id"
            type="primary"
            icon="el-icon-edit"
            size="mini"
            circle
            @click="startEdit(item)"
          />
          <el-button
            type="danger"
            icon="el-icon-delete"
            size="mini"
            circle
            @click="removeTodo(item.id)"
          />
        </div>
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
  name: 'TodoListV2',
  data() {
    return {
      newTodo: '',
      newPriority: 'medium',
      filter: 'all',
      editingId: null,
      editText: '',
      nextId: 4,
      todos: [
        { id: 1, text: 'Learn Module Federation', done: false, priority: 'high' },
        { id: 2, text: 'Build micro-frontend demo', done: true, priority: 'medium' },
        { id: 3, text: 'Write documentation', done: false, priority: 'low' },
      ],
    }
  },
  computed: {
    activeTodos() {
      return this.todos.filter(t => !t.done)
    },
    doneTodos() {
      return this.todos.filter(t => t.done)
    },
    filteredTodos() {
      if (this.filter === 'active') return this.activeTodos
      if (this.filter === 'done') return this.doneTodos
      return this.todos
    },
  },
  methods: {
    addTodo() {
      const text = this.newTodo.trim()
      if (!text) return
      this.todos.push({ id: this.nextId++, text, done: false, priority: this.newPriority })
      this.newTodo = ''
      this.newPriority = 'medium'
      this.$store.commit('incrementOps')
    },
    removeTodo(id) {
      this.todos = this.todos.filter(t => t.id !== id)
      this.$store.commit('incrementOps')
    },
    startEdit(item) {
      this.editingId = item.id
      this.editText = item.text
    },
    saveEdit(item) {
      const text = this.editText.trim()
      if (text) item.text = text
      this.editingId = null
      this.editText = ''
    },
    priorityType(priority) {
      const map = { high: 'danger', medium: 'warning', low: 'info' }
      return map[priority] || 'info'
    },
  },
}
</script>

<style scoped lang="scss">
.todo-list-v2 {
  max-width: 600px;
  padding: 20px;
  border: 2px solid #9b59b6;
  border-radius: 8px;
  background: #f5eef8;

  .header {
    margin-bottom: 16px;

    h2 {
      margin: 0 0 8px;
      color: #9b59b6;
      font-size: 20px;
    }

    .version-badge {
      font-size: 12px;
      background: #9b59b6;
      color: #fff;
      padding: 2px 8px;
      border-radius: 10px;
      vertical-align: middle;
    }

    .stats {
      display: flex;
      gap: 12px;

      .stat-item {
        font-size: 13px;
        color: #666;
        &.active { color: #e6a23c; }
        &.done { color: #67c23a; }
      }
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
    padding: 10px 12px;
    border-bottom: 1px solid #e8daef;

    .item-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;

      .completed {
        text-decoration: line-through;
        color: #999;
      }

      .priority-tag {
        text-transform: capitalize;
      }
    }

    .item-actions {
      display: flex;
      gap: 4px;
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
