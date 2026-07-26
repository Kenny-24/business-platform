const { fetchProductDetail } = require('../../services/home-data')
const { addToCart } = require('../../services/storage')
const { getLayoutMetrics } = require('../../utils/layout')

function formatPrice(value) {
  const number = Number(value || 0)
  if (!Number.isFinite(number)) return '0'
  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function formatOperationTime(value) {
  const source = String(value || '').trim()
  if (!source) return ''
  return source.replace('T', ' ').slice(0, 16)
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

  const galleryUrls = Array.isArray(product.galleryUrls) && product.galleryUrls.length
    ? product.galleryUrls
    : product.image
      ? [product.image]
      : []
  const mediaTotal = galleryUrls.length + (product.videoUrl ? 1 : 0)
  const deliveryRange = [product.deliveryStartDate, product.deliveryEndDate].filter(Boolean).join(' 至 ')
  const defaultDeliveryDescription = product.salesMode === 'preorder'
    ? `本商品为预约销售，允许配送日期为 ${deliveryRange || '活动开放的预约日期'}。确认订单后可直接付款，工作室将按预约日期安排制作。`
    : '现货商品最早可选择下单时间 2 小时后的配送时段。实际配送费用、服务范围和送达时间以确认订单页为准。'

  return {
    ...product,
    typeLabel: typeLabels[product.type] || product.category || '鲜花商品',
    priceText: formatPrice(product.price),
    galleryUrls,
    mediaTotal,
    mediaDots: Array.from({ length: mediaTotal }, (_, index) => index),
    coverImage: galleryUrls[0] || product.image || product.videoPosterUrl || '',
    skuText: product.sku || `CHLORIS-${String(product.id || '').slice(-6).toUpperCase()}`,
    detailDescription:
      product.detailDescription ||
      product.subtitle ||
      '由 Chloris 与合作花艺工作室共同完成，作品将依据当日花材状态保持整体色系、层次与风格。',
    sizeDescription:
      product.sizeDescription ||
      '鲜花作品为手工制作，实际尺寸会因花材开放度与枝条形态产生轻微差异。',
    flowerMaterialInfo:
      product.flowerMaterialInfo ||
      '主花材与配花会根据季节和当日到货状态进行搭配。需要替换主要花材时，商户会提前与你沟通。',
    deliveryDescription: product.deliveryDescription || defaultDeliveryDescription,
    careDescription:
      product.careDescription ||
      '收到后请及时拆除运输包装、修剪花脚并放入清水中，避免阳光直射和空调出风口。',
    paymentDescription:
      '确认商品、收货方式与预约时间后可直接付款。付款完成后，订单将进入制作与履约流程。',
    salesModeLabel: product.salesMode === 'preorder' ? '预约销售' : '现货销售',
    preorderDeliveryText: product.salesMode === 'preorder' ? deliveryRange : '',
    reservationDeadlineText: formatOperationTime(product.reservationDeadlineAt || product.preorderEndAt),
    limitedWindowText: product.limitedTimeEnabled
      ? [formatOperationTime(product.saleStartAt), formatOperationTime(product.saleEndAt)].filter(Boolean).join(' 至 ')
      : ''
  }
}

Page({
  data: {
    id: '',
    loading: true,
    loadFailed: false,
    product: null,
    mediaIndex: 0,
    expandedSection: 'features',
    backTop: 24
  },

  onLoad(options = {}) {
    const id = String(options.id || '')
    const metrics = getLayoutMetrics()
    const backTop = metrics.statusBarHeight + Math.max(4, (metrics.navBarHeight - 42) / 2)

    this.setData({ id, backTop })
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
      this.setData({ product, loading: false, mediaIndex: 0 })
    } catch (error) {
      console.error('商品详情加载失败：', error)
      this.setData({ loading: false, loadFailed: true })
      wx.showToast({ title: error.message || '商品详情加载失败', icon: 'none' })
    }
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
      return
    }
    wx.switchTab({ url: '/pages/home/index' })
  },

  onMediaChange(event) {
    this.setData({ mediaIndex: Number(event.detail.current || 0) })
  },

  previewImage(event) {
    const current = String(event.currentTarget.dataset.src || '')
    const urls = (this.data.product && this.data.product.galleryUrls) || []
    if (!current || !urls.length) return
    wx.previewImage({ current, urls })
  },

  toggleSection(event) {
    const key = String(event.currentTarget.dataset.key || '')
    this.setData({ expandedSection: this.data.expandedSection === key ? '' : key })
  },

  copySku() {
    const sku = this.data.product && this.data.product.skuText
    if (!sku) return
    wx.setClipboardData({
      data: sku,
      success: () => wx.showToast({ title: '商品编码已复制', icon: 'none' })
    })
  },

  addProduct() {
    const product = this.data.product
    if (!product || product.stock <= 0) {
      wx.showToast({ title: '当前商品已售罄', icon: 'none' })
      return
    }
    addToCart(product)
    wx.showToast({ title: '已加入购物袋', icon: 'success' })
  },

  buyNow() {
    const product = this.data.product
    if (!product || product.stock <= 0) {
      wx.showToast({ title: '当前商品已售罄', icon: 'none' })
      return
    }
    addToCart(product)
    wx.switchTab({ url: '/pages/cart/index' })
  }
})
