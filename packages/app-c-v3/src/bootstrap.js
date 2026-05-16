import Vue from 'vue'
import ElementUI from 'element-ui'
import store from './store'
import App from './App'

Vue.use(ElementUI)

// Wujie 沙箱环境下，全局禁用 Element UI 的 popper-append-to-body
// 原因：Popper 追加到 iframe body 后不在可见渲染树中，导致浮层不显示
if (window.__POWERED_BY_WUJIE__) {
  const popperComponents = [
    'ElSelect', 'ElDatePicker', 'ElTimePicker', 'ElTooltip',
    'ElPopover', 'ElDropdown', 'ElAutocomplete', 'ElCascader',
  ]
  popperComponents.forEach(name => {
    const comp = Vue.component(name)
    if (comp && comp.options && comp.options.props) {
      if (comp.options.props.popperAppendToBody) {
        comp.options.props.popperAppendToBody.default = false
      }
      if (comp.options.props.appendToBody) {
        comp.options.props.appendToBody.default = false
      }
    }
  })
}

new Vue({
  store,
  render: h => h(App),
}).$mount('#emp-root')
