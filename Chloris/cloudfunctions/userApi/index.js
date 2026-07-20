const crypto = require('crypto')
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

const COLLECTIONS = {
  users: 'users',
  addresses: 'addresses',
  orders: 'orders',
  orderLogs: 'orderLogs',
  quoteRequests: 'quoteRequests',
  atlas: 'atlas'
}

const PURCHASED_STATUSES = new Set([
  'making',
  'delivering',
  'completed'
])

const QUOTE_DELIVERY_SLOTS = new Set([
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
  return {
    ok: true,
    data
  }
}

function failure(error) {
  console.error('[userApi]', error)

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

function boolean(value) {
  return value === true
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

  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function isoDate(value) {
  const timestamp = dateValue(value)
  return timestamp
    ? new Date(timestamp).toISOString()
    : ''
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

async function resolveFileUrl(fileId) {
  const normalized = text(fileId)

  if (!normalized || !normalized.startsWith('cloud://')) {
    return normalized
  }

  try {
    const result = await cloud.getTempFileURL({
      fileList: [normalized]
    })
    const item = result.fileList && result.fileList[0]

    return item && item.tempFileURL
      ? item.tempFileURL
      : ''
  } catch (error) {
    console.warn('[userApi] 头像临时地址生成失败：', error)
    return ''
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
      points: 0,
      favoriteAtlasIds: [],
      locationPrompted: false,
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

async function userView(user) {
  return {
    _id: text(user._id),
    nickname: text(user.nickname, 'Chloris 用户'),
    contactName: text(user.contactName),
    contactPhone: text(user.contactPhone),
    avatarFileId: text(user.avatarFileId),
    avatarUrl: await resolveFileUrl(user.avatarFileId),
    memberLevel: text(user.memberLevel, 'normal'),
    memberLevelLabel: text(user.memberLevelLabel, '普通会员'),
    points: Math.max(0, Math.round(number(user.points))),
    favoriteAtlasIds: stringArray(user.favoriteAtlasIds),
    lastLocation: user.lastLocation || null,
    locationPrompted: user.locationPrompted === true,
    createdAt: isoDate(user.createdAt),
    updatedAt: isoDate(user.updatedAt)
  }
}


function sanitizeLocation(input) {
  return {
    name: text(input.name),
    address: text(input.address),
    latitude: number(input.latitude),
    longitude: number(input.longitude),
    accuracy: number(input.accuracy),
    horizontalAccuracy: number(input.horizontalAccuracy),
    verticalAccuracy: number(input.verticalAccuracy),
    source: text(input.source) || 'miniProgram'
  }
}

function sanitizeQuoteRequest(input) {
  const images = stringArray(input.images).slice(0, 4)
  const contactName = text(input.contactName)
  const contactPhone = text(input.contactPhone).replace(/\s+/g, '')

  if (!images.length) {
    throw new BusinessError('请至少上传一张参考图')
  }
  if (!contactName) {
    throw new BusinessError('请填写联系人')
  }
  if (!/^1\d{10}$/.test(contactPhone)) {
    throw new BusinessError('请填写正确的11位手机号')
  }

  return {
    images,
    contactName: contactName.slice(0, 24),
    contactPhone,
    message: text(input.message).slice(0, 300)
  }
}

async function saveLocationAction(event, identity) {
  await ensureUser(identity)
  const location = sanitizeLocation(event.location || {})
  const latestLocation = {
    ...location,
    capturedAt: db.serverDate()
  }

  await db.collection(COLLECTIONS.users).doc(identity.userId).update({
    data: {
      lastLocation: latestLocation,
      locationPrompted: true,
      locationHistory: _.remove(),
      updatedAt: db.serverDate()
    }
  })

  return {
    lastLocation: {
      ...location,
      capturedAt: new Date().toISOString()
    }
  }
}

async function markLocationPromptedAction(identity) {
  await ensureUser(identity)

  await db.collection(COLLECTIONS.users).doc(identity.userId).update({
    data: {
      locationPrompted: true,
      locationHistory: _.remove(),
      updatedAt: db.serverDate()
    }
  })

  return {
    locationPrompted: true
  }
}

async function createQuoteRequestAction(event, identity) {
  await assertCollectionExists(COLLECTIONS.quoteRequests)
  const user = await ensureUser(identity)
  const payload = sanitizeQuoteRequest((event && event.payload) || {})
  const requestId = createId('quote')
  const requestNo = `Q${new Date().toISOString().slice(0,10).replace(/-/g,'')}${Math.random().toString().slice(2,6)}`

  await db.collection(COLLECTIONS.users).doc(identity.userId).update({
    data: {
      contactName: payload.contactName,
      contactPhone: payload.contactPhone,
      updatedAt: db.serverDate()
    }
  })

  const document = {
    requestNo,
    userId: identity.userId,
    userNickname: text(user.nickname, 'Chloris 用户'),
    contactName: payload.contactName,
    contactPhone: payload.contactPhone,
    message: payload.message,
    images: payload.images,
    status: 'pending',
    statusLabel: '待商户确认',
    quotedPrice: '',
    merchantReply: '',
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }
  await db.collection(COLLECTIONS.quoteRequests).doc(requestId).set({ data: document })
  return { _id: requestId, requestNo, status: 'pending' }
}

function formatFen(value) {
  const yuan = Math.max(0, Math.round(number(value))) / 100
  return Number.isInteger(yuan)
    ? String(yuan)
    : yuan.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function normalizeLegacyQuoteRecord(item) {
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
    quotedPriceFen: Math.max(0, Math.round(number(source.quotedPriceFen))) || Math.max(0, Math.round(number(legacy.quotedPriceFen))),
    quotedPriceYuan: number(source.quotedPriceYuan) || number(legacy.quotedPriceYuan),
    quotedPrice: text(source.quotedPrice) || text(legacy.quotedPrice),
    quotedAt: source.quotedAt || legacy.quotedAt || null,
    handledBy: text(source.handledBy) || text(legacy.handledBy),
    customerDecision: text(source.customerDecision) || text(legacy.customerDecision),
    customerRespondedAt: source.customerRespondedAt || legacy.customerRespondedAt || null,
    orderId: text(source.orderId) || text(legacy.orderId),
    orderNo: text(source.orderNo) || text(legacy.orderNo),
    acceptedAt: source.acceptedAt || legacy.acceptedAt || null,
    rejectedAt: source.rejectedAt || legacy.rejectedAt || null,
    orderCreatedAt: source.orderCreatedAt || legacy.orderCreatedAt || null
  }
}

function parseQuotedPriceFen(item) {
  const record = normalizeLegacyQuoteRecord(item)
  const direct = Math.max(0, Math.round(number(record.quotedPriceFen)))
  if (direct > 0) return direct

  const yuan = number(record.quotedPriceYuan)
  if (yuan > 0) return Math.round(yuan * 100)

  const legacy = text(record.quotedPrice)
    .replace(/,/g, '')
    .match(/\d+(?:\.\d{1,2})?/)

  return legacy ? Math.round(Number(legacy[0]) * 100) : 0
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

  return `HY${parts.join('')}${crypto.randomInt(1000, 10000)}`
}

function createQuoteOrderId(quoteId) {
  const digest = crypto
    .createHash('sha256')
    .update(text(quoteId))
    .digest('hex')
    .slice(0, 28)
  return `order_quote_${digest}`
}

function createQuoteOrderNo(quote) {
  const requestNo = text(quote && quote.requestNo).replace(/[^a-zA-Z0-9]/g, '')
  if (requestNo) return `HQ${requestNo.replace(/^Q/i, '')}`
  return createOrderNo()
}

function maskPhone(phone) {
  const value = text(phone)
  if (value.length !== 11) return value
  return `${value.slice(0, 3)}****${value.slice(-4)}`
}

function normalizeQuoteStatus(item) {
  const record = normalizeLegacyQuoteRecord(item)
  const status = text(record.status, 'pending')
  if (record.orderId) return 'converted'

  const aliases = {
    rejected: 'merchantRejected',
    completed: 'converted',
    accepted: 'converted',
    declined: 'customerRejected'
  }

  return aliases[status] || status
}

function quoteStatusMeta(status) {
  const map = {
    pending: {
      label: '待商户确认',
      description: '商户正在查看参考图片和需求说明。',
      tone: 'warning'
    },
    quoted: {
      label: '待你确认',
      description: '商户已回复报价，请确认是否接受。',
      tone: 'primary'
    },
    merchantRejected: {
      label: '暂不接单',
      description: '商户当前无法承接本次定制需求。',
      tone: 'danger'
    },
    customerRejected: {
      label: '已拒绝报价',
      description: '你已拒绝本次报价，可以重新发起新的需求。',
      tone: 'danger'
    },
    converted: {
      label: '已生成订单',
      description: '报价已确认，对应订单正在按订单流程处理。',
      tone: 'success'
    }
  }

  return map[status] || {
    label: text(status, '处理中'),
    description: '定制需求状态已更新。',
    tone: 'warning'
  }
}

async function resolveQuoteImageUrlMap(items) {
  const cloudIds = [...new Set(
    (Array.isArray(items) ? items : [])
      .flatMap((item) => stringArray(item && item.images))
      .filter((fileId) => fileId.startsWith('cloud://'))
  )]
  const map = {}

  if (cloudIds.length) {
    try {
      const result = await cloud.getTempFileURL({ fileList: cloudIds })
      for (const item of result.fileList || []) {
        if (item.fileID && item.tempFileURL) map[item.fileID] = item.tempFileURL
      }
    } catch (error) {
      console.warn('[userApi] 定制图片临时地址生成失败：', error)
    }
  }

  return map
}

async function resolveQuoteImageUrls(images, urlMap = null) {
  const source = stringArray(images)
  const map = urlMap || await resolveQuoteImageUrlMap([{ images: source }])
  return source.map((fileId) => map[fileId] || fileId)
}

function buildQuoteTimeline(item, status) {
  const submittedAt = isoDate(item.createdAt)
  const quotedAt = isoDate(item.quotedAt || item.updatedAt)
  const decidedAt = isoDate(item.customerRespondedAt || item.acceptedAt || item.rejectedAt)
  const orderedAt = isoDate(item.orderCreatedAt)
  const merchantHandled = status !== 'pending'
  const customerHandled = ['customerRejected', 'converted'].includes(status)

  return [
    {
      key: 'submitted',
      title: '已提交定制需求',
      time: submittedAt ? submittedAt.replace('T', ' ').slice(0, 16) : '',
      active: true
    },
    {
      key: 'merchant',
      title: status === 'merchantRejected' ? '商户暂不接单' : '商户回复报价',
      time: merchantHandled && quotedAt ? quotedAt.replace('T', ' ').slice(0, 16) : '',
      active: merchantHandled
    },
    {
      key: 'customer',
      title: status === 'customerRejected' ? '你已拒绝报价' : '你已确认报价',
      time: customerHandled && decidedAt ? decidedAt.replace('T', ' ').slice(0, 16) : '',
      active: customerHandled
    },
    {
      key: 'order',
      title: '已生成待付款订单',
      time: status === 'converted' && orderedAt ? orderedAt.replace('T', ' ').slice(0, 16) : '',
      active: status === 'converted'
    }
  ]
}

async function quoteView(item, includeDetails = false, imageUrlMap = null) {
  const record = normalizeLegacyQuoteRecord(item)
  const status = normalizeQuoteStatus(record)
  const meta = quoteStatusMeta(status)
  const quotedPriceFen = parseQuotedPriceFen(record)
  const images = await resolveQuoteImageUrls(record.images, imageUrlMap)
  const createdAt = isoDate(record.createdAt)
  const quotedAt = isoDate(record.quotedAt)

  const result = {
    _id: text(record._id),
    requestNo: text(record.requestNo),
    status,
    statusLabel: meta.label,
    statusDescription: meta.description,
    statusTone: meta.tone,
    contactName: text(record.contactName),
    contactPhoneMasked: maskPhone(record.contactPhone),
    message: text(record.message),
    images,
    coverUrl: images[0] || '',
    imageCount: images.length,
    merchantReply: text(record.merchantReply),
    quotedPriceFen,
    quotedPriceText: quotedPriceFen > 0 ? formatFen(quotedPriceFen) : '',
    customerDecision: text(record.customerDecision),
    orderId: text(record.orderId),
    orderNo: text(record.orderNo),
    canAccept: status === 'quoted' && quotedPriceFen > 0,
    canReject: status === 'quoted',
    canDecide: status === 'quoted',
    createdAt,
    createdAtText: createdAt ? createdAt.replace('T', ' ').slice(0, 16) : '',
    quotedAt,
    quotedAtText: quotedAt ? quotedAt.replace('T', ' ').slice(0, 16) : ''
  }

  if (includeDetails) {
    result.contactPhone = text(record.contactPhone)
    result.timeline = buildQuoteTimeline(record, status)
  }

  return result
}

async function listUserQuoteDocuments(userId) {
  try {
    await assertCollectionExists(COLLECTIONS.quoteRequests)
  } catch (error) {
    if (error.code === 'COLLECTION_NOT_FOUND') return []
    throw error
  }

  const result = await db.collection(COLLECTIONS.quoteRequests)
    .where({ userId })
    .limit(1000)
    .get()

  return (result.data || []).sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))
}

async function listQuoteRequestsAction(event, identity) {
  await ensureUser(identity)
  const statusFilter = text(event.status, 'all')
  const documents = await listUserQuoteDocuments(identity.userId)
  const normalized = documents.map((item) => ({ item, status: normalizeQuoteStatus(item) }))
  const counts = {
    all: normalized.length,
    pending: normalized.filter((row) => row.status === 'pending').length,
    quoted: normalized.filter((row) => row.status === 'quoted').length,
    finished: normalized.filter((row) => !['pending', 'quoted'].includes(row.status)).length
  }

  const filtered = normalized.filter((row) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'finished') return !['pending', 'quoted'].includes(row.status)
    return row.status === statusFilter
  })

  const imageUrlMap = await resolveQuoteImageUrlMap(filtered.map((row) => row.item))

  return {
    items: await Promise.all(filtered.map((row) => quoteView(row.item, false, imageUrlMap))),
    counts,
    total: filtered.length
  }
}

async function getOwnedQuote(id, identity) {
  const quote = await getDocument(COLLECTIONS.quoteRequests, id)
  if (!quote || text(quote.userId) !== identity.userId) {
    throw new BusinessError('定制报价记录不存在', 'NOT_FOUND')
  }
  return normalizeLegacyQuoteRecord({ ...quote, _id: id })
}

async function getQuoteRequestAction(event, identity) {
  await ensureUser(identity)
  const id = text(event.id)
  if (!id) throw new BusinessError('缺少定制报价ID')
  return quoteView(await getOwnedQuote(id, identity), true)
}

function quoteAddressSnapshot(address) {
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
    latitude: Number.isFinite(Number(address.latitude)) ? Number(address.latitude) : null,
    longitude: Number.isFinite(Number(address.longitude)) ? Number(address.longitude) : null,
    label: text(address.label, '家'),
    fullAddress: [
      text(address.province),
      text(address.city),
      text(address.district),
      text(address.detail)
    ].filter(Boolean).join('')
  }
}

function sanitizeQuoteDeliveryInput(input = {}) {
  const addressId = text(input.addressId)
  const requestedDeliveryDate = text(input.requestedDeliveryDate)
  const requestedDeliverySlot = text(input.requestedDeliverySlot)
  const requestedDeliveryNote = text(input.requestedDeliveryNote).slice(0, 120)

  if (!addressId) {
    throw new BusinessError('请选择收货地址', 'ADDRESS_REQUIRED')
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDeliveryDate)) {
    throw new BusinessError('请选择正确的配送日期', 'INVALID_DELIVERY_DATE')
  }

  const chosenDate = new Date(`${requestedDeliveryDate}T00:00:00+08:00`)
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const latestDate = new Date(todayStart)
  latestDate.setDate(latestDate.getDate() + 180)

  if (Number.isNaN(chosenDate.getTime()) || chosenDate < todayStart || chosenDate > latestDate) {
    throw new BusinessError('配送日期需在未来180天内', 'INVALID_DELIVERY_DATE')
  }

  if (!QUOTE_DELIVERY_SLOTS.has(requestedDeliverySlot)) {
    throw new BusinessError('请选择有效的配送时段', 'INVALID_DELIVERY_SLOT')
  }

  return {
    addressId,
    requestedDeliveryDate,
    requestedDeliverySlot,
    requestedDeliveryNote
  }
}

