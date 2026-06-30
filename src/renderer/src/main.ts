import { createApp, defineComponent, h, shallowRef, onMounted } from 'vue'
import './assets/styles.css'

/**
 * 极简窗口路由：依据 URL hash（#/pet 或 #/chat）决定渲染哪个视图。
 * pet 窗口与 chat 窗口加载同一个 index.html，仅 hash 不同。
 *
 * 阶段 0 不引入 vue-router，保持极简；后续如需可在各窗口内单独引入。
 */
function resolveComponent() {
  const hash = window.location.hash.replace(/^#/, '')
  if (hash === '/chat') {
    return import('./views/ChatView.vue')
  }
  return import('./views/PetView.vue') // 默认 /pet
}

const current = shallowRef<any>(null)

const Root = defineComponent({
  name: 'Root',
  setup() {
    const load = async () => {
      const mod = await resolveComponent()
      current.value = mod.default
    }
    onMounted(load)
    window.addEventListener('hashchange', load)
    return () => (current.value ? h(current.value) : h('div', { class: 'loading' }, '加载中…'))
  }
})

createApp(Root).mount('#app')
