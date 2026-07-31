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
  festivalCampaigns: 'festivalCampaigns',
  studios: 'studios',
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
  gift: '礼品',
  tool: '花艺工具'
}


const SALES_MODE_LABELS = {
  spot: '现货销售',
  preorder: '预约销售'
}

const CAMPAIGN_TYPE_LABELS = {
  valentine: '情人节预定',
  festival: '节日预售',
  limited: '限时推出',
  seasonal: '季节限定'
}

function normalizedTimestamp(value) {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  let source = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(source)) {
    source = `${source.replace(' ', 'T')}+08:00`
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(source)) {
    source = `${source}+08:00`
  }
  const timestamp = new Date(source).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function productWindowStatus(item, now = Date.now()) {
  if (item.onSale !== true) return { active: false, label: '手动下架', tone: 'info' }
  if (integer(item.stock) <= 0) return { active: false, label: '已售罄', tone: 'danger' }

  if (item.limitedTimeEnabled === true) {
    const start = normalizedTimestamp(item.saleStartAt)
    const end = normalizedTimestamp(item.saleEndAt)
    if (start && now < start) return { active: false, label: '限时活动待开始', tone: 'warning' }
    if (end && now > end) return { active: false, label: '限时活动已结束', tone: 'info' }
  }

  if (text(item.salesMode, 'spot') === 'preorder') {
    const start = normalizedTimestamp(item.preorderStartAt)
    const end = normalizedTimestamp(item.preorderEndAt || item.reservationDeadlineAt)
    if (start && now < start) return { active: false, label: '等待开放预售', tone: 'warning' }
    if (end && now > end) return { active: false, label: '预售已经结束', tone: 'info' }
    return { active: true, label: '预约销售中', tone: 'primary' }
  }

  if (item.limitedTimeEnabled === true) return { active: true, label: '限时销售中', tone: 'primary' }
  return { active: true, label: '正常销售', tone: 'success' }
}

const ORDER_STATUS_META = {
  pendingConfirm: { label: '待付款', tone: 'warning' },
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

  const windowStatus = productWindowStatus(item)
  return {
    ...item,
    galleryFileIds,
    typeLabel: TYPE_LABELS[item.type] || item.type || '其他',
    salesMode: ['spot', 'preorder'].includes(text(item.salesMode)) ? text(item.salesMode) : 'spot',
    salesModeLabel: SALES_MODE_LABELS[text(item.salesMode)] || SALES_MODE_LABELS.spot,
    effectiveOnSale: windowStatus.active,
    windowStatusLabel: windowStatus.label,
    windowStatusTone: windowStatus.tone,
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
      if (filters.salesMode && text(item.salesMode, 'spot') !== filters.salesMode) return false
      if (filters.campaignId && text(item.festivalCampaignId) !== filters.campaignId) return false
      const windowStatus = productWindowStatus(item)
      if (filters.saleStatus === 'onSale' && !windowStatus.active) return false
      if (filters.saleStatus === 'offSale' && item.onSale === true) return false
      if (filters.saleStatus === 'scheduled' && !(!windowStatus.active && ['限时活动待开始', '等待开放预售', '限时活动已结束', '预售已经结束'].includes(windowStatus.label))) return false
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
    coverFileId: text(input.coverFileId),
    galleryFileIds: stringArray(input.galleryFileIds).slice(0, 8),
    videoFileId: text(input.videoFileId),
    videoPosterFileId: text(input.videoPosterFileId),
    detailDescription: text(input.detailDescription).slice(0, 2000),
    flowerMaterialInfo: text(input.flowerMaterialInfo).slice(0, 1000),
    sizeDescription: text(input.sizeDescription).slice(0, 500),
    deliveryDescription: text(input.deliveryDescription).slice(0, 1000),
    careDescription: text(input.careDescription).slice(0, 1000),
    salesMode: ['spot', 'preorder'].includes(text(input.salesMode)) ? text(input.salesMode) : 'spot',
    limitedTimeEnabled: boolean(input.limitedTimeEnabled),
    saleStartAt: text(input.saleStartAt),
    saleEndAt: text(input.saleEndAt),
    festivalCampaignId: text(input.festivalCampaignId),
    preorderStartAt: text(input.preorderStartAt),
    preorderEndAt: text(input.preorderEndAt),
    deliveryStartDate: text(input.deliveryStartDate),
    deliveryEndDate: text(input.deliveryEndDate),
    reservationDeadlineAt,
    reservationQuota: integer(input.reservationQuota),
    productionUnits: Math.max(1, integer(input.productionUnits, 1)),
    studioId: text(input.studioId),
    sort: integer(input.sort, 100)
  }
}