async function writeQuoteOrderLog({ orderId, orderNo, status, title, note, userId }) {
  try {
    await assertCollectionExists(COLLECTIONS.orderLogs)
    await db.collection(COLLECTIONS.orderLogs).add({
      data: {
        orderId,
        orderNo,
        status,
        title,
        note: text(note),
        operatorType: 'customer',
        operatorId: userId,
        createdAt: db.serverDate()
      }
    })
  } catch (error) {
    console.error('[userApi] 定制订单日志写入失败：', error)
  }
}

async function acceptQuoteAndCreateOrder(quote, identity, deliveryInput = {}) {
  quote = normalizeLegacyQuoteRecord(quote)
  if (quote.orderId) {
    return {
      quoteId: quote._id,
      status: 'converted',
      orderId: text(quote.orderId),
      orderNo: text(quote.orderNo),
      existing: true
    }
  }

  const status = normalizeQuoteStatus(quote)
  if (status !== 'quoted') {
    throw new BusinessError('当前报价状态不能接受', 'INVALID_QUOTE_STATUS')
  }

  const quotedPriceFen = parseQuotedPriceFen(quote)
  if (quotedPriceFen <= 0) {
    throw new BusinessError('商户报价金额无效，请联系客服处理', 'INVALID_QUOTE_PRICE')
  }

  const delivery = sanitizeQuoteDeliveryInput(deliveryInput)
  const addresses = await listUserAddresses(identity.userId)
  const address = addresses.find((item) => text(item._id) === delivery.addressId)
  if (!address) {
    throw new BusinessError('所选收货地址不存在，请重新选择', 'ADDRESS_REQUIRED')
  }

  await Promise.all([
    assertCollectionExists(COLLECTIONS.orders),
    assertCollectionExists(COLLECTIONS.orderLogs)
  ])

  const user = await ensureUser(identity)
  const orderId = createQuoteOrderId(quote._id)
  const existingOrder = await getDocument(COLLECTIONS.orders, orderId)
  const orderNo = existingOrder ? text(existingOrder.orderNo) : createQuoteOrderNo(quote)
  const coverFileId = stringArray(quote.images)[0] || ''

  if (existingOrder) {
    await db.collection(COLLECTIONS.quoteRequests).doc(quote._id).update({
      data: {
        status: 'converted',
        statusLabel: '已生成订单',
        customerDecision: 'accepted',
        customerRespondedAt: db.serverDate(),
        acceptedAt: db.serverDate(),
        orderId,
        orderNo,
        orderCreatedAt: existingOrder.createdAt || db.serverDate(),
        updatedAt: db.serverDate(),
        data: _.remove()
      }
    })

    return {
      quoteId: quote._id,
      status: 'converted',
      orderId,
      orderNo,
      existing: true
    }
  }

  const orderDocument = {
    orderNo,
    userId: identity.userId,
    customerNickname: text(user.nickname, 'Chloris 用户'),
    sourceType: 'quoteRequest',
    quoteRequestId: quote._id,
    quoteRequestNo: text(quote.requestNo),
    status: 'pendingPayment',
    statusLabel: '待付款',
    paymentStatus: 'unpaid',
    deliveryMethodId: 'delivery',
    deliveryMethodName: '配送到家',
    deliveryFeePending: true,

    requestedDeliveryDate: delivery.requestedDeliveryDate,
    requestedDeliverySlot: delivery.requestedDeliverySlot,
    requestedDeliveryNote: delivery.requestedDeliveryNote,
    deliveryScheduleStatus: 'pendingMerchantConfirm',
    deliveryScheduleStatusLabel: '待商家确认',
    deliveryConfirmed: false,
    deliveryDate: delivery.requestedDeliveryDate,
    deliverySlot: delivery.requestedDeliverySlot,
    confirmedDeliveryDate: '',
    confirmedDeliverySlot: '',
    proposedDeliveryDate: '',
    proposedDeliverySlot: '',
    deliveryAdjustmentNote: '',

    address: quoteAddressSnapshot(address),
    packagingId: 'customQuote',
    packagingName: '按定制方案制作',
    packagingDescription: '以商户回复的定制方案为准',
    cardMessage: '',
    buyerMessage: text(quote.message),
    merchantNote: text(quote.merchantReply),
    items: [{
      productId: `quote:${quote._id}`,
      name: '图片定制花礼',
      subtitle: text(quote.merchantReply, '按已确认的定制报价制作'),
      unit: '份',
      quantity: 1,
      unitPriceFen: quotedPriceFen,
      subtotalFen: quotedPriceFen,
      coverFileId,
      atlasIds: []
    }],
    atlasIds: [],
    goodsAmountFen: quotedPriceFen,
    packagingFeeFen: 0,
    deliveryFeeFen: 0,
    discountFen: 0,
    pointsDeductionFen: 0,
    totalAmountFen: quotedPriceFen,
    amountPending: true,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
    submittedAt: db.serverDate()
  }

  await db.collection(COLLECTIONS.orders).doc(orderId).set({ data: orderDocument })

  await db.collection(COLLECTIONS.quoteRequests).doc(quote._id).update({
    data: {
      status: 'converted',
      statusLabel: '已生成订单',
      customerDecision: 'accepted',
      customerRespondedAt: db.serverDate(),
      acceptedAt: db.serverDate(),
      requestedDeliveryDate: delivery.requestedDeliveryDate,
      requestedDeliverySlot: delivery.requestedDeliverySlot,
      requestedDeliveryNote: delivery.requestedDeliveryNote,
      selectedAddressId: delivery.addressId,
      orderId,
      orderNo,
      orderCreatedAt: db.serverDate(),
      updatedAt: db.serverDate(),
      data: _.remove()
    }
  })

  await writeQuoteOrderLog({
    orderId,
    orderNo,
    status: 'pendingPayment',
    title: '定制报价已确认',
    note: `顾客期望 ${delivery.requestedDeliveryDate} ${delivery.requestedDeliverySlot} 配送，等待商家确认时间`,
    userId: identity.userId
  })

  return {
    quoteId: quote._id,
    status: 'converted',
    orderId,
    orderNo,
    existing: false
  }
}

