import { ElMessage } from 'element-plus'

function show(type, message) {
  ElMessage.closeAll()

  ElMessage({
    type,
    message,
    duration: type === 'error' ? 4200 : 2200,
    showClose: type === 'error'
  })
}

export const feedback = {
  success(message) {
    show('success', message)
  },

  warning(message) {
    show('warning', message)
  },

  error(error, fallback = '操作失败') {
    const message =
      typeof error === 'string'
        ? error
        : error?.message || fallback

    show('error', message)
  }
}
