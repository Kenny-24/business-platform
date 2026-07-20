const ORDERS_KEY = 'huayu_orders_v1'
const PURCHASED_ATLAS_KEY = 'huayu_purchased_atlas_ids_v1'

const PURCHASED_STATUSES = new Set([
  'paid',
  'confirmed',
  'making',
  'production',
  'delivering',
  'delivery',
  'completed',
  'complete'
])

function text(value) {
  return String(value || '').trim()
}

function stringArray(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(text).filter(Boolean))]
}

function readStorage(key, fallback) {
  try {
    const value = wx.getStorageSync(key)
    return value === '' || value === undefined || value === null
      ? fallback
      : value
  } catch (error) {
    return fallback
  }
}

function orderIsPurchased(order) {
  if (!order || typeof order !== 'object') return false

  if (
    order.paid === true ||
    text(order.paymentStatus).toLowerCase() === 'paid' ||
    order.paidAt ||
    order.completedAt
  ) {
    return true
  }

  return PURCHASED_STATUSES.has(
    text(order.status).toLowerCase()
  )
}

function orderItems(order) {
  const candidates = [
    order && order.items,
    order && order.products,
    order && order.goods,
    order && order.orderItems
  ]

  return candidates.find(Array.isArray) || []
}

function getPurchasedAtlasIds(products = []) {
  const result = new Set(
    stringArray(
      readStorage(PURCHASED_ATLAS_KEY, [])
    )
  )

  const productMap = new Map(
    (Array.isArray(products) ? products : []).map((product) => [
      text(product && (product.id || product._id)),
      stringArray(product && product.atlasIds)
    ])
  )

  const orders = readStorage(ORDERS_KEY, [])
  const orderList = Array.isArray(orders) ? orders : []

  orderList
    .filter(orderIsPurchased)
    .forEach((order) => {
      stringArray(order.atlasIds).forEach((id) => result.add(id))

      orderItems(order).forEach((item) => {
        stringArray(item && item.atlasIds).forEach((id) => result.add(id))

        const directId = text(item && item.atlasId)
        if (directId) result.add(directId)

        const productId = text(
          item && (item.productId || item.id || item._id)
        )

        const linkedIds = productMap.get(productId) || []
        linkedIds.forEach((id) => result.add(id))
      })
    })

  return [...result]
}

function recordPurchasedAtlasIds(ids) {
  const merged = new Set([
    ...stringArray(readStorage(PURCHASED_ATLAS_KEY, [])),
    ...stringArray(ids)
  ])

  const result = [...merged]

  try {
    wx.setStorageSync(PURCHASED_ATLAS_KEY, result)
  } catch (error) {
    console.warn('保存已购图鉴失败：', error)
  }

  return result
}

module.exports = {
  getPurchasedAtlasIds,
  recordPurchasedAtlasIds
}
