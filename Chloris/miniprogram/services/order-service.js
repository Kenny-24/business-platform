const {
  callCloudFunction
} = require('./cloud-api')
const {
  getCart,
  setCart
} = require('./storage')

const CHECKOUT_DRAFT_KEY = 'huayu_checkout_draft_v1'
const ORDER_CACHE_KEY = 'huayu_orders_cloud_v1'

function writeStorage(key, value) {
  try {
    wx.setStorageSync(key, value)
  } catch (error) {
    console.warn(`保存 ${key} 失败：`, error)
  }
}

function readStorage(key, fallback = null) {
  try {
    const value = wx.getStorageSync(key)
    return value === '' || value === undefined || value === null
      ? fallback
      : value
  } catch (error) {
    return fallback
  }
}

function saveCheckoutDraft(draft) {
  writeStorage(CHECKOUT_DRAFT_KEY, draft)
  return draft
}

function getCheckoutDraft() {
  return readStorage(CHECKOUT_DRAFT_KEY, null)
}

function clearCheckoutDraft() {
  try {
    wx.removeStorageSync(CHECKOUT_DRAFT_KEY)
  } catch (error) {}
}

function getCheckoutOptions() {
  return callCloudFunction(
    'orderApi',
    'getCheckoutOptions'
  )
}

function previewOrder(payload) {
  return callCloudFunction(
    'orderApi',
    'previewOrder',
    payload
  )
}

function createOrder(payload) {
  return callCloudFunction(
    'orderApi',
    'createOrder',
    payload
  )
}

async function listOrders(status = 'all') {
  const result = await callCloudFunction(
    'orderApi',
    'listOrders',
    { status }
  )

  writeStorage(ORDER_CACHE_KEY, result)
  return result
}

function getOrderDetail(id) {
  return callCloudFunction(
    'orderApi',
    'getOrderDetail',
    { id }
  )
}

function respondDeliverySchedule(id, decision) {
  return callCloudFunction(
    'orderApi',
    'respondDeliverySchedule',
    { id, decision }
  )
}

function cancelOrder(id, reason) {
  return callCloudFunction(
    'orderApi',
    'cancelOrder',
    { id, reason }
  )
}

function removeOrderedItems(productIds) {
  const ids = new Set(
    (Array.isArray(productIds) ? productIds : [])
      .map(String)
  )

  if (!ids.size) return getCart()

  const next = getCart().filter((item) => {
    const id = String(item.id || item._id || '')
    return !ids.has(id)
  })

  return setCart(next)
}

function getCachedOrders() {
  return readStorage(ORDER_CACHE_KEY, {
    items: [],
    counts: {},
    total: 0
  })
}

module.exports = {
  saveCheckoutDraft,
  getCheckoutDraft,
  clearCheckoutDraft,
  getCheckoutOptions,
  previewOrder,
  createOrder,
  listOrders,
  getOrderDetail,
  respondDeliverySchedule,
  cancelOrder,
  removeOrderedItems,
  getCachedOrders
}
