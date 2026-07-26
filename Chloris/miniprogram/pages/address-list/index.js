const {
  getLayoutMetrics
} = require('../../utils/layout')
const {
  listAddresses,
  deleteAddress,
  setDefaultAddress
} = require('../../services/user-service')

function buildLayout() {
  const metrics = getLayoutMetrics()
  const width = Number(metrics.windowWidth || 375)

  return {
    contentHeight: metrics.contentHeight,
    horizontalPadding: Number(metrics.horizontalPadding || (width <= 350 ? 14 : width >= 768 ? 28 : 18)),
    compactLayout: Boolean(metrics.isSmallScreen || width <= 350),
    wideLayout: Boolean(metrics.isWideScreen || width >= 720)
  }
}

Page({
  data: {
    contentHeight: 520,
    horizontalPadding: 18,
    compactLayout: false,
    wideLayout: false,
    loading: true,
    selecting: false,
    items: []
  },

  onLoad(options = {}) {
    this.setData({
      ...buildLayout(),
      selecting: String(options.select || '') === '1'
    })
  },

  onShow() {
    this.loadAddresses()
  },

  onResize() {
    this.setData(buildLayout())
  },

  async loadAddresses() {
    this.setData({ loading: true })

    try {
      const result = await listAddresses()
      this.setData({
        items: result.items || [],
        loading: false
      })
    } catch (error) {
      console.error('地址列表加载失败：', error)
      this.setData({ loading: false })
      wx.showToast({
        title: error.message || '地址加载失败',
        icon: 'none'
      })
    }
  },

  addAddress() {
    wx.navigateTo({
      url: '/pages/address-edit/index'
    })
  },

  editAddress(event) {
    const id = String(event.currentTarget.dataset.id || '')
    if (!id) return

    wx.navigateTo({
      url: `/pages/address-edit/index?id=${encodeURIComponent(id)}`
    })
  },

  selectAddress(event) {
    if (!this.data.selecting) return

    const id = String(event.currentTarget.dataset.id || '')
    const item = this.data.items.find((row) => row._id === id)
    if (!item) return

    wx.setStorageSync('huayu_selected_address_v1', item)
    wx.navigateBack({ delta: 1 })
  },

  setDefault(event) {
    const id = String(event.currentTarget.dataset.id || '')
    if (!id) return

    setDefaultAddress(id)
      .then(() => {
        wx.showToast({ title: '已设为默认', icon: 'success' })
        this.loadAddresses()
      })
      .catch((error) => {
        wx.showToast({ title: error.message || '设置失败', icon: 'none' })
      })
  },

  removeAddress(event) {
    const id = String(event.currentTarget.dataset.id || '')
    if (!id) return

    wx.showModal({
      title: '删除地址',
      content: '确定删除这个收货地址吗？',
      confirmText: '删除',
      confirmColor: '#7d665c',
      success: async (result) => {
        if (!result.confirm) return

        try {
          await deleteAddress(id)
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadAddresses()
        } catch (error) {
          wx.showToast({ title: error.message || '删除失败', icon: 'none' })
        }
      }
    })
  }
})
