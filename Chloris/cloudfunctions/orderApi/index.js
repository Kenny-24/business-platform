const crypto = require('crypto')
const https = require('https')
const querystring = require('querystring')
const cloud = require('wx-server-sdk')
const {
  DELIVERY_METHODS,
  DELIVERY_SLOTS,
  STATUS_META
} = require('./order-config')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

const COLLECTIONS = {
  users: 'users',
  addresses: 'addresses',
  products: 'products',
  festivalCampaigns: 'festivalCampaigns',
  orders: 'orders',
  orderLogs: 'orderLogs',
  studios: 'studios'
}

class BusinessError extends Error {
  constructor(message, code = 'BUSINESS_ERROR') {
    super(message)
    this.code = code
  }
}

function success(data = null) {
  return {
    ok: true,
    data
  }
}

function failure(error) {
  console.error('[orderApi]', error)

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
  return Number.isFinite(parsed)
    ? parsed
    : fallback
}

function integer(value, fallback = 0) {
  return Math.max(0, Math.round(number(value, fallback)))
}

function stringArray(value) {
  if (!Array.isArray(value)) return []

  return [...new Set(
    value
      .map((item) => text(item))
      .filter(Boolean)
  )]
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`
}

function createUserId(openid) {
  const digest = crypto
    .createHash('sha256')
    .update(openid)
    .digest('hex')
    .slice(0, 28)

  return `user_${digest}`
}

function createOrderNo() {
  const now = new Date()
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ]

  const random = crypto
    .randomInt(1000, 10000)
    .toString()

  return `HY${parts.join('')}${random}`
}

function isMissingCollectionError(error) {
  const message = String(error && (error.message || error))

  return (
    message.includes('not exist') ||
    message.includes('does not exist') ||
    message.includes('不存在')
  )
}

async function assertCollectionExists(collectionName) {
  try {
    await db
      .collection(collectionName)
      .limit(1)
      .get()
  } catch (error) {
    if (isMissingCollectionError(error)) {
      throw new BusinessError(
        `数据库集合 ${collectionName} 不存在，请先在云开发控制台创建该集合`,
        'COLLECTION_NOT_FOUND'
      )
    }

    throw error
  }
}

function getIdentity() {
  const context = cloud.getWXContext()
  const openid = text(context.OPENID)

  if (!openid) {
    throw new BusinessError(
      '无法识别当前微信用户，请退出游客模式后重试',
      'UNAUTHORIZED'
    )
  }

  return {
    openid,
    appid: text(context.APPID),
    unionid: text(context.UNIONID),
    userId: createUserId(openid)
  }
}

function dateValue(value) {
  if (!value) return 0

  if (value instanceof Date) {
    return value.getTime()
  }

  if (typeof value === 'object' && value.$date) {
    return new Date(value.$date).getTime()
  }

  let source = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(source)) source = `${source.replace(' ', 'T')}+08:00`
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(source)) source = `${source}+08:00`
  const parsed = new Date(source).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function isoDate(value) {
  const timestamp = dateValue(value)
  return timestamp
    ? new Date(timestamp).toISOString()
    : ''
}

function formatFen(value) {
  const yuan = integer(value) / 100

  if (Number.isInteger(yuan)) {
    return String(yuan)
  }

  return yuan
    .toFixed(2)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
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

async function getDocument(collectionName, id) {
  try {
    const result = await db
      .collection(collectionName)
      .doc(id)
      .get()

    return result.data || null
  } catch (error) {
    if (
      String(error.errCode || '').includes('DOCUMENT_NOT_FOUND') ||
      String(error.message || '').includes('not exist') ||
      String(error.message || '').includes('不存在')
    ) {
      return null
    }

    throw error
  }
}

async function ensureUser(identity) {
  await assertCollectionExists(COLLECTIONS.users)

  let user = await getDocument(
    COLLECTIONS.users,
    identity.userId
  )

  if (!user) {
    const document = {
      openid: identity.openid,
      appid: identity.appid,
      unionid: identity.unionid,
      nickname: 'Chloris 用户',
      avatarFileId: '',
      memberLevel: 'normal',
      memberLevelLabel: '普通会员',
      enabled: true,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }

    await db
      .collection(COLLECTIONS.users)
      .doc(identity.userId)
      .set({
        data: document
      })

    user = {
      _id: identity.userId,
      ...document
    }
  }

  if (user.enabled === false) {
    throw new BusinessError(
      '当前账号已被停用，请联系Chloris 客服',
      'USER_DISABLED'
    )
  }

  return {
    ...user,
    _id: user._id || identity.userId
  }
}


function deliveryById(id) {
  return (
    DELIVERY_METHODS.find((item) => item.id === id) ||
    DELIVERY_METHODS[0]
  )
}

function sanitizeCartItems(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new BusinessError('购物车中没有可结算商品')
  }

  if (items.length > 20) {
    throw new BusinessError('单个订单最多包含20种商品')
  }

  const merged = new Map()

  for (const item of items) {
    const productId = text(item && (item.productId || item.id || item._id))
    const quantity = Math.max(1, Math.min(99, integer(item && item.quantity, 1)))

    if (!productId) continue

    merged.set(
      productId,
      Math.min(99, (merged.get(productId) || 0) + quantity)
    )
  }

  if (!merged.size) {
    throw new BusinessError('购物车中没有可结算商品')
  }

  return [...merged.entries()].map(([productId, quantity]) => ({
    productId,
    quantity
  }))
}

async function resolveFileUrls(fileIds) {
  const ids = [...new Set(
    fileIds
      .map((item) => text(item))
      .filter((item) => item.startsWith('cloud://'))
  )]

  const map = {}
  if (!ids.length) return map

  try {
    const result = await cloud.getTempFileURL({
      fileList: ids
    })

    for (const item of result.fileList || []) {
      if (item.fileID && item.tempFileURL) {
        map[item.fileID] = item.tempFileURL
      }
    }
  } catch (error) {
    console.warn('[orderApi] 商品图片临时地址生成失败：', error)
  }

  return map
}

async function buildProductSnapshots(rawItems) {
  await assertCollectionExists(COLLECTIONS.products)

  const items = sanitizeCartItems(rawItems)
  const snapshots = []

  for (const requested of items) {
    const product = await getDocument(
      COLLECTIONS.products,
      requested.productId
    )

    const campaignId = text(product && product.festivalCampaignId)
    let campaign = null
    if (campaignId) {
      await assertCollectionExists(COLLECTIONS.festivalCampaigns)
      campaign = await getDocument(COLLECTIONS.festivalCampaigns, campaignId)
    }
    const campaignType = text(campaign && campaign.type)
    const isPreorderCampaign = ['valentine', 'festival'].includes(campaignType)
    const isLimitedCampaign = ['limited', 'seasonal'].includes(campaignType)
    const effectiveProduct = {
      ...(product || {}),
      salesMode: isPreorderCampaign ? 'preorder' : isLimitedCampaign ? 'spot' : text(product && product.salesMode, 'spot'),
      limitedTimeEnabled: isLimitedCampaign ? true : product && product.limitedTimeEnabled === true,
      saleStartAt: isLimitedCampaign ? text(campaign && campaign.preSaleStartAt) : text(product && product.saleStartAt),
      saleEndAt: isLimitedCampaign ? text(campaign && (campaign.preSaleEndAt || campaign.reservationDeadlineAt)) : text(product && product.saleEndAt),
      preorderStartAt: isPreorderCampaign ? text(campaign && campaign.preSaleStartAt) : text(product && product.preorderStartAt),
      preorderEndAt: isPreorderCampaign ? text(campaign && campaign.preSaleEndAt) : text(product && product.preorderEndAt),
      deliveryStartDate: isPreorderCampaign ? text(campaign && campaign.deliveryStartDate) : text(product && product.deliveryStartDate),
      deliveryEndDate: isPreorderCampaign ? text(campaign && campaign.deliveryEndDate) : text(product && product.deliveryEndDate),
      reservationDeadlineAt: isPreorderCampaign ? text(campaign && campaign.reservationDeadlineAt) : text(product && product.reservationDeadlineAt)
    }
    const now = Date.now()
    const saleStart = dateValue(effectiveProduct.saleStartAt || effectiveProduct.preorderStartAt)
    const saleEnd = dateValue(effectiveProduct.saleEndAt || effectiveProduct.preorderEndAt || effectiveProduct.reservationDeadlineAt)
    const campaignStart = dateValue(campaign && campaign.preSaleStartAt)
    const campaignEnd = dateValue(campaign && (campaign.preSaleEndAt || campaign.reservationDeadlineAt))
    if (
      !product ||
      product.onSale !== true ||
      (campaignId && (!campaign || campaign.enabled === false)) ||
      (campaignStart && now < campaignStart) ||
      (campaignEnd && now > campaignEnd) ||
      (saleStart && now < saleStart) ||
      (saleEnd && now > saleEnd)
    ) {
      throw new BusinessError(
        '部分商品已经下架或不在预售时间内，请返回购物车刷新后重试',
        'PRODUCT_OFF_SALE'
      )
    }

    const stock = integer(effectiveProduct.stock)

    if (stock < requested.quantity) {
      throw new BusinessError(
        `${text(product.name, '商品')}库存仅剩${stock}${text(product.unit, '件')}`,
        'INSUFFICIENT_STOCK'
      )
    }

    const unitPriceFen = integer(product.priceFen)
    const subtotalFen = unitPriceFen * requested.quantity

    snapshots.push({
      productId: requested.productId,
      name: text(product.name),
      subtitle: text(product.subtitle),
      unit: text(product.unit, '件'),
      quantity: requested.quantity,
      unitPriceFen,
      subtotalFen,
      coverFileId: text(product.coverFileId),
      salesMode: ['spot','preorder'].includes(text(effectiveProduct.salesMode)) ? text(effectiveProduct.salesMode) : 'spot',
      festivalCampaignId: campaignId,
      campaignType,
      deliveryStartDate: text(effectiveProduct.deliveryStartDate),
      deliveryEndDate: text(effectiveProduct.deliveryEndDate),
      reservationDeadlineAt: text(effectiveProduct.reservationDeadlineAt),
      preorderStartAt: isoDate(effectiveProduct.preorderStartAt),
      preorderEndAt: isoDate(effectiveProduct.preorderEndAt),
      reservationQuota: integer(effectiveProduct.reservationQuota),
      productionUnits: Math.max(1, integer(effectiveProduct.productionUnits, 1)),
      studioId: text(effectiveProduct.studioId)
    })
  }

  const urlMap = await resolveFileUrls(
    snapshots.map((item) => item.coverFileId)
  )

  return snapshots.map((item) => ({
    ...item,
    imageUrl: urlMap[item.coverFileId] || '',
    unitPriceText: formatFen(item.unitPriceFen),
    subtotalText: formatFen(item.subtotalFen)
  }))
}

function chinaDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

function addChinaDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00+08:00`)
  date.setUTCDate(date.getUTCDate() + days)
  return chinaDateString(date)
}

