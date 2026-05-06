<template>
  <div class="multi-calc">
    <h3>Multiplication Calculator</h3>
    <div class="calc-form">
      <input
        v-model.number="num1"
        type="number"
        placeholder="Number 1"
        class="calc-input"
      />
      <span class="calc-operator">x</span>
      <input
        v-model.number="num2"
        type="number"
        placeholder="Number 2"
        class="calc-input"
      />
      <button class="calc-btn" @click="calculate">=</button>
      <span class="calc-result">{{ result !== null ? result : '?' }}</span>
    </div>

    <div v-if="history.length" class="calc-history">
      <div class="history-header">
        <h4>History</h4>
        <button class="clear-btn" @click="clearHistory">Clear</button>
      </div>
      <ul>
        <li v-for="(item, index) in history" :key="index">
          {{ item.num1 }} x {{ item.num2 }} = {{ item.result }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { multiply, round } from 'lodash-es'

export default {
  name: 'MultiCalc',
  data() {
    return {
      num1: null,
      num2: null,
      result: null,
      history: [],
    }
  },
  methods: {
    calculate() {
      if (this.num1 === null || this.num2 === null) return
      const raw = multiply(this.num1, this.num2)
      this.result = round(raw, 4)
      this.history.unshift({
        num1: this.num1,
        num2: this.num2,
        result: this.result,
      })
    },
    clearHistory() {
      this.history = []
    },
  },
}
</script>

<style scoped lang="scss">
.multi-calc {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 20px;

  h3 {
    margin: 0 0 16px;
    font-size: 16px;
    color: #303133;
  }
}

.calc-form {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.calc-input {
  width: 100px;
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: #409eff;
  }
}

.calc-operator {
  font-size: 18px;
  font-weight: bold;
  color: #606266;
}

.calc-btn {
  padding: 8px 16px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background: #66b1ff;
  }
}

.calc-result {
  font-size: 20px;
  font-weight: bold;
  color: #67c23a;
  margin-left: 8px;
}

.calc-history {
  margin-top: 20px;
  border-top: 1px solid #e4e7ed;
  padding-top: 12px;

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  h4 {
    margin: 0;
    font-size: 14px;
    color: #606266;
  }

  .clear-btn {
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

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li {
    padding: 6px 0;
    font-size: 14px;
    color: #606266;
    border-bottom: 1px dashed #ebeef5;

    &:last-child {
      border-bottom: none;
    }
  }
}
</style>
