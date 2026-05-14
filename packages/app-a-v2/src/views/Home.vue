<template>
  <div class="home">
    <div class="version-control">
      <h3>Remote Module Version Control</h3>
      <p class="desc">Switch between different versions of the TodoList remote component at runtime.</p>

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
      <div v-if="loading" class="loading-state">
        <i class="el-icon-loading"></i> Loading remote component...
      </div>
      <div v-else-if="error" class="error-state">
        <el-alert :title="error" type="error" show-icon :closable="false" />
      </div>
      <component v-else-if="RemoteComponent" :is="RemoteComponent" />
    </div>
  </div>
</template>

<script>
import remoteLoader from '../utils/remote-loader'

const VERSION_MAP = {
  v1: 'http://localhost:8002/emp.js',
  v2: 'http://localhost:8003/emp.js',
}

export default {
  name: 'Home',
  data() {
    return {
      currentVersion: 'v1',
      RemoteComponent: null,
      loading: true,
      error: null,
    }
  },
  computed: {
    statusType() {
      if (this.loading) return 'warning'
      if (this.error) return 'danger'
      return 'success'
    },
    statusText() {
      if (this.loading) return 'Loading...'
      if (this.error) return 'Error'
      return `Running ${this.currentVersion}`
    },
  },
  created() {
    this.loadVersion(this.currentVersion)
  },
  methods: {
    async loadVersion(version) {
      this.loading = true
      this.error = null
      this.RemoteComponent = null

      const url = VERSION_MAP[version]

      try {
        const module = await remoteLoader.switchVersion('appC', url, './TodoList')
        this.RemoteComponent = module.default || module
        this.loading = false
      } catch (err) {
        console.error('[Home] Failed to load remote:', err)
        this.error = `Failed to load ${version}: ${err.message}`
        this.loading = false
      }
    },
    onVersionChange(version) {
      this.loadVersion(version)
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

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #909399;
  font-size: 14px;
  gap: 8px;
}

.error-state {
  padding: 20px 0;
}
</style>
