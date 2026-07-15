const { getCart, updateCartItem, removeCartItem } = require('../../services/storage')

Page({
  data: { cart: [], total: 0, allSelected: true, points: 320 },
  onShow() { this.refresh() },
  refresh() {
    const cart = getCart()
    const total = cart.filter(i => i.selected).reduce((sum, i) => sum + i.price * i.quantity, 0)
    this.setData({ cart, total, allSelected: cart.length > 0 && cart.every(i => i.selected) })
  },
  toggleItem(e) { const item = e.currentTarget.dataset.item; updateCartItem(item.id, { selected: !item.selected }); this.refresh() },
  changeQty(e) {
    const { item, delta } = e.currentTarget.dataset
    const quantity = Math.max(1, Math.min(item.stock || 99, item.quantity + Number(delta)))
    updateCartItem(item.id, { quantity }); this.refresh()
  },
  remove(e) { removeCartItem(e.currentTarget.dataset.id); this.refresh() },
  toggleAll() {
    const target = !this.data.allSelected
    this.data.cart.forEach(item => updateCartItem(item.id, { selected: target }))
    this.refresh()
  },
  checkout() { if (!this.data.total) return wx.showToast({ title:'请选择商品', icon:'none' }); wx.showToast({ title:'结算功能将在支付接入后开放', icon:'none' }) }
})
