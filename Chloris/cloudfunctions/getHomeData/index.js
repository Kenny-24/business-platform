const cloudbase = require('@cloudbase/node-sdk')
const { cloneHolidayCatalog } = require('./holiday-catalog')

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV
})
const db = app.database()

function text(value, fallback = '') {
  return String(value ?? fallback).trim()
}

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function array(value) {
  return Array.isArray(value) ? value : []
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null
}

function bannerPlacement(value) {
  const placement = text(value)
  return placement === 'categoryHero' ? 'categoryHero' : 'home'
}

function isMissingCollection(error) {
  const message = String(error && (error.message || error))
  return (
    message.includes('not exist') ||
    message.includes('does not exist') ||
    message.includes('不存在')
  )
}

async function safeGetAll(collectionName, limit = 1000) {
  try {
    const result = await db
      .collection(collectionName)
      .limit(limit)
      .get()

    return Array.isArray(result.data) ? result.data : []
  } catch (error) {
    if (isMissingCollection(error)) return []
    throw error
  }
}

async function createTempUrlMap(fileIds) {
  const uniqueFileIds = [
    ...new Set(
      fileIds
        .map((fileId) => text(fileId))
        .filter((fileId) => fileId.startsWith('cloud://'))
    )
  ]

  const urlMap = Object.create(null)
  if (uniqueFileIds.length === 0) return urlMap

  const result = await app.getTempFileURL({
    fileList: uniqueFileIds
  })

  for (const file of result.fileList || []) {
    if (file.fileID && file.tempFileURL) {
      urlMap[file.fileID] = file.tempFileURL
    }
  }

  return urlMap
}

function mergeCalendarEvents(overrides) {
  const builtIns = cloneHolidayCatalog()
  const overrideMap = new Map(
    overrides
      .filter((item) => text(item.eventKey))
      .map((item) => [text(item.eventKey), item])
  )
  const builtInKeys = new Set(builtIns.map((item) => item.eventKey))

  const merged = builtIns.map((item) => {
    const override = overrideMap.get(item.eventKey) || {}

    return {
      ...item,
      ...override,
      _id: override._id || item.eventKey,
      eventKey: item.eventKey,
      builtIn: true,
      rule: {
        ...item.rule,
        ...(object(override.rule) || {})
      },
      searchKeywords:
        Array.isArray(override.searchKeywords)
          ? override.searchKeywords
          : item.searchKeywords,
      productIds: array(override.productIds),
      enabled: override.enabled !== false,
      recommendationEnabled:
        override.recommendationEnabled === undefined
          ? item.recommendationEnabled !== false
          : override.recommendationEnabled !== false
    }
  })

  const custom = overrides
    .filter((item) => {
      const key = text(item.eventKey)
      return key && !builtInKeys.has(key)
    })
    .map((item) => ({
      ...item,
      _id: item._id || item.eventKey,
      eventKey: text(item.eventKey),
      builtIn: false,
      rule: object(item.rule),
      productIds: array(item.productIds),
      searchKeywords: array(item.searchKeywords),
      enabled: item.enabled !== false,
      recommendationEnabled: item.recommendationEnabled !== false
    }))

  return [...merged, ...custom]
    .filter((item) => item.enabled !== false && item.rule)
    .sort((a, b) => number(b.sort) - number(a.sort))
}

function publicProduct(item, urlMap) {
  const coverFileId = text(item.coverFileId)

  return {
    _id: item._id,
    type: text(item.type),
    category: text(item.category),
    name: text(item.name),
    subtitle: text(item.subtitle),
    priceFen: Math.max(0, Math.round(number(item.priceFen))),
    unit: text(item.unit, '件'),
    stock: Math.max(0, Math.round(number(item.stock))),
    featured: item.featured === true,
    onSale: item.onSale === true,
    sceneTags: array(item.sceneTags),
    colorTags: array(item.colorTags),
    searchKeywords: array(item.searchKeywords),
    atlasIds: array(item.atlasIds),
    coverFileId,
    imageUrl: urlMap[coverFileId] || '',
    sort: number(item.sort)
  }
}

function publicProductDetail(item, urlMap) {
  const basic = publicProduct(item, urlMap)
  const galleryFileIds = array(item.galleryFileIds)
    .map((fileId) => text(fileId))
    .filter(Boolean)
  const videoFileId = text(item.videoFileId)
  const videoPosterFileId = text(item.videoPosterFileId)
  const galleryUrls = galleryFileIds
    .map((fileId) => urlMap[fileId] || '')
    .filter(Boolean)

  if (basic.imageUrl && !galleryUrls.includes(basic.imageUrl)) {
    galleryUrls.unshift(basic.imageUrl)
  }

  return {
    ...basic,
    sku: text(item.sku),
    galleryFileIds,
    galleryUrls,
    videoFileId,
    videoUrl: urlMap[videoFileId] || '',
    videoPosterFileId,
    videoPosterUrl: urlMap[videoPosterFileId] || basic.imageUrl || '',
    detailDescription: text(item.detailDescription),
    flowerMaterialInfo: text(item.flowerMaterialInfo),
    sizeDescription: text(item.sizeDescription),
    deliveryDescription: text(item.deliveryDescription),
    careDescription: text(item.careDescription)
  }
}

