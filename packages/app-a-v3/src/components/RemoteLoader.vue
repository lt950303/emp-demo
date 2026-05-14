<template>
  <component :is="Comp" />
</template>

<script>
export default {
  name: 'RemoteLoader',
  data() {
    return {
      Comp: () => import('appC/TodoList')
    }
  }
}
</script>
