const crypto = require('crypto')
const cloudbase = require('@cloudbase/node-sdk')
const { cloneHolidayCatalog } = require('./holiday-catalog')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command
const auth = app.auth()

const COLLECTIONS = {
  admins: 'admins',
  products: 'products',
  banners: 'banners',
  atlas: 'atlas',
  calendarEvents: 'calendarEvents',
  users: 'users',
  addresses: 'addresses',
  orders: 'orders',
  orderLogs: 'orderLogs',
  quoteRequests: 'quoteRequests'
}

const TYPE_LABELS = {
  flower: '鲜切花材',
  bouquet: '成品花束',
  succulent: '多肉植物',
  greenPlant: '绿植',
  vase: '花器',
  gift: '礼品'
}

const ORDER_STATUS_META = {
  pendingConfirm: { label: '待确认', tone: 'warning' },
  pendingPayment: { label: '待付款', tone: 'warning' },
  making: { label: '制作中', tone: 'primary' },
  delivering: { label: '配送中', tone: 'primary' },
  completed: { label: '已完成', tone: 'success' },
  cancelled: { label: '已取消', tone: 'info' },
  refundPending: { label: '退款中', tone: 'danger' },
  refunded: { label: '已退款', tone: 'info' }
}

const DELIVERY_SLOTS = new Set([
  '09:00-12:00',
  '12:00-15:00',
  '15:00-18:00',
  '18:00-20:00'
])

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

function defaultBusinessCode(prefix, id) {
  const suffix = text(id)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-12)
    .toUpperCase()
  return `${prefix}-${suffix || crypto.randomBytes(4).toString('hex').toUpperCase()}`
}