async function respondQuoteRequestAction(event, identity) {
  await ensureUser(identity)
  const id = text(event.id)
  const decision = text(event.decision)
  if (!id) throw new BusinessError('缺少定制报价ID')
  if (!['accept', 'reject'].includes(decision)) {
    throw new BusinessError('无效的报价操作')
  }

  const quote = await getOwnedQuote(id, identity)

  if (decision === 'accept') {
    return acceptQuoteAndCreateOrder(quote, identity, event.delivery || {})
  }

  if (normalizeQuoteStatus(quote) !== 'quoted') {
    throw new BusinessError('当前报价状态不能拒绝', 'INVALID_QUOTE_STATUS')
  }

  await db.collection(COLLECTIONS.quoteRequests).doc(id).update({
    data: {
      status: 'customerRejected',
      statusLabel: '用户已拒绝',
      customerDecision: 'rejected',
      customerRespondedAt: db.serverDate(),
      rejectedAt: db.serverDate(),
      updatedAt: db.serverDate(),
      data: _.remove()
    }
  })

  return {
    quoteId: id,
    status: 'customerRejected'
  }
}

function sanitizeProfile(input) {
  const nickname = text(input.nickname)

  if (!nickname) {
    throw new BusinessError('昵称不能为空')
  }

  if (nickname.length > 24) {
    throw new BusinessError('昵称不能超过24个字符')
  }

  return {
    nickname,
    avatarFileId: text(input.avatarFileId)
  }
}

