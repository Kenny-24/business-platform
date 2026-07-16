const crypto = require('crypto')
const cloudbase = require('@cloudbase/node-sdk')
const { cloneHolidayCatalog } = require('./holiday-catalog')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const auth = app.auth()

const COLLECTIONS = {
  admins: 'admins',
  products: 'products',
  banners: 'banners',
  atlas: 'atlas',
  calendarEvents: 'calendarEvents'
}

const TYPE_LABELS = {
  flower: '鲜切花材',
  bouquet: '成品花束',
  succulent: '多肉植物',
  greenPlant: '绿植',
  vase: '花器',
  gift: '礼品'
}

class BusinessError extends Error {
  constructor(message, code = 'BUSINESS_ERROR') {
    super(message)
    this.code = code
  }
}

function success(data = null) {
  return { ok: true, data }
}

function failure(error) {
  console.error('[adminApi]', error)
  return {
    ok: false,
    code: error.code || 'INTERNAL_ERROR',
    message: error.message || '服务器暂时无法处理该操作'
  }
}

function text(value, fallback = '') {
  return String(value ?? fallback).trim()
}

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function integer(value, fallback = 0) {
  return Math.max(0, Math.round(number(value, fallback)))
}

function boolean(value) {
  return value === true
}

function stringArray(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => text(item)).filter(Boolean))]
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`
}

function isMissingCollectionError(error) {
  const message = String(error && (error.message || error))
  return (
    message.includes('not exist') ||
    message.includes('does not exist') ||
    message.includes('不存在')
  )
}

function firstDocument(result) {
  const data = result && result.data
  if (Array.isArray(data)) return data[0] || null
  if (plainObject(data)) return data
  return null
}

async function safeGetAll(collectionName, limit = 1000) {
  try {
    const result = await db.collection(collectionName).limit(limit).get()
    return Array.isArray(result.data) ? result.data : []
  } catch (error) {
    if (isMissingCollectionError(error)) return []
    throw error
  }
}

async function assertCollectionExists(collectionName) {
  try {
    await db.collection(collectionName).limit(1).get()
  } catch (error) {
    if (isMissingCollectionError(error)) {
      throw new BusinessError(
        `数据库集合 ${collectionName} 不存在，请先在云开发控制台创建该空集合`,
        'COLLECTION_NOT_FOUND'
      )
    }
    throw error
  }
}

function getCallerIdentity() {
  const identity = auth.getUserInfo()
  const uid = text(identity && identity.uid)

  if (!uid) {
    throw new BusinessError('登录状态已失效，请重新登录', 'UNAUTHORIZED')
  }

  return { ...identity, uid }
}

async function getAdminByUid(uid) {
  try {
    const result = await db.collection(COLLECTIONS.admins).doc(uid).get()
    return firstDocument(result)
  } catch (error) {
    if (isMissingCollectionError(error)) return null
    console.error('[adminApi] 查询管理员失败：', error)
    return null
  }
}

async function requireAdmin() {
  const identity = getCallerIdentity()
  const admin = await getAdminByUid(identity.uid)

  if (!admin || admin.enabled !== true) {
    throw new BusinessError('当前账号不是花予管理员', 'FORBIDDEN')
  }

  return { identity, admin }
}

async function bootstrapAdmin(event) {
  await assertCollectionExists(COLLECTIONS.admins)
  const identity = getCallerIdentity()
  const admins = await safeGetAll(COLLECTIONS.admins, 1)

  if (admins.length > 0) {
    throw new BusinessError('首位管理员已经创建，请直接登录', 'ALREADY_INITIALIZED')
  }

  const expectedCode = process.env.HUAYU_BOOTSTRAP_CODE || 'HUAYU-INIT-2026'
  if (text(event.bootstrapCode) !== expectedCode) {
    throw new BusinessError('首次初始化码不正确', 'INVALID_BOOTSTRAP_CODE')
  }

  let profile = null
  try {
    const result = await auth.getEndUserInfo()
    profile = result && result.userInfo
  } catch (error) {
    console.warn('[adminApi] 无法读取完整用户资料：', error.message)
  }

  const document = {
    uid: identity.uid,
    username: text(profile && profile.username) || identity.uid,
    name:
      text(event.displayName) ||
      text(profile && profile.nickName) ||
      '花予店主',
    role: 'owner',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  await db.collection(COLLECTIONS.admins).doc(identity.uid).set(document)
  return { _id: identity.uid, ...document }
}

async function resolveFileUrls(items, fields) {
  const fileIds = [
    ...new Set(
      items
        .flatMap((item) => fields.map((field) => text(item[field])))
        .filter((fileId) => fileId.startsWith('cloud://'))
    )
  ]
  const urlMap = {}
  if (!fileIds.length) return urlMap

  try {
    const result = await app.getTempFileURL({ fileList: fileIds })
    for (const file of result.fileList || []) {
      if (file.fileID && file.tempFileURL) {
        urlMap[file.fileID] = file.tempFileURL
      }
    }
  } catch (error) {
    console.error('[adminApi] 临时图片地址生成失败：', error)
  }

  return urlMap
}

function productView(item, urlMap) {
  return {
    ...item,
    typeLabel: TYPE_LABELS[item.type] || item.type || '其他',
    imageUrl: urlMap[text(item.coverFileId)] || ''
  }
}

function bannerView(item, urlMap) {
  return { ...item, imageUrl: urlMap[text(item.imageFileId)] || '' }
}

function atlasView(item, urlMap) {
  return { ...item, imageUrl: urlMap[text(item.imageFileId)] || '' }
}

async function listProducts(event) {
  const filters = event.filters || {}
  const items = await safeGetAll(COLLECTIONS.products)
  const urlMap = await resolveFileUrls(items, ['coverFileId'])
  const keyword = text(filters.keyword).toLowerCase()

  const filtered = items
    .filter((item) => {
      const searchable = [
        item.name,
        item.subtitle,
        ...stringArray(item.searchKeywords),
        ...stringArray(item.sceneTags),
        ...stringArray(item.colorTags)
      ]
        .map((value) => text(value))
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      if (keyword && !searchable.includes(keyword)) return false
      if (filters.type && item.type !== filters.type) return false
      if (filters.saleStatus === 'onSale' && item.onSale !== true) return false
      if (filters.saleStatus === 'offSale' && item.onSale === true) return false
      if (filters.saleStatus === 'soldOut' && number(item.stock) !== 0) return false
      return true
    })
    .sort((a, b) => {
      const sortDiff = number(b.sort) - number(a.sort)
      if (sortDiff) return sortDiff
      return text(a.name).localeCompare(text(b.name), 'zh-CN')
    })
    .map((item) => productView(item, urlMap))

  return { items: filtered, total: filtered.length }
}

async function getProduct(event) {
  const id = text(event.id)
  if (!id) throw new BusinessError('缺少商品 ID')
  const item = firstDocument(
    await db.collection(COLLECTIONS.products).doc(id).get()
  )
  if (!item) throw new BusinessError('商品不存在', 'NOT_FOUND')
  const urlMap = await resolveFileUrls([item], ['coverFileId'])
  return productView(item, urlMap)
}

function sanitizeProduct(input) {
  const type = text(input.type, 'flower')
  const name = text(input.name)

  if (!Object.prototype.hasOwnProperty.call(TYPE_LABELS, type)) {
    throw new BusinessError('商品类型不正确')
  }
  if (!name) throw new BusinessError('商品名称不能为空')

  return {
    type,
    name,
    subtitle: text(input.subtitle),
    priceFen: integer(input.priceFen),
    unit: text(input.unit, '件'),
    stock: integer(input.stock),
    onSale: boolean(input.onSale),
    featured: boolean(input.featured),
    sceneTags: stringArray(input.sceneTags),
    colorTags: stringArray(input.colorTags),
    searchKeywords: stringArray(input.searchKeywords),
    coverFileId: text(input.coverFileId),
    sort: integer(input.sort, 100)
  }
}

async function saveProduct(event, adminContext) {
  await assertCollectionExists(COLLECTIONS.products)
  const input = event.product || {}
  const data = sanitizeProduct(input)
  const id = text(input._id) || createId('product')
  let existing = null

  try {
    existing = firstDocument(
      await db.collection(COLLECTIONS.products).doc(id).get()
    )
  } catch (error) {}

  const document = {
    ...data,
    createdAt: existing && existing.createdAt || new Date(),
    updatedAt: new Date(),
    updatedBy: adminContext.identity.uid
  }

  await db.collection(COLLECTIONS.products).doc(id).set(document)
  return { _id: id, ...document }
}

async function deleteProduct(event) {
  await assertCollectionExists(COLLECTIONS.products)
  const id = text(event.id)
  if (!id) throw new BusinessError('缺少商品 ID')
  await db.collection(COLLECTIONS.products).doc(id).remove()
  return { _id: id }
}

async function updateStock(event, adminContext) {
  await assertCollectionExists(COLLECTIONS.products)
  const id = text(event.id)
  if (!id) throw new BusinessError('缺少商品 ID')
  const stock = integer(event.stock)
  await db.collection(COLLECTIONS.products).doc(id).update({
    stock,
    updatedAt: new Date(),
    updatedBy: adminContext.identity.uid
  })
  return { _id: id, stock }
}

async function toggleProduct(event, adminContext) {
  await assertCollectionExists(COLLECTIONS.products)
  const id = text(event.id)
  const field = text(event.field)
  if (!['onSale', 'featured'].includes(field)) {
    throw new BusinessError('不允许修改该状态字段')
  }
  await db.collection(COLLECTIONS.products).doc(id).update({
    [field]: boolean(event.value),
    updatedAt: new Date(),
    updatedBy: adminContext.identity.uid
  })
  return { _id: id, field, value: boolean(event.value) }
}

function sanitizeBanner(input) {
  const title = text(input.title)
  if (!title) throw new BusinessError('轮播主标题不能为空')
  return {
    scene: text(input.scene),
    title,
    subtitle: text(input.subtitle),
    buttonText: text(input.buttonText, '立即查看'),
    imageFileId: text(input.imageFileId),
    actionType: text(input.actionType, 'category'),
    actionValue: text(input.actionValue, 'flower'),
    placement: text(input.placement) === 'categoryHero' ? 'categoryHero' : 'home',
    enabled: boolean(input.enabled),
    sort: integer(input.sort, 100)
  }
}

async function listBanners() {
  const items = await safeGetAll(COLLECTIONS.banners)
  const urlMap = await resolveFileUrls(items, ['imageFileId'])
  return {
    items: items
      .sort((a, b) => number(b.sort) - number(a.sort))
      .map((item) => bannerView(item, urlMap))
  }
}

async function saveBanner(event, adminContext) {
  await assertCollectionExists(COLLECTIONS.banners)
  const input = event.banner || {}
  const data = sanitizeBanner(input)
  const id = text(input._id) || createId('banner')
  let existing = null
  try {
    existing = firstDocument(await db.collection(COLLECTIONS.banners).doc(id).get())
  } catch (error) {}
  const document = {
    ...data,
    createdAt: existing && existing.createdAt || new Date(),
    updatedAt: new Date(),
    updatedBy: adminContext.identity.uid
  }
  await db.collection(COLLECTIONS.banners).doc(id).set(document)
  return { _id: id, ...document }
}

async function deleteBanner(event) {
  await assertCollectionExists(COLLECTIONS.banners)
  const id = text(event.id)
  if (!id) throw new BusinessError('缺少轮播 ID')
  await db.collection(COLLECTIONS.banners).doc(id).remove()
  return { _id: id }
}

function sanitizeAtlas(input) {
  const name = text(input.name)
  if (!name) throw new BusinessError('花材名称不能为空')
  return {
    name,
    latinName: text(input.latinName),
    meaning: text(input.meaning),
    description: text(input.description),
    careGuide: text(input.careGuide),
    sceneTags: stringArray(input.sceneTags),
    imageFileId: text(input.imageFileId),
    published: boolean(input.published),
    sort: integer(input.sort, 100)
  }
}

async function listAtlas() {
  const items = await safeGetAll(COLLECTIONS.atlas)
  const urlMap = await resolveFileUrls(items, ['imageFileId'])
  return {
    items: items
      .sort((a, b) => number(b.sort) - number(a.sort))
      .map((item) => atlasView(item, urlMap))
  }
}

async function saveAtlas(event, adminContext) {
  await assertCollectionExists(COLLECTIONS.atlas)
  const input = event.item || {}
  const data = sanitizeAtlas(input)
  const id = text(input._id) || createId('atlas')
  let existing = null
  try {
    existing = firstDocument(await db.collection(COLLECTIONS.atlas).doc(id).get())
  } catch (error) {}
  const document = {
    ...data,
    createdAt: existing && existing.createdAt || new Date(),
    updatedAt: new Date(),
    updatedBy: adminContext.identity.uid
  }
  await db.collection(COLLECTIONS.atlas).doc(id).set(document)
  return { _id: id, ...document }
}

async function deleteAtlas(event) {
  await assertCollectionExists(COLLECTIONS.atlas)
  const id = text(event.id)
  if (!id) throw new BusinessError('缺少图鉴 ID')
  await db.collection(COLLECTIONS.atlas).doc(id).remove()
  return { _id: id }
}

function mergeCalendarEvents(overrides) {
  const catalog = cloneHolidayCatalog()
  const overrideMap = new Map(
    overrides
      .filter((item) => text(item.eventKey))
      .map((item) => [text(item.eventKey), item])
  )
  const builtInKeys = new Set(catalog.map((item) => item.eventKey))

  const builtIns = catalog.map((item) => {
    const override = overrideMap.get(item.eventKey) || {}
    return {
      ...item,
      ...override,
      _id: override._id || item.eventKey,
      eventKey: item.eventKey,
      builtIn: true,
      isOverridden: Boolean(override._id),
      rule: { ...item.rule, ...(plainObject(override.rule) || {}) },
      searchKeywords: Array.isArray(override.searchKeywords)
        ? override.searchKeywords
        : item.searchKeywords,
      productIds: stringArray(override.productIds),
      enabled: override.enabled !== false,
      recommendationEnabled: override.recommendationEnabled === undefined
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
      builtIn: false,
      isOverridden: true,
      eventKey: text(item.eventKey),
      rule: plainObject(item.rule),
      searchKeywords: stringArray(item.searchKeywords),
      productIds: stringArray(item.productIds),
      enabled: item.enabled !== false,
      recommendationEnabled: item.recommendationEnabled !== false
    }))

  return [...builtIns, ...custom].sort((a, b) => {
    const regionDiff = text(a.region).localeCompare(text(b.region))
    if (regionDiff) return regionDiff
    return number(b.sort) - number(a.sort)
  })
}

async function listCalendarEvents() {
  const overrides = await safeGetAll(COLLECTIONS.calendarEvents)
  return {
    items: mergeCalendarEvents(overrides),
    collectionReady: await collectionExists(COLLECTIONS.calendarEvents)
  }
}

async function collectionExists(collectionName) {
  try {
    await db.collection(collectionName).limit(1).get()
    return true
  } catch (error) {
    if (isMissingCollectionError(error)) return false
    throw error
  }
}

function findBuiltIn(eventKey) {
  return cloneHolidayCatalog().find((item) => item.eventKey === eventKey) || null
}

function sanitizeCalendarEvent(input) {
  const eventKey = text(input.eventKey) || createId('calendar')
  const builtIn = findBuiltIn(eventKey)
  const name = text(input.name) || (builtIn && builtIn.name)
  if (!name) throw new BusinessError('节日名称不能为空')

  let rule = builtIn ? builtIn.rule : plainObject(input.rule)
  if (!rule) {
    rule = {
      type: 'fixed',
      month: Math.min(12, Math.max(1, integer(input.month, 1))),
      day: Math.min(31, Math.max(1, integer(input.day, 1)))
    }
  }

  if (!builtIn && rule.type !== 'fixed') {
    throw new BusinessError('自定义节日当前仅支持固定公历日期')
  }

  const region = ['domestic', 'international'].includes(text(input.region))
    ? text(input.region)
    : (builtIn && builtIn.region) || 'domestic'

  return {
    eventKey,
    name,
    region,
    rule,
    title: text(input.title) || name,
    description: text(input.description),
    categoryIntent: text(input.categoryIntent, '成品花束'),
    searchKeywords: stringArray(input.searchKeywords),
    productIds: stringArray(input.productIds),
    recommendationEnabled: input.recommendationEnabled !== false,
    enabled: input.enabled !== false,
    sort: integer(input.sort, builtIn && builtIn.sort || 100)
  }
}

async function saveCalendarEvent(event, adminContext) {
  await assertCollectionExists(COLLECTIONS.calendarEvents)
  const input = event.item || {}
  const data = sanitizeCalendarEvent(input)
  const id = data.eventKey
  let existing = null
  try {
    existing = firstDocument(
      await db.collection(COLLECTIONS.calendarEvents).doc(id).get()
    )
  } catch (error) {}

  const document = {
    ...data,
    createdAt: existing && existing.createdAt || new Date(),
    updatedAt: new Date(),
    updatedBy: adminContext.identity.uid
  }
  await db.collection(COLLECTIONS.calendarEvents).doc(id).set(document)
  return { _id: id, ...document }
}

async function deleteCalendarEvent(event) {
  await assertCollectionExists(COLLECTIONS.calendarEvents)
  const eventKey = text(event.eventKey || event.id)
  if (!eventKey) throw new BusinessError('缺少节日标识')
  await db.collection(COLLECTIONS.calendarEvents).doc(eventKey).remove()
  return {
    eventKey,
    resetToBuiltIn: Boolean(findBuiltIn(eventKey))
  }
}

async function dashboard() {
  const [products, banners, atlas, calendarOverrides] = await Promise.all([
    safeGetAll(COLLECTIONS.products),
    safeGetAll(COLLECTIONS.banners),
    safeGetAll(COLLECTIONS.atlas),
    safeGetAll(COLLECTIONS.calendarEvents)
  ])

  const lowStockProducts = products
    .filter((item) => number(item.stock) <= 5)
    .sort((a, b) => number(a.stock) - number(b.stock))
    .slice(0, 8)
    .map((item) => ({
      _id: item._id,
      name: item.name,
      stock: integer(item.stock),
      unit: text(item.unit, '件'),
      typeLabel: TYPE_LABELS[item.type] || item.type || '其他'
    }))

  return {
    productCount: products.length,
    onSaleProducts: products.filter((item) => item.onSale === true).length,
    soldOutProducts: products.filter((item) => number(item.stock) === 0).length,
    lowStockCount: products.filter((item) => number(item.stock) <= 5).length,
    featuredProducts: products.filter((item) => item.featured === true).length,
    enabledBanners: banners.filter((item) => item.enabled === true).length,
    atlasCount: atlas.length,
    calendarEventCount: mergeCalendarEvents(calendarOverrides)
      .filter((item) => item.enabled !== false).length,
    lowStockProducts
  }
}

exports.main = async (event = {}) => {
  try {
    const action = text(event.action)
    if (!action) throw new BusinessError('缺少 action')

    if (action === 'bootstrapAdmin') {
      return success(await bootstrapAdmin(event))
    }

    const adminContext = await requireAdmin()

    switch (action) {
      case 'me': return success(adminContext.admin)
      case 'dashboard': return success(await dashboard())
      case 'listProducts': return success(await listProducts(event))
      case 'getProduct': return success(await getProduct(event))
      case 'saveProduct': return success(await saveProduct(event, adminContext))
      case 'deleteProduct': return success(await deleteProduct(event))
      case 'updateStock': return success(await updateStock(event, adminContext))
      case 'toggleProduct': return success(await toggleProduct(event, adminContext))
      case 'listBanners': return success(await listBanners())
      case 'saveBanner': return success(await saveBanner(event, adminContext))
      case 'deleteBanner': return success(await deleteBanner(event))
      case 'listAtlas': return success(await listAtlas())
      case 'saveAtlas': return success(await saveAtlas(event, adminContext))
      case 'deleteAtlas': return success(await deleteAtlas(event))
      case 'listCalendarEvents': return success(await listCalendarEvents())
      case 'saveCalendarEvent': return success(await saveCalendarEvent(event, adminContext))
      case 'deleteCalendarEvent': return success(await deleteCalendarEvent(event))
      default:
        throw new BusinessError(`未知操作：${action}`, 'UNKNOWN_ACTION')
    }
  } catch (error) {
    return failure(error)
  }
}