async function assertUniqueCode(collectionName, field, value, currentId = '') {
  const normalized = text(value).toLowerCase()
  if (!normalized) return
  const items = await safeGetAll(collectionName)
  const duplicate = items.find((item) => (
    text(item[field]).toLowerCase() === normalized &&
    text(item._id) !== text(currentId)
  ))
  if (duplicate) {
    throw new BusinessError(`${field} 已被其他记录使用，请更换编码`, 'DUPLICATE_BUSINESS_CODE')
  }
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

function dateValue(value) {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'object' && value.$date) {
    return new Date(value.$date).getTime()
  }
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function isoDate(value) {
  const timestamp = dateValue(value)
  return timestamp ? new Date(timestamp).toISOString() : ''
}


function calendarDate(value) {
  const normalized = text(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return ''
  const parsed = new Date(`${normalized}T00:00:00+08:00`)
  return Number.isFinite(parsed.getTime()) ? normalized : ''
}

function formatFen(value) {
  const yuan = integer(value) / 100
  if (Number.isInteger(yuan)) return String(yuan)
  return yuan.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function maskPhone(phone) {
  const value = text(phone)
  if (value.length !== 11) return value
  return `${value.slice(0, 3)}****${value.slice(-4)}`
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
    throw new BusinessError('当前账号不是Chloris 管理员', 'FORBIDDEN')
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
      'Chloris 店主',
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
        .flatMap((item) => fields.flatMap((field) => {
          const value = item[field]
          return Array.isArray(value)
            ? value.map((entry) => text(entry))
            : [text(value)]
        }))
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
  const galleryFileIds = stringArray(item.galleryFileIds)
  const coverFileId = text(item.coverFileId)
  const videoFileId = text(item.videoFileId)
  const videoPosterFileId = text(item.videoPosterFileId)

  return {
    ...item,
    galleryFileIds,
    typeLabel: TYPE_LABELS[item.type] || item.type || '其他',
    imageUrl: urlMap[coverFileId] || '',
    galleryUrls: galleryFileIds
      .map((fileId) => urlMap[fileId] || '')
      .filter(Boolean),
    videoUrl: urlMap[videoFileId] || '',
    videoPosterUrl: urlMap[videoPosterFileId] || ''
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
        item.sku,
        item.name,
        item.category,
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
  const urlMap = await resolveFileUrls([item], [
    'coverFileId',
    'galleryFileIds',
    'videoFileId',
    'videoPosterFileId'
  ])
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
    sku: text(input.sku).toUpperCase(),
    type,
    category: text(input.category),
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
    atlasCodes: stringArray(input.atlasCodes),
    atlasIds: stringArray(input.atlasIds),
    coverFileId: text(input.coverFileId),
    galleryFileIds: stringArray(input.galleryFileIds).slice(0, 8),
    videoFileId: text(input.videoFileId),
    videoPosterFileId: text(input.videoPosterFileId),
    detailDescription: text(input.detailDescription).slice(0, 2000),
    flowerMaterialInfo: text(input.flowerMaterialInfo).slice(0, 1000),
    sizeDescription: text(input.sizeDescription).slice(0, 500),
    deliveryDescription: text(input.deliveryDescription).slice(0, 1000),
    careDescription: text(input.careDescription).slice(0, 1000),
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

  data.sku = data.sku || text(existing && existing.sku) || defaultBusinessCode('SKU', id)
  await assertUniqueCode(COLLECTIONS.products, 'sku', data.sku, id)

  if (data.atlasIds.length) {
    const atlasItems = await safeGetAll(COLLECTIONS.atlas)
    const codeMap = new Map(
      atlasItems.map((item) => [text(item._id), text(item.atlasCode)]).filter((item) => item[0] && item[1])
    )
    data.atlasCodes = data.atlasIds.map((atlasId) => codeMap.get(text(atlasId))).filter(Boolean)
  } else {
    data.atlasCodes = []
  }

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
    bannerCode: text(input.bannerCode).toUpperCase(),
    scene: text(input.scene),
    title,
    subtitle: text(input.subtitle),
    buttonText: text(input.buttonText, '立即查看'),
    imageFileId: text(input.imageFileId),
    actionType: text(input.actionType, 'category'),
    actionValue: text(input.actionValue, '推荐花束'),
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
  data.bannerCode = data.bannerCode || text(existing && existing.bannerCode) || defaultBusinessCode('BNR', id)
  await assertUniqueCode(COLLECTIONS.banners, 'bannerCode', data.bannerCode, id)
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
    atlasCode: text(input.atlasCode).toUpperCase(),
    name,
    latinName: text(input.latinName),
    alias: text(input.alias),
    meaning: text(input.meaning),
    description: text(input.description),
    careGuide: text(input.careGuide),
    floweringPeriod: text(input.floweringPeriod),
    toxicityNote: text(input.toxicityNote),
    imageBackground: ['dark', 'light', 'soft'].includes(
      text(input.imageBackground)
    )
      ? text(input.imageBackground)
      : 'soft',
    category: text(input.category, '鲜切花'),
    sceneTags: stringArray(input.sceneTags),
    colorTags: stringArray(input.colorTags),
    seasonTags: stringArray(input.seasonTags),
    imageFileId: text(input.imageFileId),
    homeFeatured: boolean(input.homeFeatured),
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
  data.atlasCode = data.atlasCode || text(existing && existing.atlasCode) || defaultBusinessCode('ATL', id)
  await assertUniqueCode(COLLECTIONS.atlas, 'atlasCode', data.atlasCode, id)
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
  if (!name) throw new BusinessError('节日或活动名称不能为空')

  const requestedRegion = text(input.region)
  const region = ['domestic', 'international', 'merchant'].includes(requestedRegion)
    ? requestedRegion
    : (builtIn && builtIn.region) || 'domestic'

  let rule = builtIn ? builtIn.rule : plainObject(input.rule)

  if (!builtIn && region === 'merchant') {
    const startDate = calendarDate(
      input.startDate || (rule && (rule.startDate || rule.date))
    )
    const endDate = calendarDate(
      input.endDate || (rule && rule.endDate) || startDate
    )

    if (!startDate) throw new BusinessError('请选择活动开始日期')
    if (!endDate) throw new BusinessError('请选择活动结束日期')
    if (endDate < startDate) throw new BusinessError('活动结束日期不能早于开始日期')

    rule = startDate === endDate
      ? { type: 'date', date: startDate }
      : { type: 'dateRange', startDate, endDate }
  } else {
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
  }

  return {
    eventKey,
    name,
    region,
    rule,
    title: text(input.title) || name,
    description: text(input.description),
    activityTimeText: region === 'merchant' ? text(input.activityTimeText) : '',
    categoryIntent: text(input.categoryIntent, '推荐花束'),
    searchKeywords: stringArray(input.searchKeywords),
    productSkus: stringArray(input.productSkus),
    productIds: stringArray(input.productIds),
    recommendationEnabled: input.recommendationEnabled !== false,
    enabled: input.enabled !== false,
    sort: integer(input.sort, builtIn && builtIn.sort || (region === 'merchant' ? 3000 : 100))
  }
}

async function saveCalendarEvent(event, adminContext) {
  await assertCollectionExists(COLLECTIONS.calendarEvents)
  const input = event.item || {}
  const data = sanitizeCalendarEvent(input)
  const id = data.eventKey
  if (data.productIds.length) {
    const productItems = await safeGetAll(COLLECTIONS.products)
    const skuMap = new Map(
      productItems.map((item) => [text(item._id), text(item.sku)]).filter((item) => item[0] && item[1])
    )
    data.productSkus = data.productIds.map((productId) => skuMap.get(text(productId))).filter(Boolean)
  } else {
    data.productSkus = []
  }
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


function orderStatusMeta(status) {
  return ORDER_STATUS_META[text(status)] || {
    label: text(status) || '未知状态',
    tone: 'info'
  }
}

function isDeliveryDateValue(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(text(value))
}

function isDeliverySlotValue(value) {
  return DELIVERY_SLOTS.has(text(value))
}

function normalizeAdminDeliveryScheduleStatus(order = {}) {
  const isQuoteOrder = text(order.sourceType) === 'quoteRequest'

  const confirmedReady = isDeliveryDateValue(order.confirmedDeliveryDate)
    && isDeliverySlotValue(order.confirmedDeliverySlot)
  const proposedReady = isDeliveryDateValue(order.proposedDeliveryDate)
    && isDeliverySlotValue(order.proposedDeliverySlot)
  const requestedDate = isDeliveryDateValue(order.requestedDeliveryDate)
    ? text(order.requestedDeliveryDate)
    : (isDeliveryDateValue(order.deliveryDate) ? text(order.deliveryDate) : '')
  const requestedSlot = isDeliverySlotValue(order.requestedDeliverySlot)
    ? text(order.requestedDeliverySlot)
    : (isDeliverySlotValue(order.deliverySlot) ? text(order.deliverySlot) : '')
  const requestedReady = Boolean(requestedDate && requestedSlot)
  const scheduleRequired = isQuoteOrder || requestedReady || confirmedReady || proposedReady
  const direct = text(order.deliveryScheduleStatus)

  if (!scheduleRequired) return 'notRequired'
  if (order.deliveryConfirmed === true && confirmedReady) return 'confirmed'
  if (confirmedReady) return 'confirmed'
  if (proposedReady && direct === 'adjustmentRejected') return 'adjustmentRejected'
  if (proposedReady) return 'customerConfirmationRequired'
  if (!requestedReady) return 'missingSchedule'
  if (direct === 'adjustmentRejected') return 'adjustmentRejected'
  if (direct === 'confirmed') return 'pendingMerchantConfirm'
  return direct || 'pendingMerchantConfirm'
}

function adminDeliveryScheduleMeta(status) {
  const map = {
    notRequired: { label: '无需二次确认', tone: 'info', description: '该订单不需要额外确认配送时间。' },
    missingSchedule: { label: '待补充配送时间', tone: 'warning', description: '该订单尚未填写有效的配送日期和时段，请由商家补充并确认。' },
    pendingMerchantConfirm: { label: '待商家确认', tone: 'warning', description: '顾客已填写期望配送时间，等待商家确认。' },
    customerConfirmationRequired: { label: '待顾客确认调整', tone: 'primary', description: '商家已提出新的配送时间，等待顾客确认。' },
    confirmed: { label: '时间已确认', tone: 'success', description: '最终配送日期和时段已经确认。' },
    adjustmentRejected: { label: '顾客未接受调整', tone: 'danger', description: '顾客未接受上次调整，请重新沟通配送时间。' }
  }
  return map[status] || { label: '待确认', tone: 'warning', description: '配送时间状态等待处理。' }
}

function validateDeliveryScheduleDate(value) {
  const date = text(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BusinessError('请选择正确的配送日期')
  }

  const selected = new Date(`${date}T00:00:00+08:00`)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (Number.isNaN(selected.getTime()) || selected < today) {
    throw new BusinessError('配送日期不能早于今天')
  }
  return date
}

function validateDeliveryScheduleSlot(value) {
  const slot = text(value)
  if (!DELIVERY_SLOTS.has(slot)) {
    throw new BusinessError('请选择正确的配送时段')
  }
  return slot
}

function orderView(item, urlMap = {}) {
  const status = text(item.status, 'pendingConfirm')
  const meta = orderStatusMeta(status)
  const items = (Array.isArray(item.items) ? item.items : []).map((row) => ({
    ...row,
    imageUrl: urlMap[text(row.coverFileId)] || '',
    unitPriceText: formatFen(row.unitPriceFen),
    subtotalText: formatFen(row.subtotalFen)
  }))
  const deliveryScheduleStatus = normalizeAdminDeliveryScheduleStatus(item)
  const deliveryScheduleMeta = adminDeliveryScheduleMeta(deliveryScheduleStatus)
  const requestedDeliveryDate = isDeliveryDateValue(item.requestedDeliveryDate)
    ? text(item.requestedDeliveryDate)
    : (isDeliveryDateValue(item.deliveryDate) ? text(item.deliveryDate) : '')
  const requestedDeliverySlot = isDeliverySlotValue(item.requestedDeliverySlot)
    ? text(item.requestedDeliverySlot)
    : (isDeliverySlotValue(item.deliverySlot) ? text(item.deliverySlot) : '')

  return {
    ...item,
    _id: text(item._id),
    orderNo: text(item.orderNo),
    status,
    statusLabel: meta.label,
    statusTone: meta.tone,
    paymentStatus: text(item.paymentStatus, 'unpaid'),
    customerNickname: text(item.customerNickname, 'Chloris 用户'),
    requestedDeliveryDate,
    requestedDeliverySlot,
    requestedDeliveryNote: text(item.requestedDeliveryNote),
    confirmedDeliveryDate: text(item.confirmedDeliveryDate),
    confirmedDeliverySlot: text(item.confirmedDeliverySlot),
    proposedDeliveryDate: text(item.proposedDeliveryDate),
    proposedDeliverySlot: text(item.proposedDeliverySlot),
    deliveryAdjustmentNote: text(item.deliveryAdjustmentNote),
    deliveryScheduleStatus,
    deliveryScheduleStatusLabel: deliveryScheduleMeta.label,
    deliveryScheduleStatusTone: deliveryScheduleMeta.tone,
    deliveryScheduleStatusDescription: deliveryScheduleMeta.description,
    deliveryConfirmed: item.deliveryConfirmed === true || deliveryScheduleStatus === 'confirmed',
    logisticsCompanyCode: text(item.logisticsCompanyCode),
    logisticsCompanyName: text(item.logisticsCompanyName),
    trackingNo: text(item.trackingNo),
    logisticsState: text(item.logisticsState),
    logisticsStateLabel: text(item.logisticsStateLabel),
    logisticsUpdatedAt: isoDate(item.logisticsUpdatedAt),
    canManageDeliverySchedule: !['completed', 'cancelled', 'refunded'].includes(status),
    address: item.address
      ? {
          ...item.address,
          phoneMasked: maskPhone(item.address.phone)
        }
      : null,
    items,
    itemCount: items.reduce((sum, row) => sum + integer(row.quantity), 0),
    goodsAmountText: formatFen(item.goodsAmountFen),
    packagingFeeText: formatFen(item.packagingFeeFen),
    deliveryFeeText: item.deliveryFeePending === true
      ? '待确认'
      : formatFen(item.deliveryFeeFen),
    discountText: formatFen(item.discountFen),
    pointsDeductionText: formatFen(item.pointsDeductionFen),
    totalAmountText: formatFen(item.totalAmountFen),
    createdAtText: isoDate(item.createdAt),
    updatedAtText: isoDate(item.updatedAt),
    confirmedAtText: isoDate(item.confirmedAt),
    paidAtText: isoDate(item.paidAt),
    makingAtText: isoDate(item.makingAt),
    deliveringAtText: isoDate(item.deliveringAt),
    completedAtText: isoDate(item.completedAt),
    cancelledAtText: isoDate(item.cancelledAt)
  }
}

async function listOrders(event) {
  const filters = event.filters || {}
  const items = await safeGetAll(COLLECTIONS.orders)
  const keyword = text(filters.keyword).toLowerCase()
  const status = text(filters.status)
  const deliveryMethodId = text(filters.deliveryMethodId)

  const filtered = items
    .filter((item) => {
      if (status && status !== 'all' && item.status !== status) return false
      if (deliveryMethodId && item.deliveryMethodId !== deliveryMethodId) return false

      if (keyword) {
        const searchable = [
          item.orderNo,
          item.customerNickname,
          item.address && item.address.receiverName,
          item.address && item.address.phone,
          ...(Array.isArray(item.items) ? item.items.map((row) => row.name) : [])
        ]
          .map((value) => text(value).toLowerCase())
          .filter(Boolean)
          .join(' ')

        if (!searchable.includes(keyword)) return false
      }

      return true
    })
    .sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))

  const urlMap = await resolveFileUrls(
    filtered.flatMap((order) => Array.isArray(order.items) ? order.items : []),
    ['coverFileId']
  )

  const counts = {
    all: items.length,
    pendingConfirm: 0,
    pendingPayment: 0,
    making: 0,
    delivering: 0,
    completed: 0,
    cancelled: 0,
    refundPending: 0,
    refunded: 0
  }

  for (const item of items) {
    if (Object.prototype.hasOwnProperty.call(counts, item.status)) {
      counts[item.status] += 1
    }
  }

  return {
    items: filtered.map((item) => orderView(item, urlMap)),
    total: filtered.length,
    counts,
    collectionReady: await collectionExists(COLLECTIONS.orders)
  }
}

async function getOrder(event) {
  const id = text(event.id)
  if (!id) throw new BusinessError('缺少订单 ID')

  const item = firstDocument(
    await db.collection(COLLECTIONS.orders).doc(id).get()
  )

  if (!item) throw new BusinessError('订单不存在', 'NOT_FOUND')

  const logs = (await safeGetAll(COLLECTIONS.orderLogs))
    .filter((log) => log.orderId === id)
    .sort((a, b) => dateValue(a.createdAt) - dateValue(b.createdAt))
    .map((log) => ({
      ...log,
      createdAtText: isoDate(log.createdAt)
    }))

  const urlMap = await resolveFileUrls(
    item.items || [],
    ['coverFileId']
  )

  return {
    ...orderView(item, urlMap),
    logs
  }
}

async function appendOrderLog({
  orderId,
  orderNo,
  status,
  title,
  note,
  adminContext
}) {
  await assertCollectionExists(COLLECTIONS.orderLogs)

  const id = createId('orderlog')
  const document = {
    orderId,
    orderNo,
    status,
    title,
    note: text(note),
    operatorType: 'admin',
    operatorId: adminContext.identity.uid,
    operatorName: text(adminContext.admin.name, '管理员'),
    createdAt: new Date()
  }

  await db.collection(COLLECTIONS.orderLogs).doc(id).set(document)
  return { _id: id, ...document }
}

async function requireOrder(id) {
  await assertCollectionExists(COLLECTIONS.orders)
  const item = firstDocument(
    await db.collection(COLLECTIONS.orders).doc(id).get()
  )
  if (!item) throw new BusinessError('订单不存在', 'NOT_FOUND')
  return item
}

function assertOrderStatus(order, allowed) {
  if (!allowed.includes(order.status)) {
    throw new BusinessError(
      `当前订单状态“${orderStatusMeta(order.status).label}”不能执行该操作`,
      'INVALID_ORDER_STATUS'
    )
  }
}

async function confirmOrder(event, adminContext) {
  const id = text(event.id)
  const order = await requireOrder(id)
  assertOrderStatus(order, ['pendingConfirm'])

  const deliveryFeeFen = order.deliveryMethodId === 'pickup'
    ? 0
    : integer(event.deliveryFeeFen)
  const totalAmountFen = Math.max(
    0,
    integer(order.goodsAmountFen) +
      integer(order.packagingFeeFen) +
      deliveryFeeFen -
      integer(order.discountFen) -
      integer(order.pointsDeductionFen)
  )
  const merchantNote = text(event.merchantNote)
  const deliveryScheduleStatus = normalizeAdminDeliveryScheduleStatus(order)
  const requestedDeliveryDate = isDeliveryDateValue(order.requestedDeliveryDate)
    ? text(order.requestedDeliveryDate)
    : (isDeliveryDateValue(order.deliveryDate) ? text(order.deliveryDate) : '')
  const requestedDeliverySlot = isDeliverySlotValue(order.requestedDeliverySlot)
    ? text(order.requestedDeliverySlot)
    : (isDeliverySlotValue(order.deliverySlot) ? text(order.deliverySlot) : '')

  if (deliveryScheduleStatus === 'customerConfirmationRequired') {
    throw new BusinessError('已提出配送时间调整，请等待顾客确认')
  }
  if (deliveryScheduleStatus === 'adjustmentRejected') {
    throw new BusinessError('顾客未接受配送时间调整，请重新沟通')
  }
  if (deliveryScheduleStatus === 'missingSchedule') {
    throw new BusinessError('请先补充并确认配送日期与时段')
  }

  const scheduleUpdate = deliveryScheduleStatus === 'pendingMerchantConfirm'
    ? {
        deliveryScheduleStatus: 'confirmed',
        deliveryScheduleStatusLabel: '时间已确认',
        deliveryConfirmed: true,
        confirmedDeliveryDate: requestedDeliveryDate,
        confirmedDeliverySlot: requestedDeliverySlot,
        deliveryDate: requestedDeliveryDate,
        deliverySlot: requestedDeliverySlot,
        deliveryConfirmedAt: new Date()
      }
    : {}

  await db.collection(COLLECTIONS.orders).doc(id).update({
    status: 'pendingPayment',
    statusLabel: ORDER_STATUS_META.pendingPayment.label,
    deliveryFeeFen,
    deliveryFeePending: false,
    amountPending: false,
    totalAmountFen,
    merchantNote,
    ...scheduleUpdate,
    confirmedAt: new Date(),
    updatedAt: new Date(),
    updatedBy: adminContext.identity.uid
  })

  await appendOrderLog({
    orderId: id,
    orderNo: order.orderNo,
    status: 'pendingPayment',
    title: '商家已确认订单',
    note: merchantNote || '库存与配送安排已确认，等待顾客付款',
    adminContext
  })

  return { _id: id, status: 'pendingPayment', totalAmountFen }
}

async function updateDeliverySchedule(event, adminContext) {
  const id = text(event.id)
  const mode = text(event.mode)
  if (!id) throw new BusinessError('缺少订单 ID')
  if (!['confirmRequested', 'propose'].includes(mode)) {
    throw new BusinessError('无效的配送时间操作')
  }

  const order = await requireOrder(id)
  if (['completed', 'cancelled', 'refunded'].includes(text(order.status))) {
    throw new BusinessError('当前订单状态不能修改配送时间')
  }
  if (text(order.status) === 'delivering' && mode === 'propose') {
    throw new BusinessError('配送中的订单只能直接确认最终配送时间')
  }

  const requestedDate = text(order.requestedDeliveryDate) || text(order.deliveryDate)
  const requestedSlot = text(order.requestedDeliverySlot) || text(order.deliverySlot)
  const deliveryDate = validateDeliveryScheduleDate(
    event.deliveryDate || (mode === 'confirmRequested' ? requestedDate : '')
  )
  const deliverySlot = validateDeliveryScheduleSlot(
    event.deliverySlot || (mode === 'confirmRequested' ? requestedSlot : '')
  )
  const note = text(event.note).slice(0, 300)
  const deliveryFeeFen = integer(event.deliveryFeeFen)
  const totalAmountFen = Math.max(
    0,
    integer(order.goodsAmountFen) +
      integer(order.packagingFeeFen) +
      deliveryFeeFen -
      integer(order.discountFen) -
      integer(order.pointsDeductionFen)
  )

  const common = {
    deliveryFeeFen,
    deliveryFeePending: false,
    amountPending: false,
    totalAmountFen,
    deliveryAdjustmentNote: note,
    updatedAt: new Date(),
    updatedBy: adminContext.identity.uid
  }

  if (mode === 'confirmRequested') {
    await db.collection(COLLECTIONS.orders).doc(id).update({
      ...common,
      deliveryScheduleStatus: 'confirmed',
      deliveryScheduleStatusLabel: '时间已确认',
      deliveryConfirmed: true,
      confirmedDeliveryDate: deliveryDate,
      confirmedDeliverySlot: deliverySlot,
      deliveryDate,
      deliverySlot,
      proposedDeliveryDate: '',
      proposedDeliverySlot: '',
      customerDeliveryDecision: '',
      deliveryConfirmedAt: new Date()
    })

    await appendOrderLog({
      orderId: id,
      orderNo: order.orderNo,
      status: text(order.status),
      title: '商家已确认配送时间',
      note: `${deliveryDate} ${deliverySlot}${note ? `；${note}` : ''}`,
      adminContext
    })

    return {
      _id: id,
      deliveryScheduleStatus: 'confirmed',
      deliveryDate,
      deliverySlot,
      totalAmountFen
    }
  }

  await db.collection(COLLECTIONS.orders).doc(id).update({
    ...common,
    deliveryScheduleStatus: 'customerConfirmationRequired',
    deliveryScheduleStatusLabel: '待顾客确认调整',
    deliveryConfirmed: false,
    proposedDeliveryDate: deliveryDate,
    proposedDeliverySlot: deliverySlot,
    customerDeliveryDecision: '',
    proposedAt: new Date()
  })

  await appendOrderLog({
    orderId: id,
    orderNo: order.orderNo,
    status: text(order.status),
    title: '商家提出配送时间调整',
    note: `${deliveryDate} ${deliverySlot}${note ? `；${note}` : ''}`,
    adminContext
  })

  return {
    _id: id,
    deliveryScheduleStatus: 'customerConfirmationRequired',
    proposedDeliveryDate: deliveryDate,
    proposedDeliverySlot: deliverySlot,
    totalAmountFen
  }
}

async function rejectOrder(event, adminContext) {
  const id = text(event.id)
  const reason = text(event.reason)
  if (!reason) throw new BusinessError('请填写拒绝原因')

  const order = await requireOrder(id)
  assertOrderStatus(order, ['pendingConfirm'])

  await db.collection(COLLECTIONS.orders).doc(id).update({
    status: 'cancelled',
    statusLabel: ORDER_STATUS_META.cancelled.label,
    cancelReason: reason,
    cancelledAt: new Date(),
    updatedAt: new Date(),
    updatedBy: adminContext.identity.uid
  })

  await appendOrderLog({
    orderId: id,
    orderNo: order.orderNo,
    status: 'cancelled',
    title: '商家未能确认订单',
    note: reason,
    adminContext
  })

  return { _id: id, status: 'cancelled' }
}

async function markOrderPaid(event, adminContext) {
  const id = text(event.id)
  const order = await requireOrder(id)
  assertOrderStatus(order, ['pendingPayment'])

  const deliveryScheduleStatus = normalizeAdminDeliveryScheduleStatus(order)
  if (!['confirmed', 'notRequired'].includes(deliveryScheduleStatus)) {
    throw new BusinessError('请先确认订单的最终配送时间')
  }

  const note = text(event.note, '商家已确认线下收款')

  await db.collection(COLLECTIONS.orders).doc(id).update({
    status: 'making',
    statusLabel: ORDER_STATUS_META.making.label,
    paymentStatus: 'offlinePaid',
    paidAt: new Date(),
    makingAt: new Date(),
    updatedAt: new Date(),
    updatedBy: adminContext.identity.uid
  })

  await appendOrderLog({
    orderId: id,
    orderNo: order.orderNo,
    status: 'making',
    title: '已确认收款，开始制作',
    note,
    adminContext
  })

  return { _id: id, status: 'making', paymentStatus: 'offlinePaid' }
}

async function startDelivery(event, adminContext) {
  const id = text(event.id)
  const order = await requireOrder(id)
  assertOrderStatus(order, ['making', 'delivering'])

  const logisticsCompanyCode = text(event.logisticsCompanyCode).toLowerCase()
  const logisticsCompanyName = text(event.logisticsCompanyName)
  const trackingNo = text(event.trackingNo).replace(/\s+/g, '')
  const note = text(event.note, '鲜花已经开始配送')

  if (!logisticsCompanyCode || !logisticsCompanyName) {
    throw new BusinessError('请选择快递公司')
  }
  if (!/^[A-Za-z0-9-]{6,32}$/.test(trackingNo)) {
    throw new BusinessError('请输入正确的快递单号（6—32 位字母、数字或短横线）')
  }

  const now = new Date()
  await db.collection(COLLECTIONS.orders).doc(id).update({
    status: 'delivering',
    statusLabel: ORDER_STATUS_META.delivering.label,
    logisticsCompanyCode,
    logisticsCompanyName,
    trackingNo,
    logisticsState: text(order.logisticsState, '0'),
    logisticsStateLabel: text(order.logisticsStateLabel, '运输中'),
    logisticsUpdatedAt: now,
    deliveringAt: order.deliveringAt || now,
    updatedAt: now,
    updatedBy: adminContext.identity.uid
  })

  await appendOrderLog({
    orderId: id,
    orderNo: order.orderNo,
    status: 'delivering',
    title: text(order.status) === 'delivering' ? '物流信息已更新' : '订单开始配送',
    note: `${logisticsCompanyName} ${trackingNo}${note ? `；${note}` : ''}`,
    adminContext
  })

  return {
    _id: id,
    status: 'delivering',
    logisticsCompanyCode,
    logisticsCompanyName,
    trackingNo
  }
}

async function completeOrder(event, adminContext) {
  const id = text(event.id)
  const order = await requireOrder(id)
  assertOrderStatus(order, ['delivering'])
  const note = text(event.note, '订单已经完成')

  await db.collection(COLLECTIONS.orders).doc(id).update({
    status: 'completed',
    statusLabel: ORDER_STATUS_META.completed.label,
    completedAt: new Date(),
    updatedAt: new Date(),
    updatedBy: adminContext.identity.uid
  })

  await appendOrderLog({
    orderId: id,
    orderNo: order.orderNo,
    status: 'completed',
    title: '订单已完成',
    note,
    adminContext
  })

  return { _id: id, status: 'completed' }
}

async function cancelAdminOrder(event, adminContext) {
  const id = text(event.id)
  const reason = text(event.reason)
  if (!reason) throw new BusinessError('请填写取消原因')

  const order = await requireOrder(id)
  assertOrderStatus(order, ['pendingConfirm', 'pendingPayment', 'making'])

  await db.collection(COLLECTIONS.orders).doc(id).update({
    status: 'cancelled',
    statusLabel: ORDER_STATUS_META.cancelled.label,
    cancelReason: reason,
    cancelledAt: new Date(),
    updatedAt: new Date(),
    updatedBy: adminContext.identity.uid
  })

  await appendOrderLog({
    orderId: id,
    orderNo: order.orderNo,
    status: 'cancelled',
    title: '商家取消订单',
    note: reason,
    adminContext
  })

  return { _id: id, status: 'cancelled' }
}

async function listUsers(event) {
  const filters = event.filters || {}
  const keyword = text(filters.keyword).toLowerCase()
  const [users, addresses, orders] = await Promise.all([
    safeGetAll(COLLECTIONS.users),
    safeGetAll(COLLECTIONS.addresses),
    safeGetAll(COLLECTIONS.orders)
  ])

  const avatarUrlMap = await resolveFileUrls(users, ['avatarFileId'])
  const addressCountMap = new Map()
  const orderCountMap = new Map()
  const completedAmountMap = new Map()

  for (const item of addresses) {
    addressCountMap.set(item.userId, (addressCountMap.get(item.userId) || 0) + 1)
  }

  for (const item of orders) {
    orderCountMap.set(item.userId, (orderCountMap.get(item.userId) || 0) + 1)
    if (item.status === 'completed') {
      completedAmountMap.set(
        item.userId,
        (completedAmountMap.get(item.userId) || 0) + integer(item.totalAmountFen)
      )
    }
  }

  const items = users
    .filter((item) => {
      if (!keyword) return true
      return [item.nickname, item._id]
        .map((value) => text(value).toLowerCase())
        .join(' ')
        .includes(keyword)
    })
    .sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))
    .map((item) => ({
      ...item,
      avatarUrl: avatarUrlMap[text(item.avatarFileId)] || '',
      memberLevelLabel: text(item.memberLevelLabel, '普通会员'),
      points: integer(item.points),
      addressCount: addressCountMap.get(item._id) || 0,
      orderCount: orderCountMap.get(item._id) || 0,
      completedAmountFen: completedAmountMap.get(item._id) || 0,
      completedAmountText: formatFen(completedAmountMap.get(item._id) || 0),
      createdAtText: isoDate(item.createdAt)
    }))

  return {
    items,
    total: items.length,
    collectionReady: await collectionExists(COLLECTIONS.users)
  }
}

async function getUser(event) {
  const id = text(event.id)
  if (!id) throw new BusinessError('缺少顾客 ID')

  const user = firstDocument(
    await db.collection(COLLECTIONS.users).doc(id).get()
  )
  if (!user) throw new BusinessError('顾客不存在', 'NOT_FOUND')

  const [addresses, orders] = await Promise.all([
    safeGetAll(COLLECTIONS.addresses),
    safeGetAll(COLLECTIONS.orders)
  ])
  const avatarUrlMap = await resolveFileUrls([user], ['avatarFileId'])

  return {
    ...user,
    avatarUrl: avatarUrlMap[text(user.avatarFileId)] || '',
    memberLevelLabel: text(user.memberLevelLabel, '普通会员'),
    points: integer(user.points),
    createdAtText: isoDate(user.createdAt),
    addresses: addresses
      .filter((item) => item.userId === id)
      .map((item) => ({
        ...item,
        phoneMasked: maskPhone(item.phone)
      })),
    orders: orders
      .filter((item) => item.userId === id)
      .sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))
      .map((item) => orderView(item, {}))
  }
}