function sanitizeAddress(input) {
  const receiverName = text(input.receiverName)
  const phone = text(input.phone).replace(/\s+/g, '')
  const province = text(input.province)
  const city = text(input.city)
  const district = text(input.district)
  const detail = text(input.detail)
  const label = text(input.label, '家')

  if (!receiverName) {
    throw new BusinessError('请填写收货人姓名')
  }

  if (!/^1\d{10}$/.test(phone)) {
    throw new BusinessError('请输入正确的11位手机号')
  }

  if (!province || !city || !district) {
    throw new BusinessError('请选择省、市、区')
  }

  if (!detail) {
    throw new BusinessError('请填写详细地址')
  }

  const latitudeValue = Number(input.latitude)
  const longitudeValue = Number(input.longitude)
  const latitude = Number.isFinite(latitudeValue)
    ? Math.max(-90, Math.min(90, latitudeValue))
    : null
  const longitude = Number.isFinite(longitudeValue)
    ? Math.max(-180, Math.min(180, longitudeValue))
    : null

  return {
    receiverName,
    phone,
    province,
    city,
    district,
    detail,
    label: label.slice(0, 8),
    isDefault: boolean(input.isDefault),
    locationName: text(input.locationName).slice(0, 100),
    locationAddress: text(input.locationAddress).slice(0, 200),
    latitude,
    longitude
  }
}

