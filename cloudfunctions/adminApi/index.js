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
  calendarEvents: 'calendarEvents',
  users: 'users',
  addresses: 'addresses',
  orders: 'orders',
  orderLogs: 'orderLogs'
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
    productSkus: stringArray(input.productSkus),
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

function orderView(item, urlMap = {}) {
  const status = text(item.status, 'pendingConfirm')
  const meta = orderStatusMeta(status)
  const items = (Array.isArray(item.items) ? item.items : []).map((row) => ({
    ...row,
    imageUrl: urlMap[text(row.coverFileId)] || '',
    unitPriceText: formatFen(row.unitPriceFen),
    subtotalText: formatFen(row.subtotalFen)
  }))

  return {
    ...item,
    _id: text(item._id),
    orderNo: text(item.orderNo),
    status,
    statusLabel: meta.label,
    statusTone: meta.tone,
    paymentStatus: text(item.paymentStatus, 'unpaid'),
    customerNickname: text(item.customerNickname, '花予用户'),
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

  await db.collection(COLLECTIONS.orders).doc(id).update({
    status: 'pendingPayment',
    statusLabel: ORDER_STATUS_META.pendingPayment.label,
    deliveryFeeFen,
    deliveryFeePending: false,
    amountPending: false,
    totalAmountFen,
    merchantNote,
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
  assertOrderStatus(order, ['making'])
  const note = text(event.note, '鲜花已经开始配送')

  await db.collection(COLLECTIONS.orders).doc(id).update({
    status: 'delivering',
    statusLabel: ORDER_STATUS_META.delivering.label,
    deliveringAt: new Date(),
    updatedAt: new Date(),
    updatedBy: adminContext.identity.uid
  })

  await appendOrderLog({
    orderId: id,
    orderNo: order.orderNo,
    status: 'delivering',
    title: '订单开始配送',
    note,
    adminContext
  })

  return { _id: id, status: 'delivering' }
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

async function dashboard() {
  const [products, banners, atlas, calendarOverrides, orders, users] = await Promise.all([
    safeGetAll(COLLECTIONS.products),
    safeGetAll(COLLECTIONS.banners),
    safeGetAll(COLLECTIONS.atlas),
    safeGetAll(COLLECTIONS.calendarEvents),
    safeGetAll(COLLECTIONS.orders),
    safeGetAll(COLLECTIONS.users)
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
      case 'listOrders': return success(await listOrders(event))
      case 'getOrder': return success(await getOrder(event))
      case 'confirmOrder': return success(await confirmOrder(event, adminContext))
      case 'rejectOrder': return success(await rejectOrder(event, adminContext))
      case 'markOrderPaid': return success(await markOrderPaid(event, adminContext))
      case 'startDelivery': return success(await startDelivery(event, adminContext))
      case 'completeOrder': return success(await completeOrder(event, adminContext))
      case 'cancelAdminOrder': return success(await cancelAdminOrder(event, adminContext))
      case 'listUsers': return success(await listUsers(event))
      case 'getUser': return success(await getUser(event))
      default:
        throw new BusinessError(`未知操作：${action}`, 'UNKNOWN_ACTION')
    }
  } catch (error) {
    return failure(error)
  }
}