function deliveryConstraints(items = []) {
  const earliestDate = new Date(Date.now() + 2 * 60 * 60 * 1000)
  const preorderItems = items.filter((item) => text(item.salesMode) === 'preorder')
  let minDate = chinaDateString(earliestDate)
  const hasSameDaySlot = DELIVERY_SLOTS.some((slot) => deliverySlotStartAt(minDate, slot) >= earliestDate.getTime())
  if (!hasSameDaySlot) minDate = addChinaDays(minDate, 1)
  let maxDate = addChinaDays(chinaDateString(), preorderItems.length ? 365 : 30)

  for (const item of preorderItems) {
    const start = text(item.deliveryStartDate)
    const end = text(item.deliveryEndDate)
    if (start && start > minDate) minDate = start
    if (end && end < maxDate) maxDate = end
  }

  if (minDate > maxDate) {
    throw new BusinessError('所选预约商品的可配送日期没有交集，请分开下单', 'DELIVERY_RANGE_CONFLICT')
  }

  return {
    earliestAt: earliestDate.toISOString(),
    minDate,
    maxDate,
    preorder: preorderItems.length > 0,
    leadTimeMinutes: 120
  }
}

function deliverySlotStartAt(dateString, slot) {
  const start = text(slot).split('-')[0]
  if (!/^\d{2}:\d{2}$/.test(start)) return 0
  return new Date(`${dateString}T${start}:00+08:00`).getTime()
}