function maskPhone(phone) {
  const value = text(phone)

  if (value.length !== 11) return value
  return `${value.slice(0, 3)}****${value.slice(-4)}`
}

function addressView(item) {
  return {
    _id: text(item._id),
    receiverName: text(item.receiverName),
    phone: text(item.phone),
    phoneMasked: maskPhone(item.phone),
    province: text(item.province),
    city: text(item.city),
    district: text(item.district),
    detail: text(item.detail),
    locationName: text(item.locationName),
    locationAddress: text(item.locationAddress),
    latitude: Number.isFinite(Number(item.latitude))
      ? Number(item.latitude)
      : null,
    longitude: Number.isFinite(Number(item.longitude))
      ? Number(item.longitude)
      : null,
    fullAddress: [
      text(item.province),
      text(item.city),
      text(item.district),
      text(item.detail)
    ].filter(Boolean).join(''),
    label: text(item.label, '家'),
    isDefault: item.isDefault === true,
    createdAt: isoDate(item.createdAt),
    updatedAt: isoDate(item.updatedAt)
  }
}

async function listUserAddresses(userId) {
  await assertCollectionExists(COLLECTIONS.addresses)

  const result = await db
    .collection(COLLECTIONS.addresses)
    .where({ userId })
    .limit(100)
    .get()

  return (result.data || [])
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) {
        return a.isDefault ? -1 : 1
      }

      return dateValue(b.updatedAt) - dateValue(a.updatedAt)
    })
}

