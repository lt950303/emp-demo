<template>
  <div class="home">
    <div class="version-control">
      <h3>Remote Module Version Control</h3>
      <p class="desc">
        业务代码始终使用 <code>import('appC/TodoList')</code>，
        版本切换通过覆写 webpack 模块工厂实现。
      </p>

      <div class="switch-bar">
        <el-radio-group v-model="currentVersion" size="small" @change="onVersionChange">
          <el-radio-button label="v1">
            v1 - Basic (port 8002)
          </el-radio-button>
          <el-radio-button label="v2">
            v2 - Enhanced (port 8003)
          </el-radio-button>
        </el-radio-group>

        <el-tag :type="statusType" size="small" class="status-tag">
          {{ statusText }}
        </el-tag>
      </div>
    </div>

    <div class="remote-container">
      <RemoteLoader v-if="show" />
    </div>
  </div>
</template>

<script>
import versionSwitcher from '../utils/version-switcher'
import RemoteLoader from '../components/RemoteLoader.vue'

export default {
  name: 'Home',
  components: { RemoteLoader },
  data() {
    return {
      currentVersion: 'v1',
      show: true,
    }
  },
  computed: {
    statusType() {
      return 'success'
    },
    statusText() {
      return `Running ${this.currentVersion}`
    },
  },
  methods: {
    async onVersionChange(version) {
      this.show = false
      await versionSwitcher.switchTo(version)
      this.$nextTick(() => {
        this.show = true
      })
    },
  },
}
</script>

<style scoped>
.home {
  padding: 0;
}

.version-control {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.version-control h3 {
  margin: 0 0 8px;
  font-size: 16px;
  color: #303133;
}

.version-control .desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: #909399;
}

.version-control .desc code {
  background: #e6effb;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  color: #409eff;
}

.switch-bar {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-tag {
  margin-left: auto;
}

.remote-container {
  min-height: 200px;
}
</style>