function formatChinaDateTime(value) {
  const timestamp = dateValue(value)
  if (!timestamp) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(timestamp))
}

function validateDeliveryAgainstProducts(deliveryDate, deliverySlot, items = []) {
  const constraints = deliveryConstraints(items)
  if (deliveryDate < constraints.minDate || deliveryDate > constraints.maxDate) {
    const label = constraints.minDate === constraints.maxDate
      ? constraints.minDate
      : `${constraints.minDate} 至 ${constraints.maxDate}`
    throw new BusinessError(`该订单可选择的配送日期为 ${label}`, 'INVALID_DELIVERY_DATE')
  }

  const slotStartAt = deliverySlotStartAt(deliveryDate, deliverySlot)
  const earliestAt = dateValue(constraints.earliestAt)
  if (!slotStartAt || slotStartAt < earliestAt) {
    throw new BusinessError(
      `最早可选择下单后两小时的配送时段（当前最早约为 ${formatChinaDateTime(constraints.earliestAt)}）`,
      'DELIVERY_TOO_SOON'
    )
  }
  return constraints
}

const RESERVATION_ACTIVE_STATUSES = new Set([
  'pendingConfirm',
  'pendingPayment',
  'making',
  'delivering',
  'completed',
  'refundPending'
])

async function validateReservationCapacity(items = []) {
  const preorderItems = items.filter((item) => text(item.salesMode) === 'preorder')
  if (!preorderItems.length) return

  const campaignIds = [...new Set(preorderItems.map((item) => text(item.festivalCampaignId)).filter(Boolean))]
  if (campaignIds.length) await assertCollectionExists(COLLECTIONS.festivalCampaigns)

  const [orders, campaigns] = await Promise.all([
    safeGetAll(COLLECTIONS.orders),
    campaignIds.length ? safeGetAll(COLLECTIONS.festivalCampaigns) : Promise.resolve([])
  ])
  const activeOrders = orders.filter((order) => RESERVATION_ACTIVE_STATUSES.has(text(order.status)))

  for (const item of preorderItems) {
    const quota = integer(item.reservationQuota)
    if (!quota) continue
    const reserved = activeOrders.reduce((sum, order) => {
      const row = (Array.isArray(order.items) ? order.items : []).find((entry) => text(entry.productId) === text(item.productId))
      return sum + (row ? Math.max(1, integer(row.quantity, 1)) : 0)
    }, 0)
    if (reserved + Math.max(1, integer(item.quantity, 1)) > quota) {
      throw new BusinessError(`${item.name}预约名额不足，当前最多还可预订 ${Math.max(0, quota - reserved)}${item.unit || '件'}`, 'PRODUCT_RESERVATION_FULL')
    }
  }

  const campaignMap = new Map(campaigns.map((campaign) => [text(campaign._id), campaign]))
  const now = Date.now()
  for (const campaignId of campaignIds) {
    const campaign = campaignMap.get(campaignId)
    if (!campaign || campaign.enabled === false) {
      throw new BusinessError('关联的节日预售活动已停用，请刷新商品后重试', 'CAMPAIGN_DISABLED')
    }
    const start = dateValue(campaign.preSaleStartAt)
    const end = dateValue(campaign.preSaleEndAt || campaign.reservationDeadlineAt)
    if ((start && now < start) || (end && now > end)) {
      throw new BusinessError(`${text(campaign.name, '节日预售')}当前不在可预订时间内`, 'CAMPAIGN_CLOSED')
    }

    const campaignOrders = activeOrders.filter((order) => (
      stringArray(order.festivalCampaignIds).includes(campaignId) ||
      (Array.isArray(order.items) ? order.items : []).some((entry) => text(entry.festivalCampaignId) === campaignId)
    ))
    const requestedItems = preorderItems.filter((item) => text(item.festivalCampaignId) === campaignId)
    const requestedUnits = requestedItems.reduce((sum, item) => (
      sum + Math.max(1, integer(item.productionUnits, 1)) * Math.max(1, integer(item.quantity, 1))
    ), 0)
    const usedUnits = campaignOrders.reduce((sum, order) => (
      sum + (Array.isArray(order.items) ? order.items : [])
        .filter((entry) => text(entry.festivalCampaignId) === campaignId)
        .reduce((inner, entry) => inner + Math.max(1, integer(entry.productionUnits, 1)) * Math.max(1, integer(entry.quantity, 1)), 0)
    ), 0)
    const maxOrders = integer(campaign.maxOrders)
    const maxUnits = integer(campaign.maxUnits)
    if (maxOrders && campaignOrders.length + 1 > maxOrders) {
      throw new BusinessError(`${text(campaign.name, '节日预售')}订单名额已满`, 'CAMPAIGN_ORDER_LIMIT')
    }
    if (maxUnits && usedUnits + requestedUnits > maxUnits) {
      throw new BusinessError(`${text(campaign.name, '节日预售')}制作产能已满`, 'CAMPAIGN_UNIT_LIMIT')
    }
  }
}

function sanitizeDeliveryDate(value) {
  const normalized = text(value)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new BusinessError('请选择配送日期')
  }

  const selectedTime = new Date(`${normalized}T00:00:00+08:00`).getTime()
  if (!Number.isFinite(selectedTime)) {
    throw new BusinessError('配送日期格式不正确')
  }

  const today = chinaDateString()
  const maxDate = addChinaDays(today, 365)

  if (normalized < today) {
    throw new BusinessError('配送日期不能早于今天')
  }

  if (normalized > maxDate) {
    throw new BusinessError('当前仅支持选择未来365天内的日期')
  }

  return normalized
}

function sanitizeDeliverySlot(value) {
  const normalized = text(value)

  if (!DELIVERY_SLOTS.includes(normalized)) {
    throw new BusinessError('请选择有效的配送时间段')
  }

  return normalized
}

