import cloudbase from '@cloudbase/js-sdk'

const runtimeConfig = globalThis.HUAYU_CONFIG || {}

const ENV_ID =
  runtimeConfig.envId ||
  import.meta.env.VITE_CLOUDBASE_ENV_ID ||
  'cloudbase-d6gspds9z5e38b6f0'

const ACCESS_KEY =
  runtimeConfig.accessKey ||
  import.meta.env.VITE_CLOUDBASE_ACCESS_KEY ||
  ''

const ADMIN_FUNCTION_NAME =
  runtimeConfig.adminFunctionName ||
  import.meta.env.VITE_ADMIN_FUNCTION_NAME ||
  'adminApi'

const INVALID_ACCESS_KEY_VALUES = new Set([
  '',
  '请替换为CloudBase-Publishable-Key',
  'YOUR_PUBLISHABLE_KEY'
])

export const cloudConfig = {
  envId: ENV_ID,
  accessKeyConfigured: !INVALID_ACCESS_KEY_VALUES.has(ACCESS_KEY),
  adminFunctionName: ADMIN_FUNCTION_NAME
}

const initOptions = {
  env: ENV_ID
}

if (cloudConfig.accessKeyConfigured) {
  initOptions.accessKey = ACCESS_KEY
}

export const cloudbaseApp = cloudbase.init(initOptions)
export const cloudbaseAuth = cloudbaseApp.auth

function requireWebConfig() {
  if (!cloudConfig.accessKeyConfigured) {
    throw new Error(
      '尚未配置 Publishable Key。请打开 huayu-admin-web/public/huayu-config.js 填写 accessKey。'
    )
  }
}

function assertNoSdkError(error, fallbackMessage) {
  if (error) {
    const sdkError = new Error(error.message || fallbackMessage)
    sdkError.code = error.code || 'CLOUDBASE_AUTH_ERROR'
    throw sdkError
  }
}

export async function getSession() {
  requireWebConfig()
  const { data, error } = await cloudbaseAuth.getSession()
  assertNoSdkError(error, '检查登录状态失败')
  return data?.session || null
}

export async function loginWithPassword(username, password) {
  requireWebConfig()

  const params = {
    username: String(username || '').trim(),
    password
  }

  const response =
    typeof cloudbaseAuth.signInWithPassword === 'function'
      ? await cloudbaseAuth.signInWithPassword(params)
      : await cloudbaseAuth.signIn(params)

  assertNoSdkError(response.error, '登录失败')

  return (
    response.data?.session ||
    (await getSession())
  )
}

export async function signUpWithPassword({
  username,
  password,
  nickname
}) {
  requireWebConfig()

  const { data, error } = await cloudbaseAuth.signUp({
    username: String(username || '').trim(),
    password,
    nickname
  })

  assertNoSdkError(error, '管理员账号创建失败')

  return data?.session || (await getSession())
}

export async function logout() {
  const { error } = await cloudbaseAuth.signOut()
  assertNoSdkError(error, '退出登录失败')
}

export async function callAdmin(action, payload = {}) {
  requireWebConfig()

  const response = await cloudbaseApp.callFunction({
    name: ADMIN_FUNCTION_NAME,
    data: {
      action,
      ...payload
    }
  })

  const result = response?.result

  if (!result || result.ok !== true) {
    const error = new Error(
      result?.message || `管理员操作失败：${action}`
    )
    error.code = result?.code || 'ADMIN_API_ERROR'
    throw error
  }

  return result.data
}

export function fetchAdminProfile() {
  return callAdmin('me')
}

export function bootstrapAdmin({
  bootstrapCode,
  displayName
}) {
  return callAdmin('bootstrapAdmin', {
    bootstrapCode,
    displayName
  })
}

function safeFileName(name) {
  return String(name || 'image')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(-80)
}

export async function uploadImage(file, folder = 'products') {
  requireWebConfig()

  if (!(file instanceof File)) {
    throw new Error('没有选择有效图片')
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('只能上传图片文件')
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('图片不能超过 5MB')
  }

  const cloudPath = [
    'public',
    'admin',
    folder,
    new Date().toISOString().slice(0, 10),
    `${Date.now()}-${safeFileName(file.name)}`
  ].join('/')

  const result = await cloudbaseApp.uploadFile({
    cloudPath,
    filePath: file
  })

  if (!result?.fileID) {
    throw new Error('云存储没有返回 File ID')
  }

  return result.fileID
}

export { ENV_ID }
