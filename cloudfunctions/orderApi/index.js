const crypto = require('crypto')
const cloud = require('wx-server-sdk')
const {
  PACKAGING_OPTIONS,
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
  orders: 'orders',
  orderLogs: 'orderLogs'
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

  const parsed = new Date(value).getTime()
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
      nickname: '花予用户',
      avatarFileId: '',
      memberLevel: 'normal',
      memberLevelLabel: '普通会员',
      points: 0,
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
      '当前账号已被停用，请联系花予客服',
      'USER_DISABLED'
    )
  }

  return {
    ...user,
    _id: user._id || identity.userId
  }
}

function packagingById(id) {
  return (
    PACKAGING_OPTIONS.find((item) => item.id === id && item.enabled !== false) ||
    PACKAGING_OPTIONS.find((item) => item.id === 'basic') ||
    PACKAGING_OPTIONS[0]
  )
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

    if (!product || product.onSale !== true) {
      throw new BusinessError(
        '部分商品已经下架，请返回购物车刷新后重试',
        'PRODUCT_OFF_SALE'
      )
    }

    const stock = integer(product.stock)

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
      atlasIds: stringArray(product.atlasIds)
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
  const maxDate = addChinaDays(today, 30)

  if (normalized < today) {
    throw new BusinessError('配送日期不能早于今天')
  }

  if (normalized > maxDate) {
    throw new BusinessError('当前仅支持选择未来30天内的日期')
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

async function buildPreview(event, identity, requireAddress = false) {
  const user = await ensureUser(identity)
  const items = await buildProductSnapshots(event.items)
  const packaging = packagingById(text(event.packagingId, 'basic'))
  const deliveryMethod = deliveryById(text(event.deliveryMethodId, 'delivery'))
  const address = await resolveAddress(
    identity,
    deliveryMethod.id,
    text(event.addressId),
    requireAddress
  )

  const goodsAmountFen = items.reduce(
    (sum, item) => sum + item.subtotalFen,
    0
  )
  const packagingFeeFen = integer(packaging.feeFen)
  const deliveryFeeFen = integer(deliveryMethod.feeFen)
  const discountFen = 0
  const pointsDeductionFen = 0
  const totalAmountFen = Math.max(
    0,
    goodsAmountFen +
      packagingFeeFen +
      deliveryFeeFen -
      discountFen -
      pointsDeductionFen
  )
  const atlasIds = [...new Set(
    items.flatMap((item) => item.atlasIds)
  )]

  return {
    user: {
      _id: identity.userId,
      nickname: text(user.nickname, '花予用户'),
      points: integer(user.points)
    },
    items,
    atlasIds,
    address,
    packaging: {
      ...packaging,
      feeText: packagingFeeFen > 0
        ? `¥${formatFen(packagingFeeFen)}`
        : '免费'
    },
    deliveryMethod: {
      ...deliveryMethod,
      feeText: deliveryMethod.feePending
        ? '待商家确认'
        : deliveryFeeFen > 0
          ? `¥${formatFen(deliveryFeeFen)}`
          : '免费'
    },
    deliveryDate: text(event.deliveryDate),
    deliverySlot: text(event.deliverySlot),
    cardMessage: text(event.cardMessage).slice(0, 120),
    buyerMessage: text(event.buyerMessage).slice(0, 200),
    amounts: {
      goodsAmountFen,
      packagingFeeFen,
      deliveryFeeFen,
      discountFen,
      pointsDeductionFen,
      totalAmountFen,
      goodsAmountText: formatFen(goodsAmountFen),
      packagingFeeText: formatFen(packagingFeeFen),
      deliveryFeeText: deliveryMethod.feePending
        ? '待确认'
        : formatFen(deliveryFeeFen),
      discountText: formatFen(discountFen),
      pointsDeductionText: formatFen(pointsDeductionFen),
      totalAmountText: formatFen(totalAmountFen),
      amountPending: deliveryMethod.feePending === true
    }
  }
}

async function getCheckoutOptions(identity) {
  await ensureUser(identity)

  return {
    packagingOptions: PACKAGING_OPTIONS
      .filter((item) => item.enabled !== false)
      .sort((a, b) => number(b.sort) - number(a.sort)),
    deliveryMethods: DELIVERY_METHODS,
    deliverySlots: DELIVERY_SLOTS,
    maxDeliveryDays: 30,
    pointsRuleEnabled: false,
    pointsRuleDescription: '积分抵扣规则将在支付版本接入'
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
  const orderId = createId('order')
  const orderNo = createOrderNo()
  const now = new Date()

  const document = {
    orderNo,
    userId: identity.userId,
    customerNickname: preview.user.nickname,
    status: 'pendingConfirm',
    statusLabel: STATUS_META.pendingConfirm.label,
    paymentStatus: 'unpaid',
    deliveryMethodId: preview.deliveryMethod.id,
    deliveryMethodName: preview.deliveryMethod.name,
    deliveryFeePending: preview.deliveryMethod.feePending === true,
    deliveryDate,
    deliverySlot,
    address: preview.address,
    packagingId: preview.packaging.id,
    packagingName: preview.packaging.name,
    packagingDescription: preview.packaging.description,
    cardMessage: preview.cardMessage,
    buyerMessage: preview.buyerMessage,
    merchantNote: '',
    items: preview.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      subtitle: item.subtitle,
      unit: item.unit,
      quantity: item.quantity,
      unitPriceFen: item.unitPriceFen,
      subtotalFen: item.subtotalFen,
      coverFileId: item.coverFileId,
      atlasIds: item.atlasIds
    })),
    atlasIds: preview.atlasIds,
    goodsAmountFen: preview.amounts.goodsAmountFen,
    packagingFeeFen: preview.amounts.packagingFeeFen,
    deliveryFeeFen: preview.amounts.deliveryFeeFen,
    discountFen: preview.amounts.discountFen,
    pointsDeductionFen: preview.amounts.pointsDeductionFen,
    totalAmountFen: preview.amounts.totalAmountFen,
    amountPending: preview.amounts.amountPending,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
    submittedAt: db.serverDate()
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
    status: 'pendingConfirm',
    title: '订单已提交',
    note: '等待商家确认库存与配送安排',
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

function orderView(order, urlMap) {
  const status = text(order.status, 'pendingConfirm')
  const meta = statusMeta(status)
  const items = (Array.isArray(order.items) ? order.items : []).map((item) => ({
    ...item,
    imageUrl: urlMap[text(item.coverFileId)] || '',
    unitPriceText: formatFen(item.unitPriceFen),
    subtotalText: formatFen(item.subtotalFen)
  }))

  return {
    _id: text(order._id),
    orderNo: text(order.orderNo),
    status,
    statusLabel: meta.label,
    statusDescription: meta.description,
    paymentStatus: text(order.paymentStatus, 'unpaid'),
    customerNickname: text(order.customerNickname, '花予用户'),
    deliveryMethodId: text(order.deliveryMethodId),
    deliveryMethodName: text(order.deliveryMethodName),
    deliveryFeePending: order.deliveryFeePending === true,
    deliveryDate: text(order.deliveryDate),
    deliverySlot: text(order.deliverySlot),
    address: order.address
      ? {
          ...order.address,
          phoneMasked: maskPhone(order.address.phone)
        }
      : null,
    packagingId: text(order.packagingId),
    packagingName: text(order.packagingName),
    packagingDescription: text(order.packagingDescription),
    cardMessage: text(order.cardMessage),
    buyerMessage: text(order.buyerMessage),
    merchantNote: text(order.merchantNote),
    items,
    itemCount: items.reduce((sum, item) => sum + integer(item.quantity), 0),
    atlasIds: stringArray(order.atlasIds),
    amounts: {
      goodsAmountFen: integer(order.goodsAmountFen),
      packagingFeeFen: integer(order.packagingFeeFen),
      deliveryFeeFen: integer(order.deliveryFeeFen),
      discountFen: integer(order.discountFen),
      pointsDeductionFen: integer(order.pointsDeductionFen),
      totalAmountFen: integer(order.totalAmountFen),
      goodsAmountText: formatFen(order.goodsAmountFen),
      packagingFeeText: formatFen(order.packagingFeeFen),
      deliveryFeeText: order.deliveryFeePending === true
        ? '待确认'
        : formatFen(order.deliveryFeeFen),
      discountText: formatFen(order.discountFen),
      pointsDeductionText: formatFen(order.pointsDeductionFen),
      totalAmountText: formatFen(order.totalAmountFen),
      amountPending: order.amountPending === true
    },
    canCancel: ['pendingConfirm', 'pendingPayment'].includes(status),
    canPay: status === 'pendingPayment',
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
    .filter((item) => !status || status === 'all' || item.status === status)
    .sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))

  const urlMap = await resolveFileUrls(
    filtered.flatMap((order) =>
      (Array.isArray(order.items) ? order.items : [])
        .map((item) => item.coverFileId)
    )
  )

  const counts = {
    all: allItems.length,
    pendingConfirm: 0,
    pendingPayment: 0,
    making: 0,
    delivering: 0,
    completed: 0
  }

  for (const item of allItems) {
    if (Object.prototype.hasOwnProperty.call(counts, item.status)) {
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
        return success(await getCheckoutOptions(identity))
      case 'previewOrder':
        return success(await previewOrder(event, identity))
      case 'createOrder':
        return success(await createOrder(event, identity))
      case 'listOrders':
        return success(await listOrders(event, identity))
      case 'getOrderDetail':
        return success(await getOrderDetail(event, identity))
      case 'cancelOrder':
        return success(await cancelOrder(event, identity))
      default:
        throw new BusinessError(`未知操作：${action}`, 'UNKNOWN_ACTION')
    }
  } catch (error) {
    return failure(error)
  }
}
