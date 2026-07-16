const {
  getPoints
} = require('./storage')

const PROFILE_KEY = 'huayu_user_profile_v1'
const ORDERS_KEY = 'huayu_orders_v1'
const ADDRESSES_KEY = 'huayu_addresses_v1'
const FAVORITES_KEY = 'huayu_favorites_v1'
const ATLAS_FAVORITES_KEY = 'huayu_atlas_favorites_v1'
const COUPONS_KEY = 'huayu_coupons_v1'

function readStorage(key, fallback) {
  try {
    const value = wx.getStorageSync(key)

    if (
      value === '' ||
      value === undefined ||
      value === null
    ) {
      return fallback
    }

    return value
  } catch (error) {
    console.warn(`读取 ${key} 失败：`, error)
    return fallback
  }
}

function readArray(key) {
  const value = readStorage(key, [])
  return Array.isArray(value)
    ? value
    : []
}

function readImportantDates() {
  try {
    const {
      getImportantDates
    } = require('./calendar-storage')

    const result = getImportantDates()
    return Array.isArray(result)
      ? result
      : []
  } catch (error) {
    return []
  }
}

function normalizeProfile(raw) {
  const source =
    raw && typeof raw === 'object'
      ? raw
      : {}

  const loggedIn =
    source.loggedIn === true ||
    Boolean(source.uid)

  return {
    loggedIn,
    uid: String(source.uid || ''),
    nickname: loggedIn
      ? String(source.nickname || '花予用户')
      : '登录 / 注册',
    avatarUrl: loggedIn
      ? String(source.avatarUrl || '')
      : '',
    memberLevel: loggedIn
      ? String(source.memberLevel || '普通会员')
      : '',
    description: loggedIn
      ? String(source.description || '欢迎回到花予')
      : '登录后查看订单、积分和收藏'
  }
}

function normalizeOrderStatus(value) {
  const status = String(value || '').trim()

  const aliases = {
    pending_confirm: 'pendingConfirm',
    pendingConfirm: 'pendingConfirm',
    pending_payment: 'pendingPayment',
    pendingPayment: 'pendingPayment',
    making: 'making',
    production: 'making',
    delivering: 'delivering',
    delivery: 'delivering',
    completed: 'completed',
    complete: 'completed'
  }

  return aliases[status] || ''
}

function countOrders(orders) {
  const counts = {
    pendingConfirm: 0,
    pendingPayment: 0,
    making: 0,
    delivering: 0,
    completed: 0
  }

  orders.forEach((order) => {
    const status = normalizeOrderStatus(
      order && order.status
    )

    if (
      status &&
      Object.prototype.hasOwnProperty.call(
        counts,
        status
      )
    ) {
      counts[status] += 1
    }
  })

  return counts
}

function countActiveCoupons(coupons) {
  const now = Date.now()

  return coupons.filter((coupon) => {
    if (
      !coupon ||
      coupon.enabled === false ||
      coupon.used === true
    ) {
      return false
    }

    const expiresAt = Number(
      coupon.expiresAt || 0
    )

    return !expiresAt || expiresAt > now
  }).length
}

function getProfileOverview() {
  const profile = normalizeProfile(
    readStorage(PROFILE_KEY, {})
  )
  const orders = readArray(ORDERS_KEY)
  const addresses = readArray(ADDRESSES_KEY)
  const favorites = readArray(FAVORITES_KEY)
  const atlasFavorites = readArray(ATLAS_FAVORITES_KEY)
  const coupons = readArray(COUPONS_KEY)
  const importantDates =
    readImportantDates().filter(
      (item) => item.enabled !== false
    )

  return {
    loggedIn: profile.loggedIn,
    profile,
    orderCounts: countOrders(orders),
    assets: {
      points: Math.max(
        0,
        Number(getPoints() || 0)
      ),
      coupons: countActiveCoupons(coupons),
      favorites: favorites.length + atlasFavorites.length
    },
    counts: {
      addresses: addresses.length,
      importantDates: importantDates.length
    }
  }
}

module.exports = {
  getProfileOverview
}
