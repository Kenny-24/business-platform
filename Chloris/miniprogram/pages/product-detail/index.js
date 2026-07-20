const { fetchProductDetail } = require('../../services/home-data')
const { addToCart } = require('../../services/storage')

function formatPrice(value) {
  const number = Number(value || 0)
  if (!Number.isFinite(number)) return '0'
  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function defaultDetail(product) {
  const typeLabels = {
    flower: '鲜切花材',
    bouquet: '成品花束',
    succulent: '多肉植物',
    greenPlant: '绿植',
    vase: '花器',
    gift: '礼品'
  }

  return {
    ...product,
    typeLabel: typeLabels[product.type] || product.category || '鲜花商品',
    priceText: formatPrice(product.price),
    galleryUrls: Array.isArray(product.galleryUrls) && product.galleryUrls.length
      ? product.galleryUrls
      : product.image
        ? [product.image]
        : [],
    flowerMaterialInfo:
      product.flowerMaterialInfo ||
      '主花材与配花会根据季节和当日到货状态进行搭配。需要替换主要花材时，商户会提前与你沟通。',
    careDescription:
      product.careDescription ||
      '收到后请及时拆除运输包装、修剪花脚并放入清水中，避免阳光直射和空调出风口。'
  }
}

Page({
  data: {
    id: '',
    loading: true,
    loadFailed: false,
    product: null,
    mediaIndex: 0,
    expandedSection: 'materials'
  },

  onLoad(options = {}) {
    const id = String(options.id || '')
    this.setData({ id })
    this.loadProduct()
  },

  async loadProduct(forceRefresh = false) {
    if (!this.data.id) {
      this.setData({ loading: false, loadFailed: true })
      return
    }

    this.setData({ loading: true, loadFailed: false })

    try {
      const product = defaultDetail(
        await fetchProductDetail(this.data.id, { forceRefresh })
      )
      this.setData({
        product,
        loading: false,
        mediaIndex: 0
      })
    } catch (error) {
      console.error('商品详情加载失败：', error)
      this.setData({ loading: false, loadFailed: true })
      wx.showToast({ title: error.message || '商品详情加载失败', icon: 'none' })
    }
  },

  onMediaChange(event) {
    this.setData({ mediaIndex: Number(event.detail.current || 0) })
  },

  previewImage(event) {
    const current = String(event.currentTarget.dataset.src || '')
    const urls = this.data.product && this.data.product.galleryUrls || []
    if (!current || !urls.length) return
    wx.previewImage({ current, urls })
  },

  toggleSection(event) {
    const key = String(event.currentTarget.dataset.key || '')
    this.setData({ expandedSection: this.data.expandedSection === key ? '' : key })
  },

  addProduct() {
    const product = this.data.product
    if (!product || product.stock <= 0) {
      wx.showToast({ title: '当前商品已售罄', icon: 'none' })
      return
    }
    addToCart(product)
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  buyNow() {
    const product = this.data.product
    if (!product || product.stock <= 0) {
      wx.showToast({ title: '当前商品已售罄', icon: 'none' })
      return
    }
    addToCart(product)
    wx.switchTab({ url: '/pages/cart/index' })
  },

  openCart() {
    wx.switchTab({ url: '/pages/cart/index' })
  }
})