function addressSnapshot(address) {
  return {
    addressId: text(address._id),
    receiverName: text(address.receiverName),
    phone: text(address.phone),
    province: text(address.province),
    city: text(address.city),
    district: text(address.district),
    detail: text(address.detail),
    locationName: text(address.locationName),
    locationAddress: text(address.locationAddress),
    latitude: Number.isFinite(Number(address.latitude))
      ? Number(address.latitude)
      : null,
    longitude: Number.isFinite(Number(address.longitude))
      ? Number(address.longitude)
      : null,
    label: text(address.label, '家'),
    fullAddress: [
      text(address.province),
      text(address.city),
      text(address.district),
      text(address.detail)
    ].filter(Boolean).join('')
  }
}

async function resolveAddress(identity, deliveryMethodId, addressId, required) {
  if (deliveryMethodId === 'pickup') {
    return null
  }

  if (!addressId) {
    if (required) {
      throw new BusinessError('请选择收货地址')
    }

    return null
  }

  await assertCollectionExists(COLLECTIONS.addresses)

  const address = await getDocument(
    COLLECTIONS.addresses,
    addressId
  )

  if (!address || address.userId !== identity.userId) {
    throw new BusinessError('收货地址不存在', 'ADDRESS_NOT_FOUND')
  }

  return addressSnapshot(address)
}

function pickupLocationView(studio = {}) {
  return {
    id: text(studio._id),
    studioId: text(studio._id),
    name: text(studio.pickupName || studio.name, 'Chloris 合作工作室'),
    address: text(studio.pickupAddress || studio.address),
    phone: text(studio.pickupPhone || studio.phone),
    contactName: text(studio.contactName),
    businessHours: text(studio.pickupHours, '请按预约时间到店取货'),
    notice: text(studio.pickupNotice, '到店后请向工作人员出示订单号'),
    latitude: Number.isFinite(Number(studio.latitude)) ? Number(studio.latitude) : null,
    longitude: Number.isFinite(Number(studio.longitude)) ? Number(studio.longitude) : null
  }
}

async function listPickupLocations() {
  const studios = await safeGetAll(COLLECTIONS.studios)
  return studios
    .filter((studio) => studio.enabled !== false && studio.supportsPickup !== false)
    .map(pickupLocationView)
    .filter((studio) => studio.id && studio.address)
    .sort((a, b) => {
      const sourceA = studios.find((row) => text(row._id) === a.id) || {}
      const sourceB = studios.find((row) => text(row._id) === b.id) || {}
      return integer(sourceB.sort, 100) - integer(sourceA.sort, 100)
    })
}

async function resolvePickupLocation(deliveryMethodId, pickupLocationId, required) {
  if (deliveryMethodId !== 'pickup') return null

  const locations = await listPickupLocations()
  const selected = locations.find((item) => item.id === text(pickupLocationId)) || locations[0] || null

  if (!selected && required) {
    throw new BusinessError('暂时没有可用的自提门店，请选择配送到家')
  }

  return selected
}

async function buildPreview(event, identity, requireAddress = false) {
  const user = await ensureUser(identity)
  const items = await buildProductSnapshots(event.items)
  const constraints = deliveryConstraints(items)
  const deliveryMethod = deliveryById(text(event.deliveryMethodId, 'delivery'))
  const address = await resolveAddress(
    identity,
    deliveryMethod.id,
    text(event.addressId),
    requireAddress
  )
  const pickupLocation = await resolvePickupLocation(
    deliveryMethod.id,
    text(event.pickupLocationId),
    requireAddress
  )

  const goodsAmountFen = items.reduce(
    (sum, item) => sum + item.subtotalFen,
    0
  )
  const deliveryFeeFen = integer(deliveryMethod.feeFen)
  const discountFen = 0
  const totalAmountFen = Math.max(
    0,
    goodsAmountFen +
      deliveryFeeFen -
      discountFen
  )

  return {
    deliveryConstraints: constraints,
    deliveryConstraintsText: constraints.preorder
      ? `预约商品可选 ${constraints.minDate}${constraints.maxDate && constraints.maxDate !== constraints.minDate ? ` 至 ${constraints.maxDate}` : ''} ${deliveryMethod.id === 'pickup' ? '到店取货' : '配送'}`
      : deliveryMethod.id === 'pickup'
        ? '现货商品最早可预约下单后两小时到店取货'
        : '现货商品最早可选下单后两小时的配送时段',
    user: {
      _id: identity.userId,
      nickname: text(user.nickname, 'Chloris 用户'),
    },
    items,
    address,
    pickupLocation,
    deliveryMethod: {
      ...deliveryMethod,
      feeText: deliveryFeeFen > 0
        ? `¥${formatFen(deliveryFeeFen)}`
        : '免费'
    },
    deliveryDate: text(event.deliveryDate),
    deliverySlot: text(event.deliverySlot),
    cardMessage: text(event.cardMessage).slice(0, 120),
    buyerMessage: text(event.buyerMessage).slice(0, 200),
    amounts: {
      goodsAmountFen,
      deliveryFeeFen,
      discountFen,
      totalAmountFen,
      goodsAmountText: formatFen(goodsAmountFen),
      deliveryFeeText: formatFen(deliveryFeeFen),
      discountText: formatFen(discountFen),
      totalAmountText: formatFen(totalAmountFen),
      amountPending: false
    }
  }
}

async function getCheckoutOptions(identity, event = {}) {
  await ensureUser(identity)

  return {
    deliveryMethods: DELIVERY_METHODS,
    pickupLocations: await listPickupLocations(),
    deliverySlots: DELIVERY_SLOTS,
    deliveryConstraints: Array.isArray(event.items) && event.items.length ? deliveryConstraints(await buildProductSnapshots(event.items)) : { earliestAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), minDate: chinaDateString(new Date(Date.now() + 2 * 60 * 60 * 1000)), maxDate: addChinaDays(chinaDateString(), 30) },
    maxDeliveryDays: 365,
  }
}

