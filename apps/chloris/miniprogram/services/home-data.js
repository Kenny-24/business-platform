const CACHE_KEY = 'huayu_home_data_cache_v7'
const CACHE_DURATION = 2 * 60 * 1000

let memoryCache = null
let inflightPromise = null
const productDetailCache = new Map()
const productDetailInflight = new Map()

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.map(normalizeString).filter(Boolean)
    : []
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
    sceneTags: normalizeStringArray(item.sceneTags),
    colorTags: normalizeStringArray(item.colorTags),
    searchKeywords: normalizeStringArray(item.searchKeywords),
    salesMode: normalizeString(item.salesMode) || 'spot',
    limitedTimeEnabled: item.limitedTimeEnabled === true,
    saleStartAt: normalizeString(item.saleStartAt),
    saleEndAt: normalizeString(item.saleEndAt),
    festivalCampaignId: normalizeString(item.festivalCampaignId),
    campaignType: normalizeString(item.campaignType),
    campaignName: normalizeString(item.campaignName),
    preorderStartAt: normalizeString(item.preorderStartAt),
    preorderEndAt: normalizeString(item.preorderEndAt),
    deliveryStartDate: normalizeString(item.deliveryStartDate),
    deliveryEndDate: normalizeString(item.deliveryEndDate),
    reservationDeadlineAt: normalizeString(item.reservationDeadlineAt),
    reservationQuota: Math.max(0, Number(item.reservationQuota || 0)),
    productionUnits: Math.max(1, Number(item.productionUnits || 1)),
    studioId: normalizeString(item.studioId),
    color:
      Array.isArray(item.colorTags) && item.colorTags.length > 0
        ? normalizeString(item.colorTags[0])
        : '',
    coverFileId: normalizeString(item.coverFileId),
    image: normalizeString(item.imageUrl),
    sort: Number(item.sort || 0)
  }
}

function normalizeProductDetail(item) {
  const basic = normalizeProduct(item)
  const galleryUrls = normalizeStringArray(item.galleryUrls)
  if (basic.image && !galleryUrls.includes(basic.image)) {
    galleryUrls.unshift(basic.image)
  }

  return {
    ...basic,
    category: normalizeString(item.category),
    sku: normalizeString(item.sku),
    galleryUrls,
    videoUrl: normalizeString(item.videoUrl),
    videoPosterUrl: normalizeString(item.videoPosterUrl) || basic.image,
    detailDescription: normalizeString(item.detailDescription),
    flowerMaterialInfo: normalizeString(item.flowerMaterialInfo),
    sizeDescription: normalizeString(item.sizeDescription),
    deliveryDescription: normalizeString(item.deliveryDescription),
    careDescription: normalizeString(item.careDescription)
  }
}

const BANNER_CATEGORY_MAP = {
  flower: '鲜切花材',
  bouquet: '花礼',
  succulent: '多肉绿植',
  greenPlant: '多肉绿植',
  vase: '工具',
  tool: '工具',
  floralTool: '工具',
  accessory: '工具',
  gift: '花礼',
  推荐: '花礼',
  推荐花束: '花礼',
  成品花束: '花礼',
  鲜花花束: '花礼',
  花束: '花礼',
  鲜花: '鲜切花材',
  居家布置: '花礼',
  家居插花: '花礼',
  礼赠花礼: '花礼',
  多肉植物: '多肉绿植',
  绿植多肉: '多肉绿植',
  绿植: '多肉绿植',
  花器: '工具',
  花器礼品: '工具',
  工具: '工具',
  礼品: '花礼',
  情人节预定: '情人节限定'
}

function normalizeBanner(item, index) {
  const actionType = normalizeString(item.actionType) || 'category'
  const actionValue = normalizeString(item.actionValue)
  const placement = normalizeString(item.placement) || 'home'
  const categoryIntent =
    BANNER_CATEGORY_MAP[actionValue] || actionValue || '花束'

  let action = 'category'
  if (actionType === 'calendar') action = 'calendar'
  if (actionType === 'builder') action = 'builder'

  return {
    id: item._id || `cloud-banner-${index}`,
    image: normalizeString(item.imageUrl),
    scene: normalizeString(item.scene),
    title: normalizeString(item.title),
    subtitle: normalizeString(item.subtitle),
    cta: normalizeString(item.buttonText) || '立即查看',
    action,
    categoryIntent,
    actionType,
    actionValue,
    placement
  }
}

