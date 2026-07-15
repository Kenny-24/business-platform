const CACHE_KEY = 'huayu_home_data_cache_v2'
const CACHE_DURATION = 3 * 60 * 1000

let memoryCache = null

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeProduct(item) {
  return {
    id: item._id,
    _id: item._id,
    type: normalizeString(item.type),
    name: normalizeString(item.name),
    subtitle: normalizeString(item.subtitle),
    price: Number(item.priceFen || 0) / 100,
    priceFen: Number(item.priceFen || 0),
    unit: normalizeString(item.unit) || '件',
    stock: Math.max(0, Number(item.stock || 0)),
    featured: item.featured === true,
    onSale: item.onSale === true,
    sceneTags: Array.isArray(item.sceneTags) ? item.sceneTags : [],
    colorTags: Array.isArray(item.colorTags) ? item.colorTags : [],
    color: Array.isArray(item.colorTags) && item.colorTags.length > 0
      ? item.colorTags[0]
      : '',
    coverFileId: normalizeString(item.coverFileId),
    image: normalizeString(item.imageUrl)
  }
}

function normalizeBanner(item, index) {
  const actionType = normalizeString(item.actionType)
  const actionValue = normalizeString(item.actionValue)

  let action = 'bouquets'
  if (actionType === 'calendar') action = 'calendar'
  if (actionType === 'builder') action = 'builder'
  if (actionType === 'category' && actionValue === 'flower') action = 'flowers'
  if (actionType === 'category' && actionValue === 'bouquet') action = 'bouquets'
  if (actionType === 'category' && ['succulent', 'greenPlant'].includes(actionValue)) {
    action = 'homeDecor'
  }

  return {
    id: item._id || `cloud-banner-${index}`,
    image: normalizeString(item.imageUrl),
    scene: normalizeString(item.scene),
    title: normalizeString(item.title),
    subtitle: normalizeString(item.subtitle),
    cta: normalizeString(item.buttonText) || '立即查看',
    action,
    actionType,
    actionValue
  }
}

function normalizeAtlas(item, index) {
  return {
    id: item._id || `cloud-atlas-${index}`,
    name: normalizeString(item.name),
    latin: normalizeString(item.latinName),
    meaning: normalizeString(item.meaning),
    description: normalizeString(item.description),
    careGuide: normalizeString(item.careGuide),
    image: normalizeString(item.imageUrl)
  }
}

function normalizePayload(payload) {
  return {
    products: (payload.products || []).map(normalizeProduct),
    banners: (payload.banners || []).map(normalizeBanner),
    atlas: (payload.atlas || []).map(normalizeAtlas),
    fetchedAt: Date.now()
  }
}

function isFresh(cache) {
  return cache && Date.now() - Number(cache.fetchedAt || 0) < CACHE_DURATION
}

function readCache() {
  if (isFresh(memoryCache)) return memoryCache

  try {
    const cached = wx.getStorageSync(CACHE_KEY)
    if (isFresh(cached)) {
      memoryCache = cached
      return cached
    }
  } catch (error) {
    console.warn('读取首页缓存失败：', error)
  }

  return null
}

function writeCache(data) {
  memoryCache = data
  try {
    wx.setStorageSync(CACHE_KEY, data)
  } catch (error) {
    console.warn('写入首页缓存失败：', error)
  }
}

async function fetchHomeData(options = {}) {
  const forceRefresh = options.forceRefresh === true

  if (!forceRefresh) {
    const cached = readCache()
    if (cached) return cached
  }

  if (!wx.cloud) {
    throw new Error('当前微信基础库不支持云开发')
  }

  const response = await wx.cloud.callFunction({
    name: 'getHomeData',
    data: {}
  })

  const payload = response && response.result

  if (!payload || payload.ok !== true) {
    throw new Error(
      payload && payload.message
        ? payload.message
        : 'getHomeData 云函数返回异常'
    )
  }

  const normalized = normalizePayload(payload)
  writeCache(normalized)
  return normalized
}

function clearHomeDataCache() {
  memoryCache = null
  try {
    wx.removeStorageSync(CACHE_KEY)
  } catch (error) {
    console.warn('清除首页缓存失败：', error)
  }
}

module.exports = {
  fetchHomeData,
  clearHomeDataCache
}