async function previewOrder(event, identity) {
  return buildPreview(event, identity, false)
}

async function writeOrderLog({
  orderId,
  orderNo,
  status,
  title,
  note,
  operatorType,
  operatorId
}) {
  try {
    await assertCollectionExists(COLLECTIONS.orderLogs)

    await db
      .collection(COLLECTIONS.orderLogs)
      .add({
        data: {
          orderId,
          orderNo,
          status,
          title,
          note: text(note),
          operatorType,
          operatorId,
          createdAt: db.serverDate()
        }
      })
  } catch (error) {
    console.error('[orderApi] 订单日志写入失败：', error)
  }
}

async function createOrder(event, identity) {
  await Promise.all([
    assertCollectionExists(COLLECTIONS.orders),
    assertCollectionExists(COLLECTIONS.orderLogs)
  ])

  const preview = await buildPreview(event, identity, true)
  const deliveryDate = sanitizeDeliveryDate(event.deliveryDate)
  const deliverySlot = sanitizeDeliverySlot(event.deliverySlot)
  validateDeliveryAgainstProducts(deliveryDate, deliverySlot, preview.items)
  await validateReservationCapacity(preview.items)
  const orderId = createId('order')
  const orderNo = createOrderNo()
  const now = new Date()

  const document = {
    orderNo,
    userId: identity.userId,
    customerNickname: preview.user.nickname,
    status: 'pendingPayment',
    statusLabel: STATUS_META.pendingPayment.label,
    paymentStatus: 'unpaid',
    deliveryMethodId: preview.deliveryMethod.id,
    deliveryMethodName: preview.deliveryMethod.name,
    pickupLocationId: preview.pickupLocation && preview.pickupLocation.id || '',
    pickupLocation: preview.pickupLocation,
    deliveryFeePending: false,
    deliveryDate,
    deliverySlot,
    requestedDeliveryDate: deliveryDate,
    requestedDeliverySlot: deliverySlot,
    requestedDeliveryNote: '',
    deliveryScheduleStatus: 'confirmed',
    deliveryScheduleStatusLabel: '时间已确认',
    deliveryConfirmed: true,
    address: preview.address,
    cardMessage: preview.cardMessage,
    buyerMessage: preview.buyerMessage,
    confirmedDeliveryDate: deliveryDate,
    confirmedDeliverySlot: deliverySlot,
    deliveryConfirmedAt: db.serverDate(),
    merchantNote: '',
    salesMode: preview.items.some((item) => item.salesMode === 'preorder') ? 'preorder' : 'spot',
    festivalCampaignIds: [...new Set(preview.items.map((item) => item.festivalCampaignId).filter(Boolean))],
    productionUnits: preview.items.reduce((sum, item) => sum + Math.max(1, integer(item.productionUnits, 1)) * Math.max(1, integer(item.quantity, 1)), 0),
    suggestedStudioId: preview.pickupLocation && preview.pickupLocation.id
      ? preview.pickupLocation.id
      : preview.items.map((item) => item.studioId).find(Boolean) || '',
    items: preview.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      subtitle: item.subtitle,
      unit: item.unit,
      quantity: item.quantity,
      unitPriceFen: item.unitPriceFen,
      subtotalFen: item.subtotalFen,
      coverFileId: item.coverFileId,
      salesMode: item.salesMode,
      festivalCampaignId: item.festivalCampaignId,
      deliveryStartDate: item.deliveryStartDate,
      deliveryEndDate: item.deliveryEndDate,
      reservationDeadlineAt: item.reservationDeadlineAt,
      reservationQuota: item.reservationQuota,
      productionUnits: item.productionUnits,
      studioId: item.studioId
    })),
    goodsAmountFen: preview.amounts.goodsAmountFen,
    deliveryFeeFen: preview.amounts.deliveryFeeFen,
    discountFen: preview.amounts.discountFen,
    totalAmountFen: preview.amounts.totalAmountFen,
    amountPending: false,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
    submittedAt: db.serverDate(),
    confirmedAt: db.serverDate()
  }

  await db
    .collection(COLLECTIONS.orders)
    .doc(orderId)
    .set({
      data: document
    })

  await writeOrderLog({
    orderId,
    orderNo,
    status: 'pendingPayment',
    title: '订单已创建，等待付款',
    note: `${preview.deliveryMethod.id === 'pickup' ? '自提' : '配送'}时间：${deliveryDate} ${deliverySlot}；无需商家确认，可直接付款`,
    operatorType: 'customer',
    operatorId: identity.userId
  })

  return orderView({
    _id: orderId,
    ...document,
    createdAt: now,
    updatedAt: now,
    submittedAt: now
  }, {})
}

function statusMeta(status) {
  return STATUS_META[status] || {
    label: status || '未知状态',
    description: ''
  }
}

function maskPhone(phone) {
  const value = text(phone)
  if (value.length !== 11) return value
  return `${value.slice(0, 3)}****${value.slice(-4)}`
}

function normalizeDeliveryScheduleStatus(order = {}) {
  const direct = text(order.deliveryScheduleStatus)
  if (['pendingMerchantConfirm', 'customerConfirmationRequired', 'adjustmentRejected'].includes(direct)) return 'confirmed'
  if (direct) return direct
  if (order.deliveryConfirmed === true || text(order.confirmedDeliveryDate)) return 'confirmed'
  if (text(order.proposedDeliveryDate)) return 'customerConfirmationRequired'
  if (text(order.requestedDeliveryDate) || text(order.deliveryDate)) return 'confirmed'
  return order.sourceType === 'quoteRequest' ? 'pendingMerchantConfirm' : 'notRequired'
}

function deliveryScheduleMeta(status) {
  const map = {
    notRequired: { label: '无需二次确认', description: '' },
    pendingMerchantConfirm: { label: '时间已选定', description: '将按顾客选择的配送时间安排履约' },
    customerConfirmationRequired: { label: '时间已选定', description: '将按顾客选择的配送时间安排履约' },
    confirmed: { label: '时间已确认', description: '最终配送时间已经确认' },
    adjustmentRejected: { label: '时间已选定', description: '将按顾客选择的配送时间安排履约' }
  }
  return map[status] || { label: status || '待付款', description: '' }
}

