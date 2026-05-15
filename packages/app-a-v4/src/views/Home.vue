<template>
  <div class="home">
    <div class="demo-header">
      <h1>Module Federation Multi-Version Demo</h1>
      <p class="desc">
        Business code uses <code>&lt;RemoteModule&gt;</code> without knowing versions.
        The Version Registry handles loading and caching transparently.
      </p>
    </div>

    <div class="control-panel">
      <div class="panel-title">Version Control</div>
      <div class="version-buttons">
        <el-button
          v-for="v in versions"
          :key="v"
          :type="currentVersion === v ? 'primary' : 'default'"
          size="medium"
          @click="switchVersion(v)"
        >
          {{ getVersionLabel(v) }}
        </el-button>
      </div>
      <div class="panel-info">
        <span>Current: <strong>{{ currentVersion }}</strong></span>
        <el-button size="mini" type="text" @click="preloadAll">
          <i class="el-icon-download"></i> Preload All Versions
        </el-button>
      </div>
      <div v-if="preloaded" class="preload-tip">
        <i class="el-icon-success"></i> All versions preloaded and cached
      </div>
    </div>

    <div class="module-container">
      <remote-module remote-name="appC" exposed-module="./TodoList" />
    </div>
  </div>
</template>
<script>
import RemoteModule from '../components/RemoteModule.vue'
import registry from '../utils/remote-registry'

export default {
  name: 'Home',
  components: {
    RemoteModule,
  },
  data() {
    return {
      versions: registry.getVersions('appC'),
      currentVersion: registry.getCurrentVersion('appC'),
      preloaded: false,
    }
  },
  created() {
    this._handler = ({ version }) => {
      this.currentVersion = version
    }
    registry.on('remote:version-changed:appC', this._handler)
  },
  beforeDestroy() {
    registry.off('remote:version-changed:appC', this._handler)
  },
  methods: {
    switchVersion(version) {
      registry.setVersion('appC', version)
    },
    getVersionLabel(version) {
      const entry = registry.registry.get('appC')
      const config = entry.versions[version]
      return config.label || version
    },
    async preloadAll() {
      await registry.preloadAll('appC')
      this.preloaded = true
    },
  },
}
</script>

<style scoped lang="scss">
.home {
  max-width: 800px;

  .demo-header {
    margin-bottom: 24px;

    h1 {
      font-size: 24px;
      margin: 0 0 8px;
      color: #303133;
    }

    .desc {
      color: #606266;
      font-size: 14px;
      margin: 0;

      code {
        background: #f5f7fa;
        padding: 2px 6px;
        border-radius: 3px;
        color: #722ed1;
      }
    }
  }

  .control-panel {
    background: #fafafa;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 24px;

    .panel-title {
      font-size: 14px;
      font-weight: bold;
      color: #303133;
      margin-bottom: 12px;
    }

    .version-buttons {
      margin-bottom: 12px;
    }

    .panel-info {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 13px;
      color: #606266;
    }

    .preload-tip {
      margin-top: 8px;
      font-size: 12px;
      color: #67c23a;
    }
  }

  .module-container {
    border: 1px dashed #dcdfe6;
    border-radius: 8px;
    padding: 20px;
    min-height: 200px;
  }
}
</style>
