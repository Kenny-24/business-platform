const {
  getOverview,
  getCachedOverview
} = require('./user-service')
const {
  recordPurchasedAtlasIds
} = require('./atlas-purchases')

const FAVORITES_KEY = 'huayu_favorites_v1'
const ATLAS_FAVORITES_KEY = 'huayu_atlas_favorites_v1'
const COUPONS_KEY = 'huayu_coupons_v1'

function readStorage(key, fallback) {
  try {
    const value = wx.getStorageSync(key)
    return value === '' || value === undefined || value === null
      ? fallback
      : value
  } catch (error) {
    return fallback
  }
}

function readArray(key) {
  const value = readStorage(key, [])
  return Array.isArray(value) ? value : []
}

function readImportantDates() {
  try {
    const {
      getImportantDates
    } = require('./calendar-storage')

    const result = getImportantDates()
    return Array.isArray(result) ? result : []
  } catch (error) {
    return []
  }
}

function countActiveCoupons(coupons) {
  const now = Date.now()

  return coupons.filter((coupon) => {
    if (!coupon || coupon.enabled === false || coupon.used === true) {
      return false
    }

    const expiresAt = Number(coupon.expiresAt || 0)
    return !expiresAt || expiresAt > now
  }).length
}

function normalizeOverview(source) {
  const overview = source || {}
  const rawProfile = overview.profile || {}
  const favorites = readArray(FAVORITES_KEY)
  const atlasFavorites = readArray(ATLAS_FAVORITES_KEY)
  const coupons = readArray(COUPONS_KEY)
  const importantDates = readImportantDates()
    .filter((item) => item.enabled !== false)

  const purchasedAtlasIds = Array.isArray(overview.purchasedAtlasIds)
    ? overview.purchasedAtlasIds
    : []

  recordPurchasedAtlasIds(purchasedAtlasIds)

  return {
    loggedIn: overview.loggedIn !== false,
    profile: {
      loggedIn: true,
      uid: String(rawProfile._id || ''),
      nickname: String(rawProfile.nickname || '花予用户'),
      avatarUrl: String(rawProfile.avatarUrl || ''),
      avatarFileId: String(rawProfile.avatarFileId || ''),
      memberLevel: String(rawProfile.memberLevelLabel || '普通会员'),
      description: '欢迎回到花予'
    },
    orderCounts: {
      pendingConfirm: Number(overview.orderCounts && overview.orderCounts.pendingConfirm || 0),
      pendingPayment: Number(overview.orderCounts && overview.orderCounts.pendingPayment || 0),
      making: Number(overview.orderCounts && overview.orderCounts.making || 0),
      delivering: Number(overview.orderCounts && overview.orderCounts.delivering || 0),
      completed: Number(overview.orderCounts && overview.orderCounts.completed || 0)
    },
    assets: {
      points: Number(overview.assets && overview.assets.points || 0),
      coupons: Number(overview.assets && overview.assets.coupons || 0) + countActiveCoupons(coupons),
      favorites: Number(overview.assets && overview.assets.favorites || 0) + favorites.length + atlasFavorites.length
    },
    counts: {
      addresses: Number(overview.counts && overview.counts.addresses || 0),
      importantDates: importantDates.length
    },
    purchasedAtlasIds
  }
}

async function getProfileOverview() {
  try {
    return normalizeOverview(await getOverview())
  } catch (error) {
    const cached = getCachedOverview()

    if (cached) {
      console.warn('用户中心使用缓存数据：', error)
      return normalizeOverview(cached)
    }

    throw error
  }
}

module.exports = {
  getProfileOverview
}
