const {
  flowers: demoFlowers,
  bouquets: demoBouquets,
  succulents: demoSucculents,
  categories
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

const TYPE_CATEGORY_MAP = {
  featured: '推荐',
  flower: '鲜花',
  bouquet: '成品花束',
  succulent: '多肉植物',
  greenPlant: '绿植',
  vase: '花器',
  gift: '礼品'
}

const TYPE_LABEL_MAP = {
  flower: '鲜花',
  bouquet: '成品花束',
  succulent: '多肉植物',
  greenPlant: '绿植',
  vase: '花器',
  gift: '礼品'
}

const COLOR_ORDER = [
  '粉色', '白色', '红色', '紫色', '黄色',
  '绿色', '香槟色', '奶油色', '混色'
]

const COLOR_TONE_MAP = {
  粉色: 'pink',
  白色: 'white',
  红色: 'red',
  紫色: 'purple',
  黄色: 'yellow',
  绿色: 'green',
  香槟色: 'champagne',
  奶油色: 'cream',
  混色: 'mixed'
}

const DEFAULT_CATEGORY_HERO = {
  id: 'category-default-hero',
  placement: 'categoryHero',
  scene: '当季精选',
  title: '当季精选',
  subtitle: '只展示当前可售商品',
  cta: '查看推荐',
  actionType: 'category',
  actionValue: 'featured',
  image: ''
}

function normalizeText(value) {
  return String(value || '').trim()
}

function formatPrice(value) {
  const price = Number(value || 0)
  if (!Number.isFinite(price)) return '0'
  if (Number.isInteger(price)) return String(price)
  return price.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function prepareProduct(item) {
  return {
    ...item,
    id: item.id || item._id,
    priceText: formatPrice(item.price)
  }
}

function demoProducts() {
  const flowers = demoFlowers.map((item, index) =>
    prepareProduct({
      ...item,
      type: 'flower',
      featured: index < 3,
      onSale: true,
      colorTags: item.color ? [item.color] : [],
      searchKeywords: []
    })
  )

  const bouquets = demoBouquets.map((item, index) =>
    prepareProduct({
      ...item,
      type: 'bouquet',
      featured: index === 0,
      onSale: true,
      colorTags: [],
      searchKeywords: []
    })
  )

  const succulents = demoSucculents.map((item) =>
    prepareProduct({
      ...item,
      type: 'succulent',
      featured: false,
      onSale: true,
      colorTags: [],
      searchKeywords: []
    })
  )

  return [...flowers, ...bouquets, ...succulents]
}

function productSearchText(item) {
  return [
    item.name,
    item.subtitle,
    item.unit,
    TYPE_LABEL_MAP[item.type],
    ...(Array.isArray(item.searchKeywords) ? item.searchKeywords : []),
    ...(Array.isArray(item.sceneTags) ? item.sceneTags : []),
    ...(Array.isArray(item.colorTags) ? item.colorTags : [])
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function buildResponsiveLayout(metrics) {
  const windowWidth = Number(metrics.windowWidth || 375)
  const sidebarWidth = windowWidth <= 350
    ? 76
    : windowWidth <= 430
      ? 84
      : 92
  const mainWidth = Math.max(180, windowWidth - sidebarWidth)
  const horizontalPadding = mainWidth < 280 ? 10 : 12
  const cardGap = mainWidth < 280 ? 8 : 10
  const availableWidth = mainWidth - horizontalPadding * 2

  let gridColumns = 1
  if (availableWidth >= 600) gridColumns = 4
  else if (availableWidth >= 420) gridColumns = 3
  else if (availableWidth >= 238) gridColumns = 2

  const cardWidth = Math.max(
    108,
    Math.floor(
      (availableWidth - cardGap * (gridColumns - 1)) / gridColumns
    )
  )

  return {
    contentHeight: metrics.contentHeight,
    sidebarWidth,
    mainHorizontalPadding: horizontalPadding,
    gridColumns,
    productImageHeight: Math.max(108, Math.min(180, Math.round(cardWidth))),
    compactLayout: mainWidth < 280
  }
}

Page({
  data: {
    categories,
    activeCategory: 0,
    activeCategoryLabel: categories[0] || '推荐',
    activeColor: '',
    searchQuery: '',
    allProducts: [],
    products: [],
    colorOptions: [],
    showColorFilter: true,
    categoryHero: DEFAULT_CATEGORY_HERO,
    showCategoryHero: true,
    resultTitle: '推荐商品',
    resultCount: 0,
    contentHeight: 520,
    sidebarWidth: 84,
    mainHorizontalPadding: 12,
    gridColumns: 2,
    productImageHeight: 132,
    compactLayout: false,
    loading: true
  },

  onLoad() {
    this.updateResponsiveLayout()
    this.loadProducts()
  },

  onShow() {
    const intent = wx.getStorageSync('huayuCategoryIntent')
    const searchQuery = wx.getStorageSync('huayuCategorySearch')

    wx.removeStorageSync('huayuCategoryIntent')
    wx.removeStorageSync('huayuCategorySearch')

    if (!intent && !searchQuery) return

    const intentIndex = intent
      ? this.data.categories.indexOf(intent)
      : -1
    const activeCategory = intentIndex >= 0
      ? intentIndex
      : this.data.activeCategory
    const activeCategoryLabel =
      this.data.categories[activeCategory] || '推荐'
    const normalizedQuery = String(searchQuery || '').trim()

    this.setData({
      activeCategory,
      activeCategoryLabel,
      activeColor: '',
      searchQuery: normalizedQuery
    })

    this.applyFilters(activeCategory, '', normalizedQuery)
  },

  onResize() {
    this.updateResponsiveLayout()
  },

  onUnload() {
    if (this._searchTimer) clearTimeout(this._searchTimer)
  },

  async onPullDownRefresh() {
    await this.loadProducts(true)
    wx.stopPullDownRefresh()
  },

  updateResponsiveLayout() {
    this.setData(buildResponsiveLayout(getLayoutMetrics()))
  },

  async loadProducts(forceRefresh = false) {
    this.setData({ loading: true })

    try {
      const data = await fetchHomeData({ forceRefresh })
      const allProducts = (data.products || []).map(prepareProduct)
      const categoryHero =
        (data.categoryBanners || [])[0] || DEFAULT_CATEGORY_HERO

      this.setData({
        allProducts,
        categoryHero,
        loading: false
      })

      this.applyFilters(
        this.data.activeCategory,
        this.data.activeColor,
        this.data.searchQuery
      )
    } catch (error) {
      console.error('分类页云商品加载失败：', error)
      this.setData({
        allProducts: demoProducts(),
        categoryHero: DEFAULT_CATEGORY_HERO,
        loading: false
      })
      this.applyFilters(
        this.data.activeCategory,
        this.data.activeColor,
        this.data.searchQuery
      )
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

  getColorOptions(products) {
    const available = new Set()

    products.forEach((item) => {
      const tags = Array.isArray(item.colorTags) ? item.colorTags : []
      tags.forEach((tag) => {
        const label = normalizeText(tag)
        if (label) available.add(label)
      })
    })

    const sorted = [
      ...COLOR_ORDER.filter((color) => available.has(color)),
      ...[...available]
        .filter((color) => !COLOR_ORDER.includes(color))
        .sort()
    ]

    return sorted.map((label) => ({
      label,
      value: label,
      tone: COLOR_TONE_MAP[label] || 'neutral'
    }))
  },

  applyFilters(index, color, query) {
    const cleanQuery = normalizeText(query)
    const normalizedQuery = cleanQuery.toLowerCase()
    const categoryLabel = this.data.categories[index] || '推荐'
    const categoryProducts = this.getCategoryProducts(index)
    let source = normalizedQuery ? this.data.allProducts : categoryProducts

    if (normalizedQuery) {
      source = source.filter((item) =>
        productSearchText(item).includes(normalizedQuery)
      )
    }

    const colorOptions = this.getColorOptions(categoryProducts)
    const colorStillAvailable = colorOptions.some(
      (item) => item.value === color
    )
    const nextColor = colorStillAvailable ? color : ''

    if (nextColor && !normalizedQuery) {
      source = source.filter(
        (item) =>
          Array.isArray(item.colorTags) &&
          item.colorTags.includes(nextColor)
      )
    }

    const showColorFilter =
      !normalizedQuery &&
      ['推荐', '鲜花'].includes(categoryLabel) &&
      colorOptions.length > 0

    this.setData({
      products: source,
      activeCategoryLabel: categoryLabel,
      activeColor: nextColor,
      colorOptions,
      showColorFilter,
      showCategoryHero: !normalizedQuery && categoryLabel === '推荐',
      resultTitle: normalizedQuery
        ? `“${cleanQuery}”的搜索结果`
        : categoryLabel === '推荐'
          ? '推荐商品'
          : categoryLabel,
      resultCount: source.length
    })
  },

  onSearchInput(event) {
    const searchQuery = event.detail.value || ''
    this.setData({ searchQuery })

    if (this._searchTimer) clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => {
      this.applyFilters(this.data.activeCategory, '', searchQuery)
    }, 180)
  },

  onSearchConfirm(event) {
    const searchQuery = event.detail.value || this.data.searchQuery
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this.setData({ searchQuery })
    this.applyFilters(this.data.activeCategory, '', searchQuery)
  },

  clearSearch() {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this.setData({ searchQuery: '', activeColor: '' })
    this.applyFilters(this.data.activeCategory, '', '')
  },

  selectCategory(event) {
    const index = Number(event.currentTarget.dataset.index)
    if (!Number.isInteger(index) || index < 0) return

    const categoryLabel = this.data.categories[index] || '推荐'
    this.setData({
      activeCategory: index,
      activeCategoryLabel: categoryLabel,
      activeColor: '',
      searchQuery: ''
    })
    this.applyFilters(index, '', '')
  },

  selectColor(event) {
    const color = event.currentTarget.dataset.color || ''
    this.setData({ activeColor: color })
    this.applyFilters(this.data.activeCategory, color, '')
  },

  openCategoryHero() {
    const hero = this.data.categoryHero || DEFAULT_CATEGORY_HERO
    const actionType = hero.actionType || 'category'
    const actionValue = hero.actionValue || 'featured'

    if (actionType === 'calendar') {
      wx.switchTab({ url: '/pages/calendar/index' })
      return
    }

    if (actionType === 'builder') {
      wx.showToast({
        title: '搭配器将在后续版本接入',
        icon: 'none'
      })
      return
    }

    const categoryName = TYPE_CATEGORY_MAP[actionValue] || '推荐'
    const index = this.data.categories.indexOf(categoryName)

    if (index >= 0) {
      this.setData({
        activeCategory: index,
        activeCategoryLabel: categoryName,
        activeColor: '',
        searchQuery: ''
      })
      this.applyFilters(index, '', '')
    }
  },

  findProduct(productId) {
    const normalizedId = String(productId || '')
    return this.data.allProducts.find(
      (item) => String(item.id || item._id) === normalizedId
    ) || null
  },

  openProduct(event) {
    const item = this.findProduct(event.currentTarget.dataset.productId)
    if (!item) return

    wx.showToast({
      title: `${item.name}详情将在下一版接入`,
      icon: 'none'
    })
  },

  addProduct(event) {
    const item = this.findProduct(event.currentTarget.dataset.productId)

    if (!item) {
      wx.showToast({ title: '商品数据不存在', icon: 'none' })
      return
    }

    if (Number(item.stock || 0) <= 0) {
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
