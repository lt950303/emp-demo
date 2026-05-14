<template>
  <div class="todo-list">
    <h3>📝 Todo List <span class="version-badge">v2 - Enhanced</span></h3>

    <div class="todo-input">
      <el-input
        v-model="newTodo"
        placeholder="Add a new todo..."
        size="small"
        @keyup.enter.native="addTodo"
      >
        <el-button slot="append" icon="el-icon-plus" @click="addTodo">Add</el-button>
      </el-input>
    </div>

    <div class="todo-filters">
      <el-radio-group v-model="filter" size="mini">
        <el-radio-button label="all">All</el-radio-button>
        <el-radio-button label="active">Active</el-radio-button>
        <el-radio-button label="done">Done</el-radio-button>
      </el-radio-group>
    </div>

    <ul v-if="filteredTodos.length" class="todo-items">
      <li v-for="todo in filteredTodos" :key="todo.id" :class="{done: todo.done}">
        <label class="todo-label">
          <el-checkbox v-model="todo.done" />
          <span v-if="editingId !== todo.id" @dblclick="startEdit(todo)">
            {{ todo.text }}
          </span>
          <el-input
            v-else
            v-model="editText"
            size="mini"
            class="edit-input"
            @keyup.enter.native="finishEdit(todo)"
            @keyup.esc.native="cancelEdit"
            @blur="finishEdit(todo)"
          />
        </label>
        <el-button
          type="text"
          icon="el-icon-delete"
          class="delete-btn"
          @click="removeTodo(todo.id)"
        />
      </li>
    </ul>
    <p v-else class="empty-tip">No todos yet.</p>

    <div v-if="todos.length" class="todo-footer">
      <span>{{ remaining }} remaining</span>
      <el-button
        v-if="todos.some(t => t.done)"
        size="mini"
        type="danger"
        plain
        @click="clearDone"
      >
        Clear done
      </el-button>
    </div>
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
      this.todos.push({id: nextId++, text, done: false})
      this.newTodo = ''
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
  background: #f5f0ff;
  border-radius: 8px;
  padding: 20px;
  border: 2px solid #9b59b6;

  h3 {
    margin: 0 0 16px;
    font-size: 16px;
    color: #4a1a6b;
  }
}

.version-badge {
  display: inline-block;
  background: #9b59b6;
  color: #fff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  vertical-align: middle;
  margin-left: 8px;
}

.todo-input {
  margin-bottom: 12px;
}

.todo-filters {
  margin-bottom: 12px;
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
  border-bottom: 1px dashed #e1bee7;

  &.done .todo-label span {
    text-decoration: line-through;
    color: #ce93d8;
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

  span {
    font-size: 14px;
    color: #4a1a6b;
    cursor: pointer;

    &:hover {
      border-bottom: 1px dashed #9b59b6;
    }
  }
}

.edit-input {
  flex: 1;
  max-width: 300px;
}

.delete-btn {
  color: #f56c6c;
  font-size: 16px;
}

.empty-tip {
  color: #ce93d8;
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
  border-top: 1px solid #e1bee7;
  font-size: 13px;
  color: #9b59b6;
}
</style>
