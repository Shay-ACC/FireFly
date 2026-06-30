/**
 * 访问 preload 暴露的 window.api 的类型安全封装。
 * 在 Vue 组件中通过 useApi() 获取，避免在模板中直接访问 window 全局对象。
 */
export function useApi() {
  return window.api
}