async function unsetOtherDefaults(userId, excludeId = '') {
  const addresses = await listUserAddresses(userId)

  await Promise.all(
    addresses
      .filter((item) => item.isDefault === true && item._id !== excludeId)
      .map((item) =>
        db
          .collection(COLLECTIONS.addresses)
          .doc(item._id)
          .update({
            data: {
              isDefault: false,
              updatedAt: db.serverDate()
            }
          })
      )
  )
}

async function ensureUserAction(identity) {
  const user = await ensureUser(identity)
  return userView(user)
}

async function getProfile(identity) {
  const user = await ensureUser(identity)
  return userView(user)
}

async function updateProfile(event, identity) {
  const user = await ensureUser(identity)
  const patch = sanitizeProfile(event.profile || {})

  await db
    .collection(COLLECTIONS.users)
    .doc(user._id)
    .update({
      data: {
        ...patch,
        updatedAt: db.serverDate()
      }
    })

  return userView({
    ...user,
    ...patch,
    updatedAt: new Date()
  })
}

async function listAddresses(identity) {
  await ensureUser(identity)
  const items = await listUserAddresses(identity.userId)

  return {
    items: items.map(addressView),
    total: items.length,
    defaultAddress: items.length
      ? addressView(items.find((item) => item.isDefault) || items[0])
      : null
  }
}

async function getAddress(event, identity) {
  await ensureUser(identity)
  await assertCollectionExists(COLLECTIONS.addresses)

  const id = text(event.id)
  if (!id) throw new BusinessError('缺少地址 ID')

  const address = await getDocument(COLLECTIONS.addresses, id)

  if (!address || address.userId !== identity.userId) {
    throw new BusinessError('收货地址不存在', 'NOT_FOUND')
  }

  return addressView(address)
}

