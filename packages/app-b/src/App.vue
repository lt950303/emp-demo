<template>
  <div class="main">
    <h1>App B - Standalone</h1>
    <multi-calc />
  </div>
</template>

<script>
import MultiCalc from './components/MultiCalc.vue'

export default {
  components: {
    MultiCalc,
  },
}
</script>

<style scoped lang="scss">
.main {
  padding: 24px;
  font-family: Arial, Helvetica, sans-serif;

  h1 {
    font-size: 24px;
    margin-bottom: 16px;
  }
}
</style>
