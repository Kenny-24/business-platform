const CART_KEY = 'huayu_cart_v2'
const POINTS_KEY = 'huayu_points_v2'

function getCart() {
  return wx.getStorageSync(CART_KEY) || []
}

function setCart(cart) {
  wx.setStorageSync(CART_KEY, cart)
  return cart
}

function addToCart(product, quantity = 1) {
  if (!product || !product.id || Number(product.stock || 0) <= 0) {
    return getCart()
  }

  const cart = getCart()
  const index = cart.findIndex((item) => item.id === product.id)
  const maxStock = Math.max(1, Number(product.stock || 1))

  if (index >= 0) {
    cart[index] = {
      ...cart[index],
      ...product,
      quantity: Math.min(
        Number(cart[index].quantity || 0) + quantity,
        maxStock
      )
    }
  } else {
    cart.push({
      ...product,
      quantity: Math.min(quantity, maxStock),
      selected: true
    })
  }

  return setCart(cart)
}

function updateCartItem(id, patch) {
  const cart = getCart().map((item) =>
    item.id === id ? { ...item, ...patch } : item
  )
  return setCart(cart)
}

function removeCartItem(id) {
  return setCart(getCart().filter((item) => item.id !== id))
}

function getPoints() {
  return Math.max(0, Number(wx.getStorageSync(POINTS_KEY) || 0))
}

function setPoints(points) {
  wx.setStorageSync(POINTS_KEY, Math.max(0, Number(points || 0)))
}

module.exports = {
  getCart,
  setCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  getPoints,
  setPoints
}
