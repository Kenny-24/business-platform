const {
  callCloudFunction
} = require('./cloud-api')

const USER_CACHE_KEY = 'huayu_cloud_user_v1'
const ADDRESS_CACHE_KEY = 'huayu_cloud_addresses_v1'
const OVERVIEW_CACHE_KEY = 'huayu_cloud_overview_v1'

let initializedUser = null
let initializingPromise = null

function writeStorage(key, value) {
  try {
    wx.setStorageSync(key, value)
  } catch (error) {
    console.warn(`保存 ${key} 失败：`, error)
  }
}

function readStorage(key, fallback = null) {
  try {
    const value = wx.getStorageSync(key)
    return value === '' || value === undefined || value === null
      ? fallback
      : value
  } catch (error) {
    return fallback
  }
}

async function ensureUser(options = {}) {
  const force = options.force === true

  if (!force && initializedUser) {
    return initializedUser
  }

  if (!force && initializingPromise) {
    return initializingPromise
  }

  initializingPromise = callCloudFunction(
    'userApi',
    'ensureUser'
  )
    .then((user) => {
      initializedUser = user
      writeStorage(USER_CACHE_KEY, user)
      return user
    })
    .finally(() => {
      initializingPromise = null
    })

  return initializingPromise
}

async function getProfile() {
  const profile = await callCloudFunction(
    'userApi',
    'getProfile'
  )

  initializedUser = profile
  writeStorage(USER_CACHE_KEY, profile)
  return profile
}

async function updateProfile(profile) {
  const result = await callCloudFunction(
    'userApi',
    'updateProfile',
    { profile }
  )

  initializedUser = result
  writeStorage(USER_CACHE_KEY, result)
  return result
}

async function uploadFile(filePath, folder = 'files') {
  const user = await ensureUser()
  const extension = String(filePath || '')
    .split('.')
    .pop()
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8) || 'jpg'
  const cloudPath = [
    'public',
    'users',
    String(user._id || 'customer'),
    folder,
    `${Date.now()}-${Math.random().toString(16).slice(2, 8)}.${extension}`
  ].join('/')

  const result = await wx.cloud.uploadFile({
    cloudPath,
    filePath
  })

  return result.fileID
}

async function uploadAvatar(filePath) {
  return uploadFile(filePath, 'avatar')
}

async function saveLocation(location = {}) {
  const result = await callCloudFunction('userApi', 'saveLocation', { location })

  const cachedUser = getCachedUser() || {}
  const nextUser = {
    ...cachedUser,
    lastLocation: result.lastLocation || null
  }
  initializedUser = nextUser
  writeStorage(USER_CACHE_KEY, nextUser)
  return result
}


async function markLocationPrompted() {
  const result = await callCloudFunction(
    'userApi',
    'markLocationPrompted'
  )

  const cachedUser = getCachedUser() || {}
  const nextUser = {
    ...cachedUser,
    locationPrompted: true
  }

  initializedUser = nextUser
  writeStorage(USER_CACHE_KEY, nextUser)
  return result
}

async function createQuoteRequest(payload = {}) {
  const result = await callCloudFunction('userApi', 'createQuoteRequest', { payload })
  const cachedUser = getCachedUser() || {}
  const nextUser = {
    ...cachedUser,
    contactName: String(payload.contactName || '').trim(),
    contactPhone: String(payload.contactPhone || '').trim(),
    contactWechat: String(payload.contactWechat || '').trim()
  }
  initializedUser = nextUser
  writeStorage(USER_CACHE_KEY, nextUser)
  return result
}

async function listQuoteRequests(status = 'all') {
  return callCloudFunction('userApi', 'listQuoteRequests', { status })
}

async function getQuoteRequest(id) {
  return callCloudFunction('userApi', 'getQuoteRequest', { id })
}

async function respondQuoteRequest(id, decision, delivery = {}) {
  const result = await callCloudFunction('userApi', 'respondQuoteRequest', {
    id,
    decision,
    delivery
  })

  try {
    wx.removeStorageSync(OVERVIEW_CACHE_KEY)
  } catch (error) {}

  return result
}

async function listAddresses() {
  const result = await callCloudFunction(
    'userApi',
    'listAddresses'
  )

  writeStorage(ADDRESS_CACHE_KEY, result)
  return result
}

function getCachedAddresses() {
  return readStorage(ADDRESS_CACHE_KEY, {
    items: [],
    total: 0,
    defaultAddress: null
  })
}

function getAddress(id) {
  return callCloudFunction(
    'userApi',
    'getAddress',
    { id }
  )
}

async function saveAddress(address) {
  const result = await callCloudFunction(
    'userApi',
    'saveAddress',
    { address }
  )

  await listAddresses()
  return result
}

async function deleteAddress(id) {
  const result = await callCloudFunction(
    'userApi',
    'deleteAddress',
    { id }
  )

  await listAddresses()
  return result
}

async function setDefaultAddress(id) {
  const result = await callCloudFunction(
    'userApi',
    'setDefaultAddress',
    { id }
  )

  await listAddresses()
  return result
}

async function getOverview() {
  const result = await callCloudFunction(
    'userApi',
    'getOverview'
  )

  writeStorage(OVERVIEW_CACHE_KEY, result)
  writeStorage(USER_CACHE_KEY, result.profile)
  initializedUser = result.profile
  return result
}



function getCachedUser() {
  return initializedUser || readStorage(USER_CACHE_KEY, null)
}

function getCachedOverview() {
  return readStorage(OVERVIEW_CACHE_KEY, null)
}

module.exports = {
  ensureUser,
  getProfile,
  updateProfile,
  uploadFile,
  uploadAvatar,
  saveLocation,
  markLocationPrompted,
  createQuoteRequest,
  listQuoteRequests,
  getQuoteRequest,
  respondQuoteRequest,
  listAddresses,
  getCachedAddresses,
  getAddress,
  saveAddress,
  deleteAddress,
  setDefaultAddress,
  getOverview,
  getCachedUser,
  getCachedOverview
}
