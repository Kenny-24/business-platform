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
  accessKeyConfigured:
    !INVALID_ACCESS_KEY_VALUES.has(ACCESS_KEY),
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

let pendingEmailSignUp = null

function requireWebConfig() {
  if (!cloudConfig.accessKeyConfigured) {
    throw new Error(
      '尚未配置 Publishable Key。请打开 public/huayu-config.js 填写 accessKey。'
    )
  }
}

function createSdkError(error, fallbackMessage) {
  const sdkError = new Error(
    error?.message || fallbackMessage
  )

  sdkError.code =
    error?.code || 'CLOUDBASE_AUTH_ERROR'
  sdkError.category = error?.category || ''

  return sdkError
}

function assertNoSdkError(error, fallbackMessage) {
  if (error) {
    throw createSdkError(error, fallbackMessage)
  }
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
}

export async function getSession() {
  requireWebConfig()

  const { data, error } =
    await cloudbaseAuth.getSession()

  assertNoSdkError(error, '检查登录状态失败')

  return data?.session || null
}

export async function loginWithPassword(
  email,
  password
) {
  requireWebConfig()

  const { data, error } =
    await cloudbaseAuth.signInWithPassword({
      email: normalizeEmail(email),
      password
    })

  assertNoSdkError(error, '登录失败')

  return data?.session || (await getSession())
}

export async function beginEmailSignUp({
  email,
  password
}) {
  requireWebConfig()

  const normalizedEmail = normalizeEmail(email)
  pendingEmailSignUp = null

  const { data, error } =
    await cloudbaseAuth.signUp({
      email: normalizedEmail,
      password
    })

  assertNoSdkError(error, '验证码发送失败')

  if (
    !data ||
    typeof data.verifyOtp !== 'function'
  ) {
    throw new Error(
      'CloudBase 没有返回邮箱验证码验证方法，请检查邮箱验证码与账号密码登录是否已启用。'
    )
  }

  pendingEmailSignUp = data

  return {
    email: normalizedEmail
  }
}

export async function completeEmailSignUp({
  verificationCode,
  email,
  password
}) {
  requireWebConfig()

  const token = String(
    verificationCode || ''
  ).trim()

  if (!token) {
    throw new Error('请输入邮箱验证码')
  }

  if (pendingEmailSignUp) {
    const verification = pendingEmailSignUp

    const { data, error } =
      await verification.verifyOtp({
        token
      })

    assertNoSdkError(
      error,
      '邮箱验证码验证失败'
    )

    pendingEmailSignUp = null

    return data?.session || (await getSession())
  }

  const existingSession =
    await getSession().catch(() => null)

  if (existingSession) {
    return existingSession
  }

  try {
    return await loginWithPassword(
      email,
      password
    )
  } catch (loginError) {
    const recoveryError = new Error(
      '验证码会话已失效。请重新发送验证码，并在收到验证码后不要刷新页面。'
    )

    recoveryError.code = 'OTP_CONTEXT_LOST'
    recoveryError.cause = loginError

    throw recoveryError
  }
}

export function resetPendingEmailSignUp() {
  pendingEmailSignUp = null
}

export async function logout() {
  const { error } = await cloudbaseAuth.signOut()
  assertNoSdkError(error, '退出登录失败')
}

export async function callCloudFunction(
  functionName,
  action,
  payload = {}
) {
  requireWebConfig()

  const response =
    await cloudbaseApp.callFunction({
      name: functionName,
      data: {
        action,
        ...payload
      }
    })

  const result = response?.result

  if (!result || result.ok !== true) {
    const error = new Error(
      result?.message ||
        `云函数操作失败：${action}`
    )

    error.code =
      result?.code || 'CLOUD_FUNCTION_ERROR'
    error.details = result?.details || null

    throw error
  }

  return result.data
}

export function callAdmin(
  action,
  payload = {}
) {
  return callCloudFunction(
    ADMIN_FUNCTION_NAME,
    action,
    payload
  )
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

export async function uploadImage(
  file,
  folder = 'products'
) {
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


export async function uploadVideo(
  file,
  folder = 'product-videos'
) {
  requireWebConfig()

  if (!(file instanceof File)) {
    throw new Error('没有选择有效视频')
  }

  if (!file.type.startsWith('video/')) {
    throw new Error('只能上传视频文件')
  }

  if (file.size > 80 * 1024 * 1024) {
    throw new Error('视频不能超过 80MB')
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



function safeImportFolder(folder) {
  return String(folder || 'imports')
    .replace(/[^a-zA-Z0-9/_-]/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '')
}

export async function uploadImportAsset({
  blob,
  fileName,
  folder = 'imports'
}) {
  requireWebConfig()

  if (!(blob instanceof Blob)) {
    throw new Error('没有可上传的图片内容')
  }

  if (blob.size > 8 * 1024 * 1024) {
    throw new Error(`图片 ${fileName || ''} 不能超过 8MB`)
  }

  const normalizedName = safeFileName(
    fileName || 'image'
  )
  const cloudPath = [
    'public',
    'admin',
    'imports',
    safeImportFolder(folder),
    new Date().toISOString().slice(0, 10),
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}-${normalizedName}`
  ].join('/')

  const file = blob instanceof File
    ? blob
    : new File(
        [blob],
        normalizedName,
        { type: blob.type || 'application/octet-stream' }
      )

  const result = await cloudbaseApp.uploadFile({
    cloudPath,
    filePath: file
  })

  if (!result?.fileID) {
    throw new Error('云存储没有返回 File ID')
  }

  return result.fileID
}