function normalizeCampaign(item, index) {
  return { id: item._id || `campaign-${index}`, _id: item._id || `campaign-${index}`, name: normalizeString(item.name), type: normalizeString(item.type) || 'festival', title: normalizeString(item.title) || normalizeString(item.name), subtitle: normalizeString(item.subtitle), enabled: item.enabled !== false, preSaleStartAt: normalizeString(item.preSaleStartAt), preSaleEndAt: normalizeString(item.preSaleEndAt), deliveryStartDate: normalizeString(item.deliveryStartDate), deliveryEndDate: normalizeString(item.deliveryEndDate), reservationDeadlineAt: normalizeString(item.reservationDeadlineAt), productIds: normalizeStringArray(item.productIds), sort: Number(item.sort || 0) }
}

function normalizeCalendarEvent(item, index) {
  return {
    id: item._id || item.eventKey || `calendar-event-${index}`,
    _id: item._id || '',
    eventKey: normalizeString(item.eventKey) || item._id || `calendar-event-${index}`,
    name: normalizeString(item.name),
    region: normalizeString(item.region) || 'domestic',
    regionLabel: normalizeString(item.region) === 'international' ? '国际节日' : '国内节日',
    rule: item.rule && typeof item.rule === 'object'
      ? { ...item.rule }
      : null,
    title: normalizeString(item.title) || normalizeString(item.name),
    description: normalizeString(item.description),
    categoryIntent: BANNER_CATEGORY_MAP[normalizeString(item.categoryIntent)] || normalizeString(item.categoryIntent) || '花束',
    searchKeywords: normalizeStringArray(item.searchKeywords),
    productIds: normalizeStringArray(item.productIds),
    recommendationEnabled: item.recommendationEnabled !== false,
    enabled: item.enabled !== false,
    builtIn: item.builtIn === true,
    sort: Number(item.sort || 0)
  }
}

function normalizePayload(payload) {
  return {
    products: (payload.products || []).map(normalizeProduct),
    banners: (payload.banners || []).map(normalizeBanner),
    categoryBanners: (payload.categoryBanners || []).map(normalizeBanner),
    campaigns: (payload.campaigns || []).map(normalizeCampaign),
    calendarEvents: (payload.calendarEvents || []).filter((item) => normalizeString(item.region) !== 'merchant').map(normalizeCalendarEvent),
    serverTime: Number(payload.serverTime || Date.now()),
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
    console.warn('读取统一数据缓存失败：', error)
  }

  return null
}

function writeCache(data) {
  memoryCache = data
  try {
    wx.setStorageSync(CACHE_KEY, data)
  } catch (error) {
    console.warn('写入统一数据缓存失败：', error)
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

  if (inflightPromise) return inflightPromise

  inflightPromise = wx.cloud.callFunction({
    name: 'getHomeData',
    data: {}
  })
    .then((response) => {
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
    })
    .finally(() => {
      inflightPromise = null
    })

  return inflightPromise
}

async function fetchProductDetail(id, options = {}) {
  const productId = normalizeString(id)
  if (!productId) throw new Error('缺少商品 ID')

  const forceRefresh = options.forceRefresh === true
  const cached = productDetailCache.get(productId)
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_DURATION) {
    return cached.product
  }

  if (!wx.cloud) {
    throw new Error('当前微信基础库不支持云开发')
  }

  if (productDetailInflight.has(productId)) {
    return productDetailInflight.get(productId)
  }

  const promise = wx.cloud.callFunction({
    name: 'getHomeData',
    data: {
      action: 'getProductDetail',
      id: productId
    }
  })
    .then((response) => {
      const payload = response && response.result
      if (!payload || payload.ok !== true || !payload.product) {
        throw new Error(
          payload && payload.message
            ? payload.message
            : '商品详情加载失败'
        )
      }

      const product = normalizeProductDetail(payload.product)
      productDetailCache.set(productId, {
        product,
        fetchedAt: Date.now()
      })
      return product
    })
    .catch(async (error) => {
      const homeData = await fetchHomeData()
      const fallback = (homeData.products || []).find(
        (item) => String(item.id || item._id) === productId
      )
      if (!fallback) throw error

      const product = normalizeProductDetail({
        ...fallback,
        _id: fallback.id || fallback._id,
        priceFen: fallback.priceFen,
        imageUrl: fallback.image,
        galleryUrls: fallback.image ? [fallback.image] : []
      })
      productDetailCache.set(productId, {
        product,
        fetchedAt: Date.now()
      })
      return product
    })
    .finally(() => {
      productDetailInflight.delete(productId)
    })

  productDetailInflight.set(productId, promise)
  return promise
}

function clearHomeDataCache() {
  memoryCache = null
  productDetailCache.clear()
  try {
    wx.removeStorageSync(CACHE_KEY)
  } catch (error) {
    console.warn('清除统一数据缓存失败：', error)
  }
}

module.exports = {
  fetchHomeData,
  fetchProductDetail,
  clearHomeDataCache
}