function normalizeAdminQuoteRecord(item) {
  const source = item && typeof item === 'object' ? item : {}
  const legacy = source.data && typeof source.data === 'object' && !Array.isArray(source.data)
    ? source.data
    : {}
  const topStatus = text(source.status, 'pending')
  const legacyStatus = text(legacy.status)
  const useLegacyStatus = (!topStatus || topStatus === 'pending') && legacyStatus && legacyStatus !== 'pending'

  return {
    ...legacy,
    ...source,
    status: useLegacyStatus ? legacyStatus : topStatus,
    statusLabel: useLegacyStatus
      ? text(legacy.statusLabel, source.statusLabel)
      : text(source.statusLabel, legacy.statusLabel),
    merchantReply: text(source.merchantReply) || text(legacy.merchantReply),
    quotedPriceFen: integer(source.quotedPriceFen) || integer(legacy.quotedPriceFen),
    quotedPriceYuan: number(source.quotedPriceYuan) || number(legacy.quotedPriceYuan),
    quotedPrice: text(source.quotedPrice) || text(legacy.quotedPrice),
    quotedAt: source.quotedAt || legacy.quotedAt || null,
    handledBy: text(source.handledBy) || text(legacy.handledBy),
    customerDecision: text(source.customerDecision) || text(legacy.customerDecision),
    customerRespondedAt: source.customerRespondedAt || legacy.customerRespondedAt || null,
    orderId: text(source.orderId) || text(legacy.orderId),
    orderNo: text(source.orderNo) || text(legacy.orderNo)
  }
}