function publicBanner(item, urlMap) {
  const imageFileId = text(item.imageFileId)

  return {
    _id: item._id,
    scene: text(item.scene),
    title: text(item.title),
    subtitle: text(item.subtitle),
    buttonText: text(item.buttonText, '立即查看'),
    actionType: text(item.actionType, 'category'),
    actionValue: text(item.actionValue, '推荐花束'),
    placement: bannerPlacement(item.placement),
    imageFileId,
    imageUrl: urlMap[imageFileId] || '',
    sort: number(item.sort)
  }
}

function publicAtlas(item, urlMap) {
  const imageFileId = text(item.imageFileId)

  return {
    _id: item._id,
    name: text(item.name),
    latinName: text(item.latinName),
    alias: text(item.alias),
    meaning: text(item.meaning),
    description: text(item.description),
    careGuide: text(item.careGuide),
    floweringPeriod: text(item.floweringPeriod),
    toxicityNote: text(item.toxicityNote),
    imageBackground: ['dark', 'light', 'soft'].includes(
      text(item.imageBackground)
    )
      ? text(item.imageBackground)
      : 'soft',
    category: text(item.category, '鲜切花'),
    sceneTags: array(item.sceneTags),
    colorTags: array(item.colorTags),
    seasonTags: array(item.seasonTags),
    homeFeatured: item.homeFeatured === true,
    published: item.published !== false,
    imageFileId,
    imageUrl: urlMap[imageFileId] || '',
    sort: number(item.sort)
  }
}

function publicCalendarEvent(item) {
  return {
    _id: item._id || item.eventKey,
    eventKey: text(item.eventKey),
    name: text(item.name),
    region: text(item.region, 'domestic'),
    rule: object(item.rule),
    title: text(item.title) || text(item.name),
    description: text(item.description),
    activityTimeText: text(item.activityTimeText),
    categoryIntent: text(item.categoryIntent, '推荐花束'),
    searchKeywords: array(item.searchKeywords),
    productIds: array(item.productIds),
    recommendationEnabled: item.recommendationEnabled !== false,
    enabled: item.enabled !== false,
    builtIn: item.builtIn === true,
    sort: number(item.sort)
  }
}

exports.main = async (event = {}) => {
  try {
    if (text(event.action) === 'getProductDetail') {
      const id = text(event.id)
      if (!id) {
        return { ok: false, code: 'INVALID_ID', message: '缺少商品 ID' }
      }

      let product = null
      try {
        const result = await db.collection('products').doc(id).get()
        const data = result && result.data
        product = Array.isArray(data) ? data[0] : data
      } catch (error) {
        if (!isMissingCollection(error)) throw error
      }

      if (!product || product.onSale !== true) {
        return { ok: false, code: 'NOT_FOUND', message: '商品不存在或已下架' }
      }

      const fileIds = [
        product.coverFileId,
        ...array(product.galleryFileIds),
        product.videoFileId,
        product.videoPosterFileId
      ]
      const urlMap = await createTempUrlMap(fileIds)
      return {
        ok: true,
        product: publicProductDetail(product, urlMap),
        serverTime: Date.now()
      }
    }
    const [allProducts, allBanners, allAtlas, calendarOverrides] =
      await Promise.all([
        safeGetAll('products'),
        safeGetAll('banners'),
        safeGetAll('atlas'),
        safeGetAll('calendarEvents')
      ])

    const products = allProducts
      .filter((item) => item.onSale === true && number(item.stock) > 0)
      .sort((a, b) => number(b.sort) - number(a.sort))

    const enabledBanners = allBanners
      .filter((item) => item.enabled === true)
      .sort((a, b) => number(b.sort) - number(a.sort))

    const banners = enabledBanners
      .filter((item) => bannerPlacement(item.placement) === 'home')
      .slice(0, 6)

    const categoryBanners = enabledBanners
      .filter((item) => bannerPlacement(item.placement) === 'categoryHero')
      .slice(0, 3)

    const atlas = allAtlas
      .filter((item) => item.published === true)
      .sort((a, b) => number(b.sort) - number(a.sort))
      .slice(0, 200)

    const calendarEvents = mergeCalendarEvents(calendarOverrides)

    const fileIds = [
      ...products.map((item) => item.coverFileId),
      ...banners.map((item) => item.imageFileId),
      ...categoryBanners.map((item) => item.imageFileId),
      ...atlas.map((item) => item.imageFileId)
    ]

    const urlMap = await createTempUrlMap(fileIds)

    return {
      ok: true,
      products: products.map((item) => publicProduct(item, urlMap)),
      banners: banners.map((item) => publicBanner(item, urlMap)),
      categoryBanners: categoryBanners.map((item) =>
        publicBanner(item, urlMap)
      ),
      atlas: atlas.map((item) => publicAtlas(item, urlMap)),
      calendarEvents: calendarEvents.map(publicCalendarEvent),
      serverTime: Date.now()
    }
  } catch (error) {
    console.error('[getHomeData]', error)

    return {
      ok: false,
      code: error.code || 'GET_HOME_DATA_FAILED',
      message: error.message || '首页数据加载失败',
      products: [],
      banners: [],
      categoryBanners: [],
      atlas: [],
      calendarEvents: []
    }
  }
}