function orderView(order, urlMap) {
  const rawStatus = text(order.status, 'pendingPayment')
  const status = rawStatus === 'pendingConfirm' ? 'pendingPayment' : rawStatus
  const meta = statusMeta(status)
  const items = (Array.isArray(order.items) ? order.items : []).map((item) => ({
    ...item,
    imageUrl: urlMap[text(item.coverFileId)] || '',
    unitPriceText: formatFen(item.unitPriceFen),
    subtotalText: formatFen(item.subtotalFen)
  }))
  const deliveryScheduleStatus = normalizeDeliveryScheduleStatus(order)
  const deliverySchedule = deliveryScheduleMeta(deliveryScheduleStatus)
  const isQuoteOrder = text(order.sourceType) === 'quoteRequest'
  const isPickup = text(order.deliveryMethodId) === 'pickup'
  const statusLabel = isPickup && status === 'making'
    ? '备货中'
    : isPickup && status === 'delivering'
      ? '待取货'
      : meta.label
  const statusDescription = status === 'pendingPayment'
    ? '订单已创建，请完成付款'
    : isPickup && status === 'making'
      ? '门店正在准备你的商品'
      : isPickup && status === 'delivering'
        ? '商品已备妥，请按预约时间到店取货'
        : meta.description

  return {
    _id: text(order._id),
    orderNo: text(order.orderNo),
    sourceType: text(order.sourceType),
    quoteRequestId: text(order.quoteRequestId),
    quoteRequestNo: text(order.quoteRequestNo),
    status,
    statusLabel,
    statusDescription,
    paymentStatus: text(order.paymentStatus, 'unpaid'),
    customerNickname: text(order.customerNickname, 'Chloris 用户'),
    deliveryMethodId: text(order.deliveryMethodId),
    deliveryMethodName: text(order.deliveryMethodName),
    pickupLocationId: text(order.pickupLocationId),
    pickupLocation: order.pickupLocation || null,
    deliveryFeePending: order.deliveryFeePending === true,
    deliveryDate: text(order.deliveryDate),
    deliverySlot: text(order.deliverySlot),
    requestedDeliveryDate: text(order.requestedDeliveryDate) || text(order.deliveryDate),
    requestedDeliverySlot: text(order.requestedDeliverySlot) || text(order.deliverySlot),
    requestedDeliveryNote: text(order.requestedDeliveryNote),
    confirmedDeliveryDate: text(order.confirmedDeliveryDate),
    confirmedDeliverySlot: text(order.confirmedDeliverySlot),
    proposedDeliveryDate: text(order.proposedDeliveryDate),
    proposedDeliverySlot: text(order.proposedDeliverySlot),
    deliveryAdjustmentNote: text(order.deliveryAdjustmentNote),
    deliveryScheduleStatus,
    deliveryScheduleStatusLabel: deliverySchedule.label,
    deliveryScheduleStatusDescription: deliverySchedule.description,
    deliveryConfirmed: order.deliveryConfirmed === true || deliveryScheduleStatus === 'confirmed',
    logisticsCompanyCode: text(order.logisticsCompanyCode),
    logisticsCompanyName: text(order.logisticsCompanyName),
    trackingNo: text(order.trackingNo),
    logisticsState: text(order.logisticsState),
    logisticsStateLabel: text(order.logisticsStateLabel),
    logisticsUpdatedAt: isoDate(order.logisticsUpdatedAt),
    logisticsTrace: Array.isArray(order.logisticsTrace) ? order.logisticsTrace : [],
    logisticsQueryError: text(order.logisticsQueryError),
    canRespondDeliverySchedule: false,
    address: order.address
      ? {
          ...order.address,
          phoneMasked: maskPhone(order.address.phone)
        }
      : null,
    cardMessage: text(order.cardMessage),
    buyerMessage: text(order.buyerMessage),
    merchantNote: text(order.merchantNote),
    items,
    itemCount: items.reduce((sum, item) => sum + integer(item.quantity), 0),
    amounts: {
      goodsAmountFen: integer(order.goodsAmountFen),
      deliveryFeeFen: integer(order.deliveryFeeFen),
      discountFen: integer(order.discountFen),
      totalAmountFen: integer(order.totalAmountFen),
      goodsAmountText: formatFen(order.goodsAmountFen),
      deliveryFeeText: formatFen(order.deliveryFeeFen),
      discountText: formatFen(order.discountFen),
      totalAmountText: formatFen(order.totalAmountFen),
      amountPending: false
    },
    canCancel: status === 'pendingPayment',
    canPay: status === 'pendingPayment' && !['paid', 'offlinePaid'].includes(text(order.paymentStatus)),
    createdAt: isoDate(order.createdAt),
    updatedAt: isoDate(order.updatedAt),
    confirmedAt: isoDate(order.confirmedAt),
    paidAt: isoDate(order.paidAt),
    makingAt: isoDate(order.makingAt),
    deliveringAt: isoDate(order.deliveringAt),
    completedAt: isoDate(order.completedAt),
    cancelledAt: isoDate(order.cancelledAt),
    cancelReason: text(order.cancelReason)
  }
}

async function listOrders(event, identity) {
  await ensureUser(identity)
  await assertCollectionExists(COLLECTIONS.orders)

  const result = await db
    .collection(COLLECTIONS.orders)
    .where({ userId: identity.userId })
    .limit(1000)
    .get()

  const status = text(event.status)
  const allItems = result.data || []
  const filtered = allItems
    .filter((item) => {
      if (!status || status === 'all') return true
      if (status === 'afterSale') {
        return ['refundPending', 'refunded'].includes(item.status)
      }
      if (status === 'pendingPayment') return ['pendingConfirm', 'pendingPayment'].includes(item.status)
      return item.status === status
    })
    .sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))

  const urlMap = await resolveFileUrls(
    filtered.flatMap((order) =>
      (Array.isArray(order.items) ? order.items : [])
        .map((item) => item.coverFileId)
    )
  )

  const counts = {
    all: allItems.length,
    pendingPayment: 0,
    making: 0,
    delivering: 0,
    afterSale: 0
  }

  for (const item of allItems) {
    if (['refundPending', 'refunded'].includes(item.status)) {
      counts.afterSale += 1
    } else if (['pendingConfirm', 'pendingPayment'].includes(item.status)) {
      counts.pendingPayment += 1
    } else if (Object.prototype.hasOwnProperty.call(counts, item.status)) {
      counts[item.status] += 1
    }
  }

  return {
    items: filtered.map((item) => orderView(item, urlMap)),
    total: filtered.length,
    counts
  }
}

