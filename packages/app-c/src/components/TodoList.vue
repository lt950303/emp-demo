<template>
  <div class="todo-list">
    <h3>Todo List</h3>

    <div class="todo-input">
      <input
        v-model="newTodo"
        placeholder="Add a new todo..."
        class="todo-field"
        @keyup.enter="addTodo"
      />
      <button class="add-btn" @click="addTodo">Add</button>
    </div>

    <div class="todo-filters">
      <button
        v-for="f in filters"
        :key="f.value"
        :class="['filter-btn', { active: filter === f.value }]"
        @click="filter = f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <ul v-if="filteredTodos.length" class="todo-items">
      <li v-for="todo in filteredTodos" :key="todo.id" :class="{ done: todo.done }">
        <label class="todo-label">
          <input type="checkbox" v-model="todo.done" />
          <span v-if="editingId !== todo.id" @dblclick="startEdit(todo)">
            {{ todo.text }}
          </span>
          <input
            v-else
            v-model="editText"
            class="edit-input"
            @keyup.enter="finishEdit(todo)"
            @keyup.esc="cancelEdit"
            @blur="finishEdit(todo)"
          />
        </label>
        <button class="delete-btn" @click="removeTodo(todo.id)">x</button>
      </li>
    </ul>
    <p v-else class="empty-tip">No todos yet.</p>

    <div v-if="todos.length" class="todo-footer">
      <span>{{ remaining }} remaining</span>
      <button v-if="todos.some(t => t.done)" class="clear-done-btn" @click="clearDone">
        Clear done
      </button>
    </div>

    <el-dialog
      title="确认添加"
      :visible.sync="confirmVisible"
      width="360px"
      :close-on-click-modal="false"
    >
      <span>确认添加「{{ pendingTodo }}」？</span>
      <span slot="footer">
        <el-button @click="cancelAdd">取 消</el-button>
        <el-button type="primary" @click="confirmAdd">确 定</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
let nextId = 1

export default {
  name: 'TodoList',
  data() {
    return {
      newTodo: '',
      todos: [],
      filter: 'all',
      editingId: null,
      editText: '',
      confirmVisible: false,
      pendingTodo: '',
      filters: [
        { label: 'All', value: 'all' },
        { label: 'Active', value: 'active' },
        { label: 'Done', value: 'done' },
      ],
    }
  },
  computed: {
    filteredTodos() {
      if (this.filter === 'active') return this.todos.filter(t => !t.done)
      if (this.filter === 'done') return this.todos.filter(t => t.done)
      return this.todos
    },
    remaining() {
      return this.todos.filter(t => !t.done).length
    },
  },
  methods: {
    addTodo() {
      const text = this.newTodo.trim()
      if (!text) return
      this.pendingTodo = text
      this.confirmVisible = true
    },
    confirmAdd() {
      this.todos.push({ id: nextId++, text: this.pendingTodo, done: false })
      this.newTodo = ''
      this.pendingTodo = ''
      this.confirmVisible = false
    },
    cancelAdd() {
      this.pendingTodo = ''
      this.confirmVisible = false
    },
    removeTodo(id) {
      this.todos = this.todos.filter(t => t.id !== id)
    },
    startEdit(todo) {
      this.editingId = todo.id
      this.editText = todo.text
    },
    finishEdit(todo) {
      const text = this.editText.trim()
      if (text) todo.text = text
      this.editingId = null
    },
    cancelEdit() {
      this.editingId = null
    },
    clearDone() {
      this.todos = this.todos.filter(t => !t.done)
    },
  },
}
</script>

<style scoped lang="scss">
.todo-list {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 20px;

  h3 {
    margin: 0 0 16px;
    font-size: 16px;
    color: #303133;
  }
}

.todo-input {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.todo-field {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: #409eff;
  }
}

.add-btn {
  padding: 8px 16px;
  background: #67c23a;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background: #85ce61;
  }
}

.todo-filters {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}

.filter-btn {
  padding: 4px 12px;
  background: none;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #606266;

  &.active {
    background: #409eff;
    color: #fff;
    border-color: #409eff;
  }

  &:hover:not(.active) {
    border-color: #409eff;
    color: #409eff;
  }
}

.todo-items {
  list-style: none;
  padding: 0;
  margin: 0;
}

.todo-items li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px dashed #ebeef5;

  &.done .todo-label span {
    text-decoration: line-through;
    color: #c0c4cc;
  }

  &:last-child {
    border-bottom: none;
  }
}

.todo-label {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  cursor: pointer;

  input[type='checkbox'] {
    cursor: pointer;
  }

  span {
    font-size: 14px;
    color: #303133;
  }
}

.edit-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #409eff;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
}

.delete-btn {
  background: none;
  border: none;
  color: #f56c6c;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  opacity: 0.6;

  &:hover {
    opacity: 1;
  }
}

.empty-tip {
  color: #c0c4cc;
  font-size: 14px;
  text-align: center;
  padding: 20px 0;
}

.todo-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
  font-size: 13px;
  color: #909399;
}

.clear-done-btn {
  padding: 4px 8px;
  font-size: 12px;
  background: none;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  color: #909399;

  &:hover {
    color: #f56c6c;
    border-color: #f56c6c;
  }
}
</style>