function normalizeAdminQuoteStatus(item) {
  const record = normalizeAdminQuoteRecord(item)
  if (record.orderId) return 'converted'
  const status = text(record.status, 'pending')
  const aliases = {
    rejected: 'merchantRejected',
    completed: 'converted',
    accepted: 'converted',
    declined: 'customerRejected'
  }
  return aliases[status] || status
}

function adminQuoteStatusMeta(status) {
  const map = {
    pending: { label: '待商户确认', tone: 'warning' },
    quoted: { label: '待用户确认', tone: 'primary' },
    merchantRejected: { label: '暂不接单', tone: 'danger' },
    customerRejected: { label: '用户已拒绝', tone: 'danger' },
    converted: { label: '已生成订单', tone: 'success' }
  }
  return map[status] || { label: status || '处理中', tone: 'warning' }
}

function adminQuotedPriceFen(item) {
  const record = normalizeAdminQuoteRecord(item)
  const direct = integer(record.quotedPriceFen)
  if (direct > 0) return direct
  const yuan = number(record.quotedPriceYuan)
  if (yuan > 0) return Math.round(yuan * 100)
  const match = text(record.quotedPrice).replace(/,/g, '').match(/\d+(?:\.\d{1,2})?/)
  return match ? Math.round(Number(match[0]) * 100) : 0
}

