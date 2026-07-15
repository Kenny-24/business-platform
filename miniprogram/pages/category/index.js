const {
  flowers: demoFlowers,
  bouquets: demoBouquets,
  succulents: demoSucculents,
  categories,
  colors
} = require('../../data/mock')
const { addToCart } = require('../../services/storage')
const { fetchHomeData } = require('../../services/home-data')
const { getLayoutMetrics } = require('../../utils/layout')

const CATEGORY_TYPE_MAP = {
  推荐: 'featured',
  鲜花: 'flower',
  成品花束: 'bouquet',
  多肉植物: 'succulent',
  绿植: 'greenPlant',
  花器: 'vase',
  礼品: 'gift'
}

function demoProducts() {
  return [...demoFlowers, ...demoBouquets, ...demoSucculents]
}

Page({
  data: {
    categories,
    colors,
    activeCategory: 0,
    activeColor: '',
    allProducts: [],
    products: [],
    banner: demoBouquets[0],
    contentHeight: 520,
    loading: true
  },

  onLoad() {
    const metrics = getLayoutMetrics()
    this.setData({ contentHeight: metrics.contentHeight })
    this.loadProducts()
  },

  onShow() {
    const intent = wx.getStorageSync('huayuCategoryIntent')
    if (!intent) return

    const index = this.data.categories.indexOf(intent)
    wx.removeStorageSync('huayuCategoryIntent')

    if (index >= 0) {
      this.setData({ activeCategory: index, activeColor: '' })
      this.applyFilters(index, '')
    }
  },

  async onPullDownRefresh() {
    await this.loadProducts(true)
    wx.stopPullDownRefresh()
  },

  async loadProducts(forceRefresh = false) {
    this.setData({ loading: true })

    try {
      const data = await fetchHomeData({ forceRefresh })
      const allProducts = data.products || []
      const banner =
        allProducts.find((item) => item.type === 'bouquet' && item.image) ||
        allProducts.find((item) => item.image) ||
        demoBouquets[0]

      this.setData({ allProducts, banner, loading: false })
      this.applyFilters(this.data.activeCategory, this.data.activeColor)
    } catch (error) {
      console.error('分类页云商品加载失败：', error)
      const allProducts = demoProducts()
      this.setData({ allProducts, banner: demoBouquets[0], loading: false })
      this.applyFilters(this.data.activeCategory, this.data.activeColor)
    }
  },

  getCategoryProducts(index) {
    const category = this.data.categories[index]
    const type = CATEGORY_TYPE_MAP[category]
    const source = this.data.allProducts

    if (type === 'featured') {
      const featured = source.filter((item) => item.featured === true)
      return featured.length > 0 ? featured : source
    }

    return source.filter((item) => item.type === type)
  },

  applyFilters(index, color) {
    let products = this.getCategoryProducts(index)

    if (color) {
      products = products.filter((item) =>
        item.color === color ||
        (Array.isArray(item.colorTags) && item.colorTags.includes(color))
      )
    }

    this.setData({ products })
  },

  selectCategory(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({ activeCategory: index, activeColor: '' })
    this.applyFilters(index, '')
  },

  selectColor(event) {
    const color = event.currentTarget.dataset.color
    this.setData({ activeColor: color })
    this.applyFilters(this.data.activeCategory, color)
  },

  openProduct(event) {
    const item = event.currentTarget.dataset.item
    wx.showToast({
      title: `${item.name}详情将在下一版接入`,
      icon: 'none'
    })
  },

  addProduct(event) {
    const item = event.detail.item
    if (!item || Number(item.stock || 0) <= 0) {
      wx.showToast({ title: '当前商品已售罄', icon: 'none' })
      return
    }

    addToCart(item)
    wx.showToast({
      title: '已加入购物车',
      icon: 'success',
      duration: 1200
    })
  }
})
