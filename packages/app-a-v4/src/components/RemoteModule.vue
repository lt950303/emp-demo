<template>
  <div class="remote-module-wrapper">
    <div v-if="loading" class="loading-state">
      <i class="el-icon-loading"></i>
      <span>Loading remote module...</span>
    </div>
    <div v-else-if="error" class="error-state">
      <i class="el-icon-warning"></i>
      <span>{{ error }}</span>
      <el-button size="mini" type="text" @click="load">Retry</el-button>
    </div>
    <component v-else-if="remoteComponent" :is="remoteComponent" />
  </div>
</template>

<script>
import registry from '../utils/remote-registry'

export default {
  name: 'RemoteModule',
  props: {
    remoteName: {
      type: String,
      required: true,
    },
    exposedModule: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      remoteComponent: null,
      loading: false,
      error: null,
    }
  },
  created() {
    this._versionHandler = this._onVersionChanged.bind(this)
    registry.on(`remote:version-changed:${this.remoteName}`, this._versionHandler)
    this.load()
  },
  beforeDestroy() {
    registry.off(`remote:version-changed:${this.remoteName}`, this._versionHandler)
  },
  methods: {
    async load() {
      this.loading = true
      this.error = null
      try {
        const module = await registry.getModule(this.remoteName, this.exposedModule)
        this.remoteComponent = module.default || module
      } catch (e) {
        this.error = e.message
        console.error('[RemoteModule]', e)
      } finally {
        this.loading = false
      }
    },
    _onVersionChanged() {
      this.remoteComponent = null
      this.load()
    },
  },
}
</script>

<style scoped lang="scss">
.remote-module-wrapper {
  min-height: 60px;
}

.loading-state,
.error-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  color: #909399;
  font-size: 14px;
}

.error-state {
  color: #f56c6c;
}
</style>