function adminFormatFen(value) {
  const yuan = integer(value) / 100
  return Number.isInteger(yuan)
    ? String(yuan)
    : yuan.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

async function listQuoteRequests() {
  const items = await safeGetAll(COLLECTIONS.quoteRequests)
  const users = await safeGetAll(COLLECTIONS.users)
  const avatarUrlMap = await resolveFileUrls(users, ['avatarFileId'])
  const imageIds = [...new Set(
    items
      .flatMap((item) => Array.isArray(item.images) ? item.images : [])
      .map((value) => text(value))
      .filter((value) => value.startsWith('cloud://'))
  )]
  const imageUrlMap = {}

  if (imageIds.length) {
    try {
      const result = await app.getTempFileURL({ fileList: imageIds })
      for (const file of result.fileList || []) {
        if (file.fileID && file.tempFileURL) {
          imageUrlMap[file.fileID] = file.tempFileURL
        }
      }
    } catch (error) {
      console.error('[adminApi] 定制图片临时地址生成失败：', error)
    }
  }

  return items
    .sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))
    .map((item) => {
      const normalizedItem = normalizeAdminQuoteRecord(item)
      const user = users.find((row) => text(row._id) === text(normalizedItem.userId)) || {}
      const sourceImages = Array.isArray(normalizedItem.images) ? normalizedItem.images : []
      const status = normalizeAdminQuoteStatus(normalizedItem)
      const statusMeta = adminQuoteStatusMeta(status)
      const quotedPriceFen = adminQuotedPriceFen(normalizedItem)
      return {
        ...item,
        ...normalizedItem,
        data: undefined,
        status,
        statusLabel: statusMeta.label,
        statusTone: statusMeta.tone,
        quotedPriceFen,
        quotedPriceYuan: quotedPriceFen > 0 ? quotedPriceFen / 100 : 0,
        quotedPriceText: quotedPriceFen > 0 ? adminFormatFen(quotedPriceFen) : '',
        images: sourceImages.map((fileId) => imageUrlMap[text(fileId)] || text(fileId)),
        imageFileIds: sourceImages,
        userNickname: text(normalizedItem.userNickname || user.nickname, 'Chloris 用户'),
        userAvatarUrl: avatarUrlMap[text(user.avatarFileId)] || '',
        createdAtText: isoDate(normalizedItem.createdAt),
        updatedAtText: isoDate(normalizedItem.updatedAt),
        quotedAtText: isoDate(normalizedItem.quotedAt),
        customerRespondedAtText: isoDate(normalizedItem.customerRespondedAt),
        imageCount: sourceImages.length,
        canReply: ['pending', 'quoted'].includes(status),
        customerDecisionLabel: status === 'customerRejected'
          ? '用户拒绝'
          : status === 'converted'
            ? '用户同意'
            : '等待用户操作'
      }
    })
}

