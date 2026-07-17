const crypto = require('crypto')
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

const COLLECTIONS = {
  users: 'users',
  addresses: 'addresses',
  orders: 'orders'
}

const PURCHASED_STATUSES = new Set([
  'making',
  'delivering',
  'completed'
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
      nickname: '花予用户',
      avatarFileId: '',
      memberLevel: 'normal',
      memberLevelLabel: '普通会员',
      points: 0,
      favoriteAtlasIds: [],
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

async function userView(user) {
  return {
    _id: text(user._id),
    nickname: text(user.nickname, '花予用户'),
    avatarFileId: text(user.avatarFileId),
    avatarUrl: await resolveFileUrl(user.avatarFileId),
    memberLevel: text(user.memberLevel, 'normal'),
    memberLevelLabel: text(user.memberLevelLabel, '普通会员'),
    points: Math.max(0, Math.round(number(user.points))),
    favoriteAtlasIds: stringArray(user.favoriteAtlasIds),
    createdAt: isoDate(user.createdAt),
    updatedAt: isoDate(user.updatedAt)
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

async function saveAtlasFavorites(event, identity) {
  const user = await ensureUser(identity)
  const favoriteAtlasIds = sanitizeFavoriteAtlasIds(
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
    sanitizeFavoriteAtlasIds(
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
  const [user, addresses, orders] = await Promise.all([
    ensureUser(identity),
    listUserAddresses(identity.userId),
    listUserOrders(identity.userId)
  ])

  const orderCounts = {
    pendingConfirm: 0,
    pendingPayment: 0,
    making: 0,
    delivering: 0,
    completed: 0
  }

  const purchasedAtlasIds = new Set()
  const favoriteAtlasIds = sanitizeFavoriteAtlasIds(
    user.favoriteAtlasIds
  )

  for (const order of orders) {
    const status = normalizeOrderStatus(order.status)

    if (Object.prototype.hasOwnProperty.call(orderCounts, status)) {
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
      addresses: addresses.length
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