async function getOrderDetail(event, identity) {
  await ensureUser(identity)
  await Promise.all([
    assertCollectionExists(COLLECTIONS.orders),
    assertCollectionExists(COLLECTIONS.orderLogs)
  ])

  const id = text(event.id)
  if (!id) throw new BusinessError('缺少订单 ID')

  const order = await getDocument(COLLECTIONS.orders, id)

  if (!order || order.userId !== identity.userId) {
    throw new BusinessError('订单不存在', 'NOT_FOUND')
  }

  const logResult = await db
    .collection(COLLECTIONS.orderLogs)
    .where({ orderId: id })
    .limit(100)
    .get()

  const logs = (logResult.data || [])
    .sort((a, b) => dateValue(a.createdAt) - dateValue(b.createdAt))
    .map((item) => ({
      _id: text(item._id),
      status: text(item.status),
      title: text(item.title),
      note: text(item.note),
      operatorType: text(item.operatorType),
      createdAt: isoDate(item.createdAt)
    }))

  const urlMap = await resolveFileUrls(
    (Array.isArray(order.items) ? order.items : [])
      .map((item) => item.coverFileId)
  )

  return {
    ...orderView(order, urlMap),
    logs
  }
}

async function respondDeliverySchedule(event, identity) {
  await ensureUser(identity)
  await Promise.all([
    assertCollectionExists(COLLECTIONS.orders),
    assertCollectionExists(COLLECTIONS.orderLogs)
  ])

  const id = text(event.id)
  const decision = text(event.decision)
  if (!id) throw new BusinessError('缺少订单 ID')
  if (!['accept', 'reject'].includes(decision)) {
    throw new BusinessError('无效的配送时间操作')
  }

  const order = await getDocument(COLLECTIONS.orders, id)
  if (!order || order.userId !== identity.userId) {
    throw new BusinessError('订单不存在', 'NOT_FOUND')
  }

  if (normalizeDeliveryScheduleStatus(order) !== 'customerConfirmationRequired') {
    throw new BusinessError('当前配送时间无需确认', 'INVALID_DELIVERY_SCHEDULE_STATUS')
  }

  const proposedDate = text(order.proposedDeliveryDate)
  const proposedSlot = text(order.proposedDeliverySlot)
  if (!proposedDate || !DELIVERY_SLOTS.includes(proposedSlot)) {
    throw new BusinessError('商家建议的配送时间不完整，请联系客服', 'INVALID_DELIVERY_SCHEDULE')
  }

  if (decision === 'accept') {
    await db.collection(COLLECTIONS.orders).doc(id).update({
      data: {
        deliveryScheduleStatus: 'confirmed',
        deliveryScheduleStatusLabel: '时间已确认',
        deliveryConfirmed: true,
        confirmedDeliveryDate: proposedDate,
        confirmedDeliverySlot: proposedSlot,
        deliveryDate: proposedDate,
        deliverySlot: proposedSlot,
        customerDeliveryDecision: 'accepted',
        customerDeliveryRespondedAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })

    await writeOrderLog({
      orderId: id,
      orderNo: order.orderNo,
      status: text(order.status),
      title: '顾客已确认配送时间',
      note: `${proposedDate} ${proposedSlot}`,
      operatorType: 'customer',
      operatorId: identity.userId
    })

    return {
      _id: id,
      decision: 'accepted',
      deliveryScheduleStatus: 'confirmed'
    }
  }

  await db.collection(COLLECTIONS.orders).doc(id).update({
    data: {
      deliveryScheduleStatus: 'adjustmentRejected',
      deliveryScheduleStatusLabel: '调整未接受',
      deliveryConfirmed: false,
      deliveryDate: text(order.requestedDeliveryDate) || text(order.deliveryDate),
      deliverySlot: text(order.requestedDeliverySlot) || text(order.deliverySlot),
      customerDeliveryDecision: 'rejected',
      customerDeliveryRespondedAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })

  await writeOrderLog({
    orderId: id,
    orderNo: order.orderNo,
    status: text(order.status),
    title: '顾客未接受配送时间调整',
    note: '请商家通过客服继续沟通或重新提出时间',
    operatorType: 'customer',
    operatorId: identity.userId
  })

  return {
    _id: id,
    decision: 'rejected',
    deliveryScheduleStatus: 'adjustmentRejected'
  }
}


function postForm(urlString, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString)
    const payload = querystring.stringify(body)
    const request = https.request({
      hostname: url.hostname,
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 12000
    }, (response) => {
      let raw = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { raw += chunk })
      response.on('end', () => {
        try { resolve(JSON.parse(raw || '{}')) } catch (error) { reject(new Error('物流接口返回格式异常')) }
      })
    })
    request.on('timeout', () => request.destroy(new Error('物流查询超时')))
    request.on('error', reject)
    request.write(payload)
    request.end()
  })
}

function logisticsStateLabel(state) {
  return ({
    '0': '运输中', '1': '已揽收', '2': '运输异常', '3': '已签收', '4': '退签',
    '5': '派送中', '6': '退回中', '7': '转投', '8': '清关中', '10': '待清关', '14': '已拒签'
  })[text(state)] || '物流更新中'
}