async function updateQuoteRequest(event, adminContext) {
  const id = text(event.id)
  if (!id) throw new BusinessError('缺少需求ID')
  const items = await safeGetAll(COLLECTIONS.quoteRequests)
  const currentSource = items.find((row) => text(row._id) === id)
  if (!currentSource) throw new BusinessError('定制需求不存在', 'NOT_FOUND')
  const current = normalizeAdminQuoteRecord(currentSource)

  const currentStatus = normalizeAdminQuoteStatus(current)
  if (['converted', 'customerRejected'].includes(currentStatus)) {
    throw new BusinessError('用户已经完成操作，当前记录不能再次修改', 'QUOTE_ALREADY_DECIDED')
  }

  const status = text(event.status, 'quoted')
  if (!['quoted', 'merchantRejected'].includes(status)) {
    throw new BusinessError('无效的报价处理状态')
  }

  const merchantReply = text(event.merchantReply).slice(0, 500)
  const quotedPriceYuan = number(event.quotedPriceYuan)
  const quotedPriceFen = status === 'quoted'
    ? Math.round(quotedPriceYuan * 100)
    : 0

  if (status === 'quoted' && quotedPriceFen <= 0) {
    throw new BusinessError('请填写有效的报价金额')
  }

  if (status === 'quoted' && !merchantReply) {
    throw new BusinessError('请填写给顾客的报价说明')
  }

  const statusLabel = status === 'merchantRejected'
    ? '暂不接单'
    : '待用户确认'

  await db.collection(COLLECTIONS.quoteRequests).doc(id).update({
    status,
    statusLabel,
    quotedPriceFen,
    quotedPriceYuan: quotedPriceFen > 0 ? quotedPriceFen / 100 : 0,
    quotedPrice: quotedPriceFen > 0 ? `¥${adminFormatFen(quotedPriceFen)}` : '',
    merchantReply,
    handledBy: text(adminContext.admin && adminContext.admin.name),
    quotedAt: db.serverDate(),
    customerDecision: '',
    customerRespondedAt: null,
    updatedAt: db.serverDate(),
    // 清理旧版本错误写入的嵌套 data 字段。
    data: _.remove()
  })

  return {
    ok: true,
    id,
    status,
    statusLabel,
    quotedPriceFen
  }
}
async function dashboard() {
  const [products, banners, atlas, calendarOverrides, orders, users, quoteRequests] = await Promise.all([
    safeGetAll(COLLECTIONS.products),
    safeGetAll(COLLECTIONS.banners),
    safeGetAll(COLLECTIONS.atlas),
    safeGetAll(COLLECTIONS.calendarEvents),
    safeGetAll(COLLECTIONS.orders),
    safeGetAll(COLLECTIONS.users),
    safeGetAll(COLLECTIONS.quoteRequests)
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
    customerCount: users.length,
    orderCount: orders.length,
    pendingConfirmOrders: orders.filter((item) => item.status === 'pendingConfirm').length,
    pendingPaymentOrders: orders.filter((item) => item.status === 'pendingPayment').length,
    makingOrders: orders.filter((item) => item.status === 'making').length,
    deliveringOrders: orders.filter((item) => item.status === 'delivering').length,
    completedOrders: orders.filter((item) => item.status === 'completed').length,
    completedRevenueFen: orders
      .filter((item) => item.status === 'completed')
      .reduce((sum, item) => sum + integer(item.totalAmountFen), 0),
    lowStockProducts,
    quoteRequestCount: quoteRequests.length,
    pendingQuoteRequests: quoteRequests.filter((item) => !item.status || item.status === 'pending').length
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
      case 'listOrders': return success(await listOrders(event))
      case 'getOrder': return success(await getOrder(event))
      case 'confirmOrder': return success(await confirmOrder(event, adminContext))
      case 'updateDeliverySchedule': return success(await updateDeliverySchedule(event, adminContext))
      case 'rejectOrder': return success(await rejectOrder(event, adminContext))
      case 'markOrderPaid': return success(await markOrderPaid(event, adminContext))
      case 'startDelivery': return success(await startDelivery(event, adminContext))
      case 'completeOrder': return success(await completeOrder(event, adminContext))
      case 'cancelAdminOrder': return success(await cancelAdminOrder(event, adminContext))
      case 'listUsers': return success(await listUsers(event))
      case 'getUser': return success(await getUser(event))
      case 'listQuoteRequests': return success(await listQuoteRequests())
      case 'updateQuoteRequest': return success(await updateQuoteRequest(event, adminContext))
      default:
        throw new BusinessError(`未知操作：${action}`, 'UNKNOWN_ACTION')
    }
  } catch (error) {
    return failure(error)
  }
}