function validateProductCommercial(data) {
  if (data.limitedTimeEnabled === true) {
    const start = normalizedTimestamp(data.saleStartAt)
    const end = normalizedTimestamp(data.saleEndAt)
    if (!start || !end) throw new BusinessError('限时推出必须设置完整的开始和结束时间')
    if (start >= end) throw new BusinessError('限时销售结束时间必须晚于开始时间')
  }
  if (data.salesMode === 'preorder') {
    const start = normalizedTimestamp(data.preorderStartAt)
    const end = normalizedTimestamp(data.preorderEndAt || data.reservationDeadlineAt)
    if (start && end && start >= end) throw new BusinessError('预约结束时间必须晚于开始时间')
    if (data.deliveryStartDate && data.deliveryEndDate && data.deliveryStartDate > data.deliveryEndDate) {
      throw new BusinessError('预约配送结束日期不能早于开始日期')
    }
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

  if (data.festivalCampaignId) {
    await assertCollectionExists(COLLECTIONS.festivalCampaigns)
    const campaign = firstDocument(await db.collection(COLLECTIONS.festivalCampaigns).doc(data.festivalCampaignId).get())
    if (!campaign) throw new BusinessError('选择的节日活动不存在')
    const campaignType = text(campaign.type)
    const isPreorderCampaign = ['valentine', 'festival'].includes(campaignType)
    const isLimitedCampaign = ['limited', 'seasonal'].includes(campaignType)

    // 关联活动时由活动统一管理销售窗口，避免商品保留上一活动的过期配置。
    data.campaignManaged = true
    data.campaignManagedType = campaignType
    data.salesMode = isPreorderCampaign ? 'preorder' : 'spot'
    data.preorderStartAt = isPreorderCampaign ? text(campaign.preSaleStartAt) : ''
    data.preorderEndAt = isPreorderCampaign ? text(campaign.preSaleEndAt) : ''
    data.deliveryStartDate = isPreorderCampaign ? text(campaign.deliveryStartDate) : ''
    data.deliveryEndDate = isPreorderCampaign ? text(campaign.deliveryEndDate) : ''
    data.reservationDeadlineAt = isPreorderCampaign ? text(campaign.reservationDeadlineAt) : ''
    data.limitedTimeEnabled = isLimitedCampaign
    data.saleStartAt = isLimitedCampaign ? text(campaign.preSaleStartAt) : ''
    data.saleEndAt = isLimitedCampaign ? text(campaign.preSaleEndAt || campaign.reservationDeadlineAt) : ''
  } else if (existing && existing.campaignManaged === true) {
    // 从活动中移除后恢复常规现货商品；后续可再手动设置独立预约或限时窗口。
    data.campaignManaged = false
    data.campaignManagedType = ''
    data.salesMode = 'spot'
    data.preorderStartAt = ''
    data.preorderEndAt = ''
    data.deliveryStartDate = ''
    data.deliveryEndDate = ''
    data.reservationDeadlineAt = ''
    data.limitedTimeEnabled = false
    data.saleStartAt = ''
    data.saleEndAt = ''
  } else {
    data.campaignManaged = false
    data.campaignManagedType = ''
  }

  if (data.studioId) {
    await assertCollectionExists(COLLECTIONS.studios)
    const studio = firstDocument(await db.collection(COLLECTIONS.studios).doc(data.studioId).get())
    if (!studio || studio.enabled === false) throw new BusinessError('选择的履约工作室不存在或已停用')
  }

  validateProductCommercial(data)

  data.sku = data.sku || text(existing && existing.sku) || defaultBusinessCode('SKU', id)
  await assertUniqueCode(COLLECTIONS.products, 'sku', data.sku, id)


  const document = {
    ...data,
    createdAt: existing && existing.createdAt || new Date(),
    updatedAt: new Date(),
    updatedBy: adminContext.identity.uid
  }

  await db.collection(COLLECTIONS.products).doc(id).set(document)

  // 保持商品与活动的双向关联一致，一个商品同时只归属一个活动。
  const campaigns = await safeGetAll(COLLECTIONS.festivalCampaigns)
  for (const campaign of campaigns) {
    const productIds = stringArray(campaign.productIds)
    const shouldContain = text(campaign._id) === data.festivalCampaignId
    const nextProductIds = shouldContain
      ? [...new Set([...productIds, id])]
      : productIds.filter((productId) => productId !== id)
    if (nextProductIds.length !== productIds.length || (shouldContain && !productIds.includes(id))) {
      await db.collection(COLLECTIONS.festivalCampaigns).doc(campaign._id).update({
        productIds: nextProductIds,
        updatedAt: new Date(),
        updatedBy: adminContext.identity.uid
      })
    }
  }

  return { _id: id, ...document }
}

async function deleteProduct(event) {
  await assertCollectionExists(COLLECTIONS.products)
  const id = text(event.id)
  if (!id) throw new BusinessError('缺少商品 ID')
  await db.collection(COLLECTIONS.products).doc(id).remove()
  const campaigns = await safeGetAll(COLLECTIONS.festivalCampaigns)
  for (const campaign of campaigns) {
    const productIds = stringArray(campaign.productIds)
    if (!productIds.includes(id)) continue
    await db.collection(COLLECTIONS.festivalCampaigns).doc(campaign._id).update({
      productIds: productIds.filter((productId) => productId !== id),
      updatedAt: new Date()
    })
  }
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
  if (requestedReady && ['pendingMerchantConfirm', 'confirmed', ''].includes(direct)) return 'confirmed'
  return direct || 'confirmed'
}

function adminDeliveryScheduleMeta(status) {
  const map = {
    notRequired: { label: '无需二次确认', tone: 'info', description: '该订单不需要额外确认配送时间。' },
    missingSchedule: { label: '待补充配送时间', tone: 'warning', description: '该订单尚未填写有效的配送日期和时段，请由商家补充并确认。' },
    pendingMerchantConfirm: { label: '时间已选定', tone: 'success', description: '顾客已选择配送时间，可直接付款。' },
    customerConfirmationRequired: { label: '时间已选定', tone: 'success', description: '顾客已选择配送时间，可直接付款。' },
    confirmed: { label: '时间已确认', tone: 'success', description: '最终配送日期和时段已经确认。' },
    adjustmentRejected: { label: '时间已选定', tone: 'success', description: '顾客已选择配送时间，可直接付款。' }
  }
  return map[status] || { label: '时间已选定', tone: 'success', description: '顾客已选择配送时间。' }
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
  const rawStatus = text(item.status, 'pendingPayment')
  const status = rawStatus === 'pendingConfirm' ? 'pendingPayment' : rawStatus
  const meta = orderStatusMeta(status)
  const items = (Array.isArray(item.items) ? item.items : []).map((row) => ({
    ...row,
    imageUrl: urlMap[text(row.coverFileId)] || '',
    unitPriceText: formatFen(row.unitPriceFen),
    subtotalText: formatFen(row.subtotalFen)
  }))
  const deliveryScheduleStatus = normalizeAdminDeliveryScheduleStatus(item)
  const deliveryScheduleMeta = adminDeliveryScheduleMeta(deliveryScheduleStatus)
  const isPickup = text(item.deliveryMethodId) === 'pickup'
  const statusLabel = isPickup && status === 'making'
    ? '备货中'
    : isPickup && status === 'delivering'
      ? '待取货'
      : meta.label
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
    statusLabel,
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
    deliveryFeeText: formatFen(item.deliveryFeeFen),
    discountText: formatFen(item.discountFen),
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
      if (status && status !== 'all') {
        if (status === 'pendingPayment') {
          if (!['pendingConfirm', 'pendingPayment'].includes(item.status)) return false
        } else if (item.status !== status) return false
      }
      if (deliveryMethodId && item.deliveryMethodId !== deliveryMethodId) return false

      if (keyword) {
        const searchable = [
          item.orderNo,
          item.customerNickname,
          item.address && item.address.receiverName,
          item.address && item.address.phone,
          item.pickupLocation && item.pickupLocation.name,
          item.pickupLocation && item.pickupLocation.address,
          item.pickupLocation && item.pickupLocation.phone,
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
    pendingPayment: 0,
    making: 0,
    delivering: 0,
    completed: 0,
    cancelled: 0,
    refundPending: 0,
    refunded: 0
  }

  for (const item of items) {
    if (['pendingConfirm', 'pendingPayment'].includes(item.status)) {
      counts.pendingPayment += 1
    } else if (Object.prototype.hasOwnProperty.call(counts, item.status)) {
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
      deliveryFeeFen -
      integer(order.discountFen)
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
      deliveryFeeFen -
      integer(order.discountFen)
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
  assertOrderStatus(order, ['pendingConfirm', 'pendingPayment'])

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

function sanitizeCampaign(input) {
  const name = text(input.name)
  if (!name) throw new BusinessError('活动名称不能为空')
  const type = text(input.type, 'festival')
  if (!Object.prototype.hasOwnProperty.call(CAMPAIGN_TYPE_LABELS, type)) {
    throw new BusinessError('活动类型不正确')
  }
  const preSaleStartAt = text(input.preSaleStartAt)
  const preSaleEndAt = text(input.preSaleEndAt)
  const deliveryStartDate = text(input.deliveryStartDate)
  const deliveryEndDate = text(input.deliveryEndDate)
  if (!preSaleStartAt || !preSaleEndAt) {
    throw new BusinessError('活动必须设置完整的开始和结束时间')
  }
  if (normalizedTimestamp(preSaleStartAt) >= normalizedTimestamp(preSaleEndAt)) {
    throw new BusinessError('活动结束时间必须晚于开始时间')
  }
  if (['valentine', 'festival'].includes(type) && (!deliveryStartDate || !deliveryEndDate)) {
    throw new BusinessError('节日预售必须设置允许配送日期')
  }
  if (deliveryStartDate && deliveryEndDate && deliveryStartDate > deliveryEndDate) {
    throw new BusinessError('配送结束日期不能早于开始日期')
  }
  const reservationDeadlineAt = text(input.reservationDeadlineAt)
  if (reservationDeadlineAt && normalizedTimestamp(reservationDeadlineAt) > normalizedTimestamp(preSaleEndAt)) {
    throw new BusinessError('预约截止时间不能晚于活动结束时间')
  }
  return {
    campaignCode: text(input.campaignCode).toUpperCase(),
    name,
    type,
    title: text(input.title, name),
    subtitle: text(input.subtitle),
    enabled: input.enabled !== false,
    preSaleStartAt,
    preSaleEndAt,
    deliveryStartDate,
    deliveryEndDate,
    reservationDeadlineAt,
    maxOrders: integer(input.maxOrders),
    maxUnits: integer(input.maxUnits),
    productIds: stringArray(input.productIds),
    sort: integer(input.sort, 100)
  }
}

function campaignUsage(campaignId, orders = []) {
  const activeStatuses = new Set(['pendingConfirm', 'pendingPayment', 'making', 'delivering', 'completed', 'refundPending'])
  const matched = orders.filter((order) => activeStatuses.has(text(order.status)) && (
    stringArray(order.festivalCampaignIds).includes(campaignId) ||
    (Array.isArray(order.items) ? order.items : []).some((entry) => text(entry.festivalCampaignId) === campaignId)
  ))
  const bookedUnits = matched.reduce((sum, order) => (
    sum + (Array.isArray(order.items) ? order.items : [])
      .filter((entry) => text(entry.festivalCampaignId) === campaignId)
      .reduce((inner, entry) => inner + Math.max(1, integer(entry.productionUnits, 1)) * Math.max(1, integer(entry.quantity, 1)), 0)
  ), 0)
  return { bookedOrders: matched.length, bookedUnits }
}

function campaignView(item, products = [], usage = {}) {
  const now = Date.now()
  const start = normalizedTimestamp(item.preSaleStartAt)
  const end = normalizedTimestamp(item.preSaleEndAt)
  const isPreorderCampaign = ['valentine', 'festival'].includes(text(item.type))
  let statusLabel = item.enabled === false ? '已停用' : (isPreorderCampaign ? '预售中' : '活动中')
  let statusTone = item.enabled === false ? 'info' : 'success'
  if (item.enabled !== false && start && now < start) { statusLabel = '等待开始'; statusTone = 'warning' }
  if (item.enabled !== false && end && now > end) { statusLabel = '已经结束'; statusTone = 'info' }
  const names = new Map(products.map((row) => [text(row._id), text(row.name)]))
  return {
    ...item,
    typeLabel: CAMPAIGN_TYPE_LABELS[text(item.type)] || text(item.type),
    statusLabel,
    statusTone,
    productIds: stringArray(item.productIds),
    productNames: stringArray(item.productIds).map((id) => names.get(id)).filter(Boolean),
    bookedOrders: integer(usage.bookedOrders),
    bookedUnits: integer(usage.bookedUnits),
    remainingOrders: integer(item.maxOrders) ? Math.max(0, integer(item.maxOrders) - integer(usage.bookedOrders)) : null,
    remainingUnits: integer(item.maxUnits) ? Math.max(0, integer(item.maxUnits) - integer(usage.bookedUnits)) : null
  }
}

async function listFestivalCampaigns() {
  const [items, products, orders] = await Promise.all([
    safeGetAll(COLLECTIONS.festivalCampaigns),
    safeGetAll(COLLECTIONS.products),
    safeGetAll(COLLECTIONS.orders)
  ])
  const result = items.sort((a,b) => integer(b.sort)-integer(a.sort) || normalizedTimestamp(b.preSaleStartAt)-normalizedTimestamp(a.preSaleStartAt))
    .map((item) => campaignView(item, products, campaignUsage(text(item._id), orders)))
  return { items: result, total: result.length, collectionReady: await collectionExists(COLLECTIONS.festivalCampaigns) }
}

async function saveFestivalCampaign(event, adminContext) {
  await assertCollectionExists(COLLECTIONS.festivalCampaigns)
  const input = event.campaign || {}
  const data = sanitizeCampaign(input)
  const id = text(input._id) || createId('campaign')
  let existing = null
  try { existing = firstDocument(await db.collection(COLLECTIONS.festivalCampaigns).doc(id).get()) } catch (error) {}
  data.campaignCode = data.campaignCode || text(existing && existing.campaignCode) || defaultBusinessCode('CAM', id)
  await assertUniqueCode(COLLECTIONS.festivalCampaigns, 'campaignCode', data.campaignCode, id)
  const products = await safeGetAll(COLLECTIONS.products)
  const knownProductIds = new Set(products.map((product) => text(product._id)))
  const invalidProductIds = data.productIds.filter((productId) => !knownProductIds.has(productId))
  if (invalidProductIds.length) {
    throw new BusinessError('活动关联的部分商品不存在，请刷新商品列表后重试')
  }
  const document = { ...data, createdAt: existing && existing.createdAt || new Date(), updatedAt: new Date(), updatedBy: adminContext.identity.uid }
  await db.collection(COLLECTIONS.festivalCampaigns).doc(id).set(document)

  // 一个商品仅归属一个活动；自动从其他活动中移除重复关联。
  const otherCampaigns = await safeGetAll(COLLECTIONS.festivalCampaigns)
  for (const campaign of otherCampaigns) {
    if (text(campaign._id) === id) continue
    const currentIds = stringArray(campaign.productIds)
    const nextIds = currentIds.filter((productId) => !data.productIds.includes(productId))
    if (nextIds.length !== currentIds.length) {
      await db.collection(COLLECTIONS.festivalCampaigns).doc(campaign._id).update({
        productIds: nextIds,
        updatedAt: new Date(),
        updatedBy: adminContext.identity.uid
      })
    }
  }

  // 同步活动关联商品，确保分类与详情可以立即识别。
  for (const product of products) {
    const shouldLink = data.productIds.includes(text(product._id))
    const isLinked = text(product.festivalCampaignId) === id
    if (shouldLink) {
      const isPreorderCampaign = ['valentine', 'festival'].includes(data.type)
      const isLimitedCampaign = ['limited', 'seasonal'].includes(data.type)
      await db.collection(COLLECTIONS.products).doc(product._id).update({
        festivalCampaignId: id,
        campaignManaged: true,
        campaignManagedType: data.type,
        salesMode: isPreorderCampaign ? 'preorder' : 'spot',
        preorderStartAt: isPreorderCampaign ? data.preSaleStartAt : '',
        preorderEndAt: isPreorderCampaign ? data.preSaleEndAt : '',
        deliveryStartDate: isPreorderCampaign ? data.deliveryStartDate : '',
        deliveryEndDate: isPreorderCampaign ? data.deliveryEndDate : '',
        reservationDeadlineAt: isPreorderCampaign ? data.reservationDeadlineAt : '',
        limitedTimeEnabled: isLimitedCampaign,
        saleStartAt: isLimitedCampaign ? data.preSaleStartAt : '',
        saleEndAt: isLimitedCampaign ? (data.preSaleEndAt || data.reservationDeadlineAt) : '',
        updatedAt: new Date(),
        updatedBy: adminContext.identity.uid
      })
    } else if (isLinked) {
      const cleanup = { festivalCampaignId: '', campaignManaged: false, campaignManagedType: '', updatedAt: new Date(), updatedBy: adminContext.identity.uid }
      if (product.campaignManaged === true) {
        Object.assign(cleanup, {
          salesMode: 'spot', preorderStartAt: '', preorderEndAt: '', deliveryStartDate: '', deliveryEndDate: '', reservationDeadlineAt: '',
          saleStartAt: '', saleEndAt: '', limitedTimeEnabled: false
        })
      }
      await db.collection(COLLECTIONS.products).doc(product._id).update(cleanup)
    }
  }
  return campaignView({ _id: id, ...document }, products)
}

async function deleteFestivalCampaign(event, adminContext) {
  const id = text(event.id)
  if (!id) throw new BusinessError('缺少活动 ID')
  await assertCollectionExists(COLLECTIONS.festivalCampaigns)
  await db.collection(COLLECTIONS.festivalCampaigns).doc(id).remove()
  const products = await safeGetAll(COLLECTIONS.products)
  for (const product of products.filter((item) => text(item.festivalCampaignId) === id)) {
    const cleanup = { festivalCampaignId: '', campaignManaged: false, campaignManagedType: '', updatedAt: new Date(), updatedBy: adminContext.identity.uid }
    if (product.campaignManaged === true) {
      Object.assign(cleanup, {
        preorderStartAt: '', preorderEndAt: '', deliveryStartDate: '', deliveryEndDate: '', reservationDeadlineAt: '',
        saleStartAt: '', saleEndAt: '', limitedTimeEnabled: false
      })
    }
    await db.collection(COLLECTIONS.products).doc(product._id).update(cleanup)
  }
  return { _id: id }
}

function sanitizeDateOverrides(value) {
  if (!Array.isArray(value)) return []
  return value.map((item) => ({
    date: text(item && item.date),
    maxOrders: integer(item && item.maxOrders),
    maxUnits: integer(item && item.maxUnits),
    closed: item && item.closed === true,
    note: text(item && item.note).slice(0, 120)
  })).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date)).slice(0, 120)
}

function sanitizeStudio(input) {
  const name = text(input.name)
  if (!name) throw new BusinessError('工作室名称不能为空')
  return {
    studioCode: text(input.studioCode).toUpperCase(),
    name,
    contactName: text(input.contactName),
    phone: text(input.phone),
    wechat: text(input.wechat),
    wechatQrFileId: text(input.wechatQrFileId),
    profileCoverFileId: text(input.profileCoverFileId),
    logoFileId: text(input.logoFileId),
    address: text(input.address),
    supportsPickup: input.supportsPickup !== false,
    pickupName: text(input.pickupName),
    pickupAddress: text(input.pickupAddress),
    pickupPhone: text(input.pickupPhone),
    pickupHours: text(input.pickupHours),
    pickupNotice: text(input.pickupNotice).slice(0, 300),
    enabled: input.enabled !== false,
    defaultDailyOrderLimit: Math.max(1, integer(input.defaultDailyOrderLimit, 10)),
    defaultDailyUnitLimit: Math.max(1, integer(input.defaultDailyUnitLimit, 20)),
    dateOverrides: sanitizeDateOverrides(input.dateOverrides),
    note: text(input.note).slice(0, 500),
    sort: integer(input.sort, 100)
  }
}

function orderCapacityUnits(order) {
  const direct = integer(order.capacityUnits || order.productionUnits)
  if (direct > 0) return direct
  return Math.max(1, (Array.isArray(order.items) ? order.items : []).reduce((sum, item) => (
    sum + Math.max(1, integer(item.productionUnits, 1)) * Math.max(1, integer(item.quantity, 1))
  ), 0))
}

function capacityRule(studio, date) {
  const override = (Array.isArray(studio.dateOverrides) ? studio.dateOverrides : []).find((item) => text(item.date) === date)
  return {
    closed: override ? override.closed === true : false,
    maxOrders: Math.max(1, integer(override && override.maxOrders, integer(studio.defaultDailyOrderLimit, 10))),
    maxUnits: Math.max(1, integer(override && override.maxUnits, integer(studio.defaultDailyUnitLimit, 20))),
    note: text(override && override.note)
  }
}

function chinaDateString(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(value)
}

async function studioCapacityRows(studio, days = 21, orderRows = null) {
  const orders = Array.isArray(orderRows) ? orderRows : await safeGetAll(COLLECTIONS.orders)
  const rows = []
  const now = new Date()
  for (let i=0;i<days;i+=1) {
    const date = chinaDateString(new Date(now.getTime()+i*86400000))
    const rule = capacityRule(studio, date)
    const active = orders.filter((order) => text(order.assignedStudioId) === text(studio._id) && text(order.deliveryDate || order.requestedDeliveryDate) === date && !['cancelled','refunded'].includes(text(order.status)))
    const usedUnits = active.reduce((sum, order) => sum + orderCapacityUnits(order), 0)
    rows.push({ date, ...rule, usedOrders: active.length, usedUnits, remainingOrders: Math.max(0, rule.maxOrders-active.length), remainingUnits: Math.max(0, rule.maxUnits-usedUnits) })
  }
  return rows
}

async function listStudios() {
  const [items, orders] = await Promise.all([
    safeGetAll(COLLECTIONS.studios),
    safeGetAll(COLLECTIONS.orders)
  ])
  const urlMap = await resolveFileUrls(items, [
    'wechatQrFileId',
    'profileCoverFileId',
    'logoFileId'
  ])
  const result=[]
  for (const item of items.sort((a,b)=>integer(b.sort)-integer(a.sort))) {
    result.push({
      ...item,
      wechatQrUrl: urlMap[text(item.wechatQrFileId)] || '',
      profileCoverUrl: urlMap[text(item.profileCoverFileId)] || '',
      logoUrl: urlMap[text(item.logoFileId)] || '',
      capacityRows: await studioCapacityRows(item, 14, orders)
    })
  }
  return { items: result, total: result.length, collectionReady: await collectionExists(COLLECTIONS.studios) }
}

async function saveStudio(event, adminContext) {
  await assertCollectionExists(COLLECTIONS.studios)
  const input = event.studio || {}
  const data = sanitizeStudio(input)
  const id = text(input._id) || createId('studio')
  let existing=null
  try { existing = firstDocument(await db.collection(COLLECTIONS.studios).doc(id).get()) } catch(error) {}
  data.studioCode = data.studioCode || text(existing && existing.studioCode) || defaultBusinessCode('STD', id)
  await assertUniqueCode(COLLECTIONS.studios, 'studioCode', data.studioCode, id)
  const document={...data,createdAt:existing&&existing.createdAt||new Date(),updatedAt:new Date(),updatedBy:adminContext.identity.uid}
  await db.collection(COLLECTIONS.studios).doc(id).set(document)
  return { _id:id, ...document, capacityRows: await studioCapacityRows({_id:id,...document},14) }
}

async function deleteStudio(event) {
  const id=text(event.id)
  if(!id) throw new BusinessError('缺少工作室 ID')
  const orders=await safeGetAll(COLLECTIONS.orders)
  if(orders.some((item)=>text(item.assignedStudioId)===id && !['completed','cancelled','refunded'].includes(text(item.status)))) {
    throw new BusinessError('该工作室仍有未完成订单，不能删除')
  }
  await db.collection(COLLECTIONS.studios).doc(id).remove()
  return {_id:id}
}

async function listStudioOrders(event) {
  const studioId=text(event.studioId)
  const status=text(event.status)
  const items=await safeGetAll(COLLECTIONS.orders)
  const filtered=items.filter((item)=>{
    if (studioId) {
      const assignedStudioId = text(item.assignedStudioId)
      const suggestedStudioId = text(item.suggestedStudioId)
      if (assignedStudioId && assignedStudioId !== studioId) return false
      if (!assignedStudioId && suggestedStudioId && suggestedStudioId !== studioId) return false
      if (!assignedStudioId && !suggestedStudioId && !['pendingConfirm','pendingPayment','making'].includes(text(item.status))) return false
    }
    if(status && status!=='all') {
      if(status==='pendingPayment') {
        if(!['pendingConfirm','pendingPayment'].includes(text(item.status))) return false
      } else if(text(item.status)!==status) return false
    }
    return ['pendingConfirm','pendingPayment','making','delivering'].includes(text(item.status))
  }).sort((a,b)=>dateValue(a.createdAt)-dateValue(b.createdAt))
  const urlMap=await resolveFileUrls(filtered.flatMap((order)=>Array.isArray(order.items)?order.items:[]),['coverFileId'])
  return {items:filtered.map((item)=>({...orderView(item,urlMap),capacityUnits:orderCapacityUnits(item),assignedStudioId:text(item.assignedStudioId),assignedStudioName:text(item.assignedStudioName)})),total:filtered.length}
}

async function assertStudioCapacity(studio, deliveryDate, order, excludeOrderId='') {
  const rule=capacityRule(studio,deliveryDate)
  if(rule.closed) throw new BusinessError(`${deliveryDate} 工作室已设置为不接单${rule.note?`：${rule.note}`:''}`,'STUDIO_CLOSED')
  const orders=await safeGetAll(COLLECTIONS.orders)
  const active=orders.filter((item)=>text(item._id)!==excludeOrderId && text(item.assignedStudioId)===text(studio._id) && text(item.deliveryDate||item.requestedDeliveryDate)===deliveryDate && !['cancelled','refunded'].includes(text(item.status)))
  const usedUnits=active.reduce((sum,item)=>sum+orderCapacityUnits(item),0)
  const units=orderCapacityUnits(order)
  if(active.length+1>rule.maxOrders || usedUnits+units>rule.maxUnits) {
    throw new BusinessError(`${deliveryDate} 产能不足：剩余 ${Math.max(0,rule.maxOrders-active.length)} 单 / ${Math.max(0,rule.maxUnits-usedUnits)} 产能单位`,'CAPACITY_EXCEEDED')
  }
  return {rule,units,usedOrders:active.length,usedUnits}
}

async function studioAcceptOrder(event, adminContext) {
  const id=text(event.id); const studioId=text(event.studioId)
  if(!studioId) throw new BusinessError('请选择履约工作室')
  const order=await requireOrder(id); assertOrderStatus(order,['pendingConfirm','pendingPayment','making'])
  const studio=firstDocument(await db.collection(COLLECTIONS.studios).doc(studioId).get())
  if(!studio || studio.enabled===false) throw new BusinessError('工作室不存在或已停用')
  const deliveryDate=validateDeliveryScheduleDate(event.deliveryDate || order.requestedDeliveryDate || order.deliveryDate)
  const deliverySlot=validateDeliveryScheduleSlot(event.deliverySlot || order.requestedDeliverySlot || order.deliverySlot)
  const capacity=await assertStudioCapacity({_id:studioId,...studio},deliveryDate,order,id)
  const nextStatus = text(order.status) === 'making' ? 'making' : 'pendingPayment'
  await db.collection(COLLECTIONS.orders).doc(id).update({
    status:nextStatus,statusLabel:ORDER_STATUS_META[nextStatus].label,
    assignedStudioId:studioId,assignedStudioName:text(studio.name),capacityUnits:capacity.units,
    deliveryDate,deliverySlot,confirmedDeliveryDate:deliveryDate,confirmedDeliverySlot:deliverySlot,
    deliveryScheduleStatus:'confirmed',deliveryScheduleStatusLabel:'时间已确认',deliveryConfirmed:true,
    deliveryFeePending:false,amountPending:false,
    merchantNote:text(event.note),confirmedAt:order.confirmedAt||new Date(),updatedAt:new Date(),updatedBy:adminContext.identity.uid
  })
  await appendOrderLog({orderId:id,orderNo:order.orderNo,status:nextStatus,title:'工作室已接单',note:`${text(studio.name)} · ${deliveryDate} ${deliverySlot} · 占用 ${capacity.units} 个产能单位`,adminContext})
  return {_id:id,status:nextStatus,assignedStudioId:studioId,capacityUnits:capacity.units,totalAmountFen:integer(order.totalAmountFen)}
}

async function studioStartMaking(event, adminContext) {
  const id=text(event.id); const order=await requireOrder(id)
  assertOrderStatus(order,['pendingPayment','making'])
  if(!text(order.assignedStudioId)) throw new BusinessError('订单尚未分配工作室')
  if(text(order.status)==='making') return {_id:id,status:'making'}
  await db.collection(COLLECTIONS.orders).doc(id).update({status:'making',statusLabel:ORDER_STATUS_META.making.label,paymentStatus:text(event.paymentStatus,'offlinePaid'),paidAt:new Date(),makingAt:new Date(),updatedAt:new Date(),updatedBy:adminContext.identity.uid})
  await appendOrderLog({orderId:id,orderNo:order.orderNo,status:'making',title:'工作室确认开始制作',note:text(event.note,'款项与制作安排已确认'),adminContext})
  return {_id:id,status:'making'}
}

async function dashboard() {
  const [products, banners, campaigns, studios, calendarOverrides, orders, users, quoteRequests] = await Promise.all([
    safeGetAll(COLLECTIONS.products),
    safeGetAll(COLLECTIONS.banners),
    safeGetAll(COLLECTIONS.festivalCampaigns),
    safeGetAll(COLLECTIONS.studios),
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
    onSaleProducts: products.filter((item) => productWindowStatus(item).active).length,
    soldOutProducts: products.filter((item) => number(item.stock) === 0).length,
    lowStockCount: products.filter((item) => number(item.stock) <= 5).length,
    featuredProducts: products.filter((item) => item.featured === true).length,
    enabledBanners: banners.filter((item) => item.enabled === true).length,
    festivalCampaignCount: campaigns.length,
    activeFestivalCampaignCount: campaigns.filter((item) => campaignView(item, products).statusTone === 'success').length,
    studioCount: studios.length,
    calendarEventCount: mergeCalendarEvents(calendarOverrides)
      .filter((item) => item.enabled !== false).length,
    customerCount: users.length,
    orderCount: orders.length,
    pendingConfirmOrders: 0,
    pendingPaymentOrders: orders.filter((item) => ['pendingConfirm', 'pendingPayment'].includes(item.status)).length,
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
      case 'listFestivalCampaigns': return success(await listFestivalCampaigns())
      case 'saveFestivalCampaign': return success(await saveFestivalCampaign(event, adminContext))
      case 'deleteFestivalCampaign': return success(await deleteFestivalCampaign(event, adminContext))
      case 'listStudios': return success(await listStudios())
      case 'saveStudio': return success(await saveStudio(event, adminContext))
      case 'deleteStudio': return success(await deleteStudio(event))
      case 'listStudioOrders': return success(await listStudioOrders(event))
      case 'studioAcceptOrder': return success(await studioAcceptOrder(event, adminContext))
      case 'studioStartMaking': return success(await studioStartMaking(event, adminContext))
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