async function saveAddress(event, identity) {
  await ensureUser(identity)
  await assertCollectionExists(COLLECTIONS.addresses)

  const input = event.address || {}
  const data = sanitizeAddress(input)
  const id = text(input._id) || createId('address')
  const existing = await getDocument(COLLECTIONS.addresses, id)

  if (existing && existing.userId !== identity.userId) {
    throw new BusinessError('没有权限修改该地址', 'FORBIDDEN')
  }

  const currentItems = await listUserAddresses(identity.userId)

  if (!existing && currentItems.length >= 20) {
    throw new BusinessError('最多保存20个收货地址')
  }

  const shouldDefault =
    data.isDefault ||
    currentItems.length === 0

  if (shouldDefault) {
    await unsetOtherDefaults(identity.userId, id)
  }

  const document = {
    ...data,
    isDefault: shouldDefault,
    userId: identity.userId,
    createdAt: existing && existing.createdAt || db.serverDate(),
    updatedAt: db.serverDate()
  }

  await db
    .collection(COLLECTIONS.addresses)
    .doc(id)
    .set({
      data: document
    })

  return addressView({
    _id: id,
    ...document,
    updatedAt: new Date()
  })
}

async function deleteAddress(event, identity) {
  await ensureUser(identity)
  await assertCollectionExists(COLLECTIONS.addresses)

  const id = text(event.id)
  if (!id) throw new BusinessError('缺少地址 ID')

  const existing = await getDocument(COLLECTIONS.addresses, id)

  if (!existing || existing.userId !== identity.userId) {
    throw new BusinessError('收货地址不存在', 'NOT_FOUND')
  }

  await db
    .collection(COLLECTIONS.addresses)
    .doc(id)
    .remove()

  if (existing.isDefault === true) {
    const remaining = await listUserAddresses(identity.userId)
    const next = remaining[0]

    if (next) {
      await db
        .collection(COLLECTIONS.addresses)
        .doc(next._id)
        .update({
          data: {
            isDefault: true,
            updatedAt: db.serverDate()
          }
        })
    }
  }

  return { _id: id }
}

async function setDefaultAddress(event, identity) {
  await ensureUser(identity)
  await assertCollectionExists(COLLECTIONS.addresses)

  const id = text(event.id)
  if (!id) throw new BusinessError('缺少地址 ID')

  const existing = await getDocument(COLLECTIONS.addresses, id)

  if (!existing || existing.userId !== identity.userId) {
    throw new BusinessError('收货地址不存在', 'NOT_FOUND')
  }

  await unsetOtherDefaults(identity.userId, id)

  await db
    .collection(COLLECTIONS.addresses)
    .doc(id)
    .update({
      data: {
        isDefault: true,
        updatedAt: db.serverDate()
      }
    })

  return {
    _id: id,
    isDefault: true
  }
}


function sanitizeFavoriteAtlasIds(value) {
  const ids = stringArray(value)

  if (ids.length > 500) {
    throw new BusinessError('最多收藏500个图鉴品种')
  }

  return ids
}

async function filterExistingFavoriteAtlasIds(value) {
  const ids = sanitizeFavoriteAtlasIds(value)
  if (!ids.length) return []

  try {
    await assertCollectionExists(COLLECTIONS.atlas)
    const existing = new Set()

    for (let index = 0; index < ids.length; index += 100) {
      const batch = ids.slice(index, index + 100)
      const result = await db
        .collection(COLLECTIONS.atlas)
        .where({ _id: _.in(batch) })
        .field({ _id: true })
        .limit(100)
        .get()

      ;(result.data || []).forEach((item) => {
        const id = text(item && item._id)
        if (id) existing.add(id)
      })
    }

    return ids.filter((id) => existing.has(id))
  } catch (error) {
    console.warn('[userApi] 校验图鉴收藏有效性失败：', error)
    return ids
  }
}

async function persistFavoriteCleanup(user, originalIds, validIds) {
  if (validIds.length === originalIds.length) return

  try {
    await db.collection(COLLECTIONS.users).doc(user._id).update({
      data: {
        favoriteAtlasIds: validIds,
        updatedAt: db.serverDate()
      }
    })
  } catch (error) {
    console.warn('[userApi] 清理失效图鉴收藏失败：', error)
  }
}

async function saveAtlasFavorites(event, identity) {
  const user = await ensureUser(identity)
  const favoriteAtlasIds = await filterExistingFavoriteAtlasIds(
    event.ids
  )

  await db
    .collection(COLLECTIONS.users)
    .doc(user._id)
    .update({
      data: {
        favoriteAtlasIds,
        updatedAt: db.serverDate()
      }
    })

  return {
    favoriteAtlasIds,
    total: favoriteAtlasIds.length
  }
}

async function setAtlasFavorite(event, identity) {
  const user = await ensureUser(identity)
  const atlasId = text(event.atlasId)

  if (!atlasId) {
    throw new BusinessError('缺少图鉴 ID')
  }

  const current = new Set(
    await filterExistingFavoriteAtlasIds(
      user.favoriteAtlasIds
    )
  )

  if (event.favorite === true) {
    current.add(atlasId)
  } else {
    current.delete(atlasId)
  }

  const favoriteAtlasIds = sanitizeFavoriteAtlasIds(
    [...current]
  )

  await db
    .collection(COLLECTIONS.users)
    .doc(user._id)
    .update({
      data: {
        favoriteAtlasIds,
        updatedAt: db.serverDate()
      }
    })

  return {
    atlasId,
    favorite: favoriteAtlasIds.includes(atlasId),
    favoriteAtlasIds,
    total: favoriteAtlasIds.length
  }
}

