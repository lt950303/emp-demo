<template>
  <div class="todo-list">
    <h3>📝 Todo List <span class="version-badge">v1 - Basic</span></h3>

    <div class="todo-input">
      <input
        v-model="newTodo"
        placeholder="Add a new todo..."
        class="todo-field"
        @keyup.enter="addTodo"
      />
      <button class="add-btn" @click="addTodo">Add</button>
    </div>

    <ul v-if="todos.length" class="todo-items">
      <li v-for="todo in todos" :key="todo.id" :class="{done: todo.done}">
        <label class="todo-label">
          <input type="checkbox" v-model="todo.done" />
          <span>{{ todo.text }}</span>
        </label>
        <button class="delete-btn" @click="removeTodo(todo.id)">×</button>
      </li>
    </ul>
    <p v-else class="empty-tip">No todos yet.</p>

    <div v-if="todos.length" class="todo-footer">
      <span>{{ remaining }} remaining</span>
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
    }
  },
  computed: {
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
  },
}
</script>

<style scoped lang="scss">
.todo-list {
  background: #f0faf0;
  border-radius: 8px;
  padding: 20px;
  border: 2px solid #67c23a;

  h3 {
    margin: 0 0 16px;
    font-size: 16px;
    color: #2d5a1b;
  }
}

.version-badge {
  display: inline-block;
  background: #67c23a;
  color: #fff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  vertical-align: middle;
  margin-left: 8px;
}

.todo-input {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.todo-field {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #b3e6b3;
  border-radius: 4px;
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: #67c23a;
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
  border-bottom: 1px dashed #c8e6c9;

  &.done .todo-label span {
    text-decoration: line-through;
    color: #a5d6a7;
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
    accent-color: #67c23a;
  }

  span {
    font-size: 14px;
    color: #2d5a1b;
  }
}

.delete-btn {
  background: none;
  border: none;
  color: #f56c6c;
  cursor: pointer;
  font-size: 18px;
  padding: 4px 8px;
  opacity: 0.6;

  &:hover {
    opacity: 1;
  }
}

.empty-tip {
  color: #a5d6a7;
  font-size: 14px;
  text-align: center;
  padding: 20px 0;
}

.todo-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #c8e6c9;
  font-size: 13px;
  color: #66bb6a;
}
</style>
