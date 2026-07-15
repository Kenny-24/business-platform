const cloudbase = require('@cloudbase/node-sdk')

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

async function safeGetAll(collectionName, limit = 1000) {
  try {
    const result = await db
      .collection(collectionName)
      .limit(limit)
      .get()

    return Array.isArray(result.data) ? result.data : []
  } catch (error) {
    const message = String(error.message || error)

    if (
      message.includes('not exist') ||
      message.includes('does not exist') ||
      message.includes('不存在')
    ) {
      return []
    }

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

function publicProduct(item, urlMap) {
  const coverFileId = text(item.coverFileId)

  return {
    _id: item._id,
    type: text(item.type),
    name: text(item.name),
    subtitle: text(item.subtitle),
    priceFen: Math.max(0, Math.round(number(item.priceFen))),
    unit: text(item.unit, '件'),
    stock: Math.max(0, Math.round(number(item.stock))),
    featured: item.featured === true,
    onSale: item.onSale === true,
    sceneTags: array(item.sceneTags),
    colorTags: array(item.colorTags),
    coverFileId,
    imageUrl: urlMap[coverFileId] || '',
    sort: number(item.sort)
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
    actionValue: text(item.actionValue, 'flower'),
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
    meaning: text(item.meaning),
    description: text(item.description),
    careGuide: text(item.careGuide),
    sceneTags: array(item.sceneTags),
    imageFileId,
    imageUrl: urlMap[imageFileId] || '',
    sort: number(item.sort)
  }
}

exports.main = async () => {
  try {
    const [allProducts, allBanners, allAtlas] = await Promise.all([
      safeGetAll('products'),
      safeGetAll('banners'),
      safeGetAll('atlas')
    ])

    const products = allProducts
      .filter((item) => item.onSale === true && number(item.stock) > 0)
      .sort((a, b) => number(b.sort) - number(a.sort))

    const banners = allBanners
      .filter((item) => item.enabled === true)
      .sort((a, b) => number(b.sort) - number(a.sort))
      .slice(0, 6)

    const atlas = allAtlas
      .filter((item) => item.published === true)
      .sort((a, b) => number(b.sort) - number(a.sort))
      .slice(0, 12)

    const fileIds = [
      ...products.map((item) => item.coverFileId),
      ...banners.map((item) => item.imageFileId),
      ...atlas.map((item) => item.imageFileId)
    ]

    const urlMap = await createTempUrlMap(fileIds)

    return {
      ok: true,
      products: products.map((item) => publicProduct(item, urlMap)),
      banners: banners.map((item) => publicBanner(item, urlMap)),
      atlas: atlas.map((item) => publicAtlas(item, urlMap)),
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
      atlas: []
    }
  }
}