function normalizeOrderStatus(value) {
  const status = text(value)

  const aliases = {
    pending_confirm: 'pendingConfirm',
    pendingConfirm: 'pendingConfirm',
    pending_payment: 'pendingPayment',
    pendingPayment: 'pendingPayment',
    making: 'making',
    production: 'making',
    delivering: 'delivering',
    delivery: 'delivering',
    completed: 'completed',
    complete: 'completed',
    cancelled: 'cancelled',
    refundPending: 'refundPending',
    refunded: 'refunded'
  }

  return aliases[status] || status
}

async function listUserOrders(userId) {
  try {
    await assertCollectionExists(COLLECTIONS.orders)
  } catch (error) {
    if (error.code === 'COLLECTION_NOT_FOUND') return []
    throw error
  }

  const result = await db
    .collection(COLLECTIONS.orders)
    .where({ userId })
    .limit(1000)
    .get()

  return result.data || []
}

async function getOverview(identity) {
  const [user, addresses, orders, quoteRequests] = await Promise.all([
    ensureUser(identity),
    listUserAddresses(identity.userId),
    listUserOrders(identity.userId),
    listUserQuoteDocuments(identity.userId)
  ])

  const orderCounts = {
    pendingConfirm: 0,
    pendingPayment: 0,
    making: 0,
    delivering: 0,
    afterSale: 0
  }

  const purchasedAtlasIds = new Set()
  const originalFavoriteAtlasIds = sanitizeFavoriteAtlasIds(
    user.favoriteAtlasIds
  )
  const favoriteAtlasIds = await filterExistingFavoriteAtlasIds(
    originalFavoriteAtlasIds
  )

  await persistFavoriteCleanup(
    user,
    originalFavoriteAtlasIds,
    favoriteAtlasIds
  )

  for (const order of orders) {
    const status = normalizeOrderStatus(order.status)

    if (['refundPending', 'refunded'].includes(status)) {
      orderCounts.afterSale += 1
    } else if (Object.prototype.hasOwnProperty.call(orderCounts, status)) {
      orderCounts[status] += 1
    }

    const purchased =
      PURCHASED_STATUSES.has(status) ||
      ['paid', 'offlinePaid'].includes(text(order.paymentStatus))

    if (purchased) {
      stringArray(order.atlasIds).forEach((id) => purchasedAtlasIds.add(id))

      for (const item of Array.isArray(order.items) ? order.items : []) {
        stringArray(item && item.atlasIds).forEach((id) => purchasedAtlasIds.add(id))
      }
    }
  }

  return {
    loggedIn: true,
    profile: await userView(user),
    orderCounts,
    assets: {
      points: Math.max(0, Math.round(number(user.points))),
      coupons: 0,
      favorites: favoriteAtlasIds.length
    },
    counts: {
      addresses: addresses.length,
      quoteRequests: quoteRequests.length,
      quotePendingDecision: quoteRequests.filter((item) => normalizeQuoteStatus(item) === 'quoted').length
    },
    purchasedAtlasIds: [...purchasedAtlasIds],
    favoriteAtlasIds
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
      case 'ensureUser':
        return success(await ensureUserAction(identity))
      case 'getProfile':
        return success(await getProfile(identity))
      case 'updateProfile':
        return success(await updateProfile(event, identity))
      case 'listAddresses':
        return success(await listAddresses(identity))
      case 'getAddress':
        return success(await getAddress(event, identity))
      case 'saveAddress':
        return success(await saveAddress(event, identity))
      case 'deleteAddress':
        return success(await deleteAddress(event, identity))
      case 'setDefaultAddress':
        return success(await setDefaultAddress(event, identity))
      case 'getOverview':
        return success(await getOverview(identity))
      case 'saveLocation':
        return success(await saveLocationAction(event, identity))
      case 'markLocationPrompted':
        return success(await markLocationPromptedAction(identity))
      case 'createQuoteRequest':
        return success(await createQuoteRequestAction(event, identity))
      case 'listQuoteRequests':
        return success(await listQuoteRequestsAction(event, identity))
      case 'getQuoteRequest':
        return success(await getQuoteRequestAction(event, identity))
      case 'respondQuoteRequest':
        return success(await respondQuoteRequestAction(event, identity))
      case 'saveAtlasFavorites':
        return success(await saveAtlasFavorites(event, identity))
      case 'setAtlasFavorite':
        return success(await setAtlasFavorite(event, identity))
      default:
        throw new BusinessError(`未知操作：${action}`, 'UNKNOWN_ACTION')
    }
  } catch (error) {
    return failure(error)
  }
}