async function refreshLogistics(event, identity) {
  await ensureUser(identity)
  await assertCollectionExists(COLLECTIONS.orders)
  const id = text(event.id)
  if (!id) throw new BusinessError('缺少订单 ID')

  const order = await getDocument(COLLECTIONS.orders, id)
  if (!order || order.userId !== identity.userId) throw new BusinessError('订单不存在', 'NOT_FOUND')
  const com = text(order.logisticsCompanyCode).toLowerCase()
  const num = text(order.trackingNo)
  if (!com || !num) throw new BusinessError('商家尚未填写快递信息')

  const lastUpdated = order.logisticsUpdatedAt ? new Date(order.logisticsUpdatedAt).getTime() : 0
  const cachedTrace = Array.isArray(order.logisticsTrace) ? order.logisticsTrace : []
  if (lastUpdated && Date.now() - lastUpdated < 30 * 60 * 1000 && cachedTrace.length) {
    return {
      configured: true,
      cached: true,
      logisticsCompanyCode: com,
      logisticsCompanyName: text(order.logisticsCompanyName),
      trackingNo: num,
      logisticsState: text(order.logisticsState),
      logisticsStateLabel: text(order.logisticsStateLabel, '物流更新中'),
      logisticsTrace: cachedTrace,
      message: '已显示最近一次物流结果'
    }
  }

  const customer = text(process.env.KUAIDI100_CUSTOMER)
  const key = text(process.env.KUAIDI100_KEY)
  if (!customer || !key) {
    return {
      configured: false,
      logisticsCompanyCode: com,
      logisticsCompanyName: text(order.logisticsCompanyName),
      trackingNo: num,
      logisticsState: text(order.logisticsState),
      logisticsStateLabel: text(order.logisticsStateLabel, '等待物流更新'),
      logisticsTrace: Array.isArray(order.logisticsTrace) ? order.logisticsTrace : [],
      message: '物流查询接口尚未配置，快递公司和运单号已展示'
    }
  }

  const param = JSON.stringify({
    com,
    num,
    phone: text(order.address && order.address.phone),
    resultv2: '4',
    show: '0',
    order: 'desc',
    lang: 'zh',
    needCourierInfo: true
  })
  const sign = crypto.createHash('md5').update(`${param}${key}${customer}`).digest('hex').toUpperCase()

  let result
  try {
    result = await postForm('https://poll.kuaidi100.com/poll/query.do', { customer, sign, param })
  } catch (error) {
    await db.collection(COLLECTIONS.orders).doc(id).update({
      data: { logisticsQueryError: error.message, logisticsUpdatedAt: db.serverDate(), updatedAt: db.serverDate() }
    })
    throw new BusinessError(error.message || '物流查询失败')
  }

  if (result.result === false || (result.returnCode && result.returnCode !== '200')) {
    const message = text(result.message, '暂未查询到物流轨迹')
    await db.collection(COLLECTIONS.orders).doc(id).update({
      data: { logisticsQueryError: message, logisticsUpdatedAt: db.serverDate(), updatedAt: db.serverDate() }
    })
    throw new BusinessError(message)
  }

  const trace = (Array.isArray(result.data) ? result.data : []).slice(0, 30).map((item, index) => ({
    id: `${text(item.time)}_${index}`,
    time: text(item.ftime || item.time),
    context: text(item.context),
    status: text(item.status),
    statusCode: text(item.statusCode),
    location: text(item.location || item.areaName)
  }))
  const state = text(result.state, '0')
  const stateLabel = logisticsStateLabel(state)

  await db.collection(COLLECTIONS.orders).doc(id).update({
    data: {
      logisticsState: state,
      logisticsStateLabel: stateLabel,
      logisticsTrace: trace,
      logisticsCourierInfo: result.courierInfo || null,
      logisticsQueryError: '',
      logisticsUpdatedAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })

  return {
    configured: true,
    logisticsCompanyCode: com,
    logisticsCompanyName: text(order.logisticsCompanyName),
    trackingNo: num,
    logisticsState: state,
    logisticsStateLabel: stateLabel,
    logisticsTrace: trace,
    courierInfo: result.courierInfo || null,
    arrivalTime: text(result.arrivalTime)
  }
}

async function cancelOrder(event, identity) {
  await ensureUser(identity)
  await Promise.all([
    assertCollectionExists(COLLECTIONS.orders),
    assertCollectionExists(COLLECTIONS.orderLogs)
  ])

  const id = text(event.id)
  const reason = text(event.reason, '顾客主动取消')

  if (!id) throw new BusinessError('缺少订单 ID')

  const order = await getDocument(COLLECTIONS.orders, id)

  if (!order || order.userId !== identity.userId) {
    throw new BusinessError('订单不存在', 'NOT_FOUND')
  }

  if (!['pendingConfirm', 'pendingPayment'].includes(order.status)) {
    throw new BusinessError('当前订单状态不能取消')
  }

  await db
    .collection(COLLECTIONS.orders)
    .doc(id)
    .update({
      data: {
        status: 'cancelled',
        statusLabel: STATUS_META.cancelled.label,
        cancelReason: reason,
        cancelledAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })

  await writeOrderLog({
    orderId: id,
    orderNo: order.orderNo,
    status: 'cancelled',
    title: '订单已取消',
    note: reason,
    operatorType: 'customer',
    operatorId: identity.userId
  })

  return {
    _id: id,
    status: 'cancelled',
    statusLabel: STATUS_META.cancelled.label
  }
}

exports.main = async (event = {}) => {
  try {
    const identity = getIdentity()
    const action = text(event.action)

    if (!action) {
      throw new BusinessError('缺少 action')
    }

    switch (action) {
      case 'getCheckoutOptions':
        return success(await getCheckoutOptions(identity, event))
      case 'previewOrder':
        return success(await previewOrder(event, identity))
      case 'createOrder':
        return success(await createOrder(event, identity))
      case 'listOrders':
        return success(await listOrders(event, identity))
      case 'getOrderDetail':
        return success(await getOrderDetail(event, identity))
      case 'respondDeliverySchedule':
        return success(await respondDeliverySchedule(event, identity))
      case 'refreshLogistics':
        return success(await refreshLogistics(event, identity))
      case 'cancelOrder':
        return success(await cancelOrder(event, identity))
      default:
        throw new BusinessError(`未知操作：${action}`, 'UNKNOWN_ACTION')
    }
  } catch (error) {
    return failure(error)
  }
}
