const {
  flowers: demoFlowers,
  bouquets: demoBouquets,
  succulents: demoSucculents
} = require('../../data/mock')
const { addToCart, getCart, setCart } = require('../../services/storage')
const { fetchHomeData } = require('../../services/home-data')
const { getLayoutMetrics } = require('../../utils/layout')

const CATEGORY_INTENT_KEY = 'huayuCategoryIntent'
const CATEGORY_SEARCH_KEY = 'huayuCategorySearch'

const CATEGORY_DEFINITIONS = [
  { label: '花束', match: (item) => item.type === 'bouquet' },
  { label: '鲜切花材', match: (item) => item.type === 'flower' },
  { label: '绿植多肉', match: (item) => ['succulent', 'greenPlant'].includes(item.type) },
  {
    label: '家居插花',
    keywords: ['居家', '空间', '桌花', '瓶插'],
    fallbackTypes: ['flower', 'bouquet', 'greenPlant']
  },
  {
    label: '礼赠花礼',
    keywords: ['礼盒', '生日', '纪念', '感谢', '恋人'],
    fallbackTypes: ['bouquet', 'gift']
  },
  { label: '花器礼品', match: (item) => ['vase', 'gift'].includes(item.type) }
]

function normalizeText(value) {
  return String(value || '').trim()
}

function formatPrice(value) {
  const number = Number(value || 0)
  if (!Number.isFinite(number)) return '0'
  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function prepareProduct(item) {
  const product = {
    ...item,
    id: item.id || item._id,
    type:
      item.type ||
      ({ 鲜花: 'flower', 花束: 'bouquet', 多肉植物: 'succulent' }[item.category] || ''),
    onSale: item.onSale !== false,
    stock: Number(item.stock || 0),
    price: Number(item.price || 0),
    priceText: formatPrice(item.price),
    sceneTags: Array.isArray(item.sceneTags) ? item.sceneTags : [],
    colorTags: Array.isArray(item.colorTags)
      ? item.colorTags
      : item.color
        ? [item.color]
        : [],
    searchKeywords: Array.isArray(item.searchKeywords) ? item.searchKeywords : []
  }

  product._searchText = [
    product.name,
    product.subtitle,
    product.unit,
    product.type,
    ...product.searchKeywords,
    ...product.sceneTags,
    ...product.colorTags
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return product
}

function demoProducts() {
  return [...demoFlowers, ...demoBouquets, ...demoSucculents].map(prepareProduct)
}

function matchesCategory(item, definition) {
  if (typeof definition.match === 'function') return definition.match(item)

  const keywords = Array.isArray(definition.keywords) ? definition.keywords : []
  if (keywords.some((keyword) => item._searchText.includes(String(keyword).toLowerCase()))) {
    return true
  }

  return Array.isArray(definition.fallbackTypes)
    ? definition.fallbackTypes.includes(item.type)
    : true
}

function buildResponsiveLayout(metrics) {
  const width = Number(metrics.windowWidth || 375)
  const sidebarWidth = width <= 350 ? 82 : width <= 430 ? 94 : 104
  const mainWidth = Math.max(180, width - sidebarWidth)
  const horizontalPadding = mainWidth < 280 ? 10 : 13
  const gap = mainWidth < 280 ? 8 : 10
  const available = mainWidth - horizontalPadding * 2

  let columns = 1
  if (available >= 600) columns = 4
  else if (available >= 420) columns = 3
  else if (available >= 236) columns = 2

  const cardWidth = Math.max(
    108,
    Math.floor((available - gap * (columns - 1)) / columns)
  )

  return {
    contentHeight: metrics.contentHeight,
    sidebarWidth,
    mainHorizontalPadding: horizontalPadding,
    gridColumns: columns,
    productImageHeight: Math.max(112, Math.min(190, Math.round(cardWidth * 1.08))),
    compactLayout: mainWidth < 280
  }
}

function sortProducts(items, mode) {
  const products = [...items]
  if (mode === 'priceAsc') return products.sort((a, b) => a.price - b.price)
  if (mode === 'priceDesc') return products.sort((a, b) => b.price - a.price)
  if (mode === 'new') {
    return products.sort(
      (a, b) =>
        Number(b.sort || 0) - Number(a.sort || 0) ||
        String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    )
  }

  return products.sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) ||
      Number(b.sort || 0) - Number(a.sort || 0)
  )
}

Page({
  data: {
    categories: CATEGORY_DEFINITIONS.map((item) => item.label),
    activeCategory: 0,
    searchQuery: '',
    sortMode: 'comprehensive',
    allProducts: [],
    products: [],
    resultTitle: '花束',
    resultCount: 0,
    contentHeight: 520,
    sidebarWidth: 92,
    mainHorizontalPadding: 13,
    gridColumns: 2,
    productImageHeight: 132,
    compactLayout: false,
    recentlyAddedId: '',
    loading: true
  },

  onLoad() {
    this.applyLayout()
    this.initializeIntent()
    this.loadProducts()
  },

  onResize() {
    this.applyLayout()
  },

  onShow() {
    this.readIntentSearchOnly()
    if (this.data.allProducts.length) this.applyProducts()
  },

  onUnload() {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    if (this._addedTimer) clearTimeout(this._addedTimer)
  },

  applyLayout() {
    this.setData(buildResponsiveLayout(getLayoutMetrics()))
  },

  initializeIntent() {
    const intent = normalizeText(wx.getStorageSync(CATEGORY_INTENT_KEY))
    const searchQuery = normalizeText(wx.getStorageSync(CATEGORY_SEARCH_KEY))
    const categoryIndex = CATEGORY_DEFINITIONS.findIndex((item) => item.label === intent)

    this.setData({
      activeCategory: categoryIndex >= 0 ? categoryIndex : 0,
      searchQuery
    })

    try {
      wx.removeStorageSync(CATEGORY_INTENT_KEY)
      wx.removeStorageSync(CATEGORY_SEARCH_KEY)
    } catch (error) {}
  },

  readIntentSearchOnly() {
    const searchQuery = normalizeText(wx.getStorageSync(CATEGORY_SEARCH_KEY))
    if (searchQuery && searchQuery !== this.data.searchQuery) {
      this.setData({ searchQuery })
      this.applyProducts()
      try {
        wx.removeStorageSync(CATEGORY_SEARCH_KEY)
      } catch (error) {}
    }
  },

  async loadProducts(forceRefresh = false) {
    if (!this.data.allProducts.length) this.setData({ loading: true })

    let products
    try {
      const data = await fetchHomeData({ forceRefresh })
      products = (data.products || []).map(prepareProduct)
    } catch (error) {
      console.warn('分类页使用内置商品数据：', error)
      products = demoProducts()
    }

    this.setData({ allProducts: products, loading: false })
    this.applyProducts()
  },

  applyProducts(cartSnapshot) {
    const definition = CATEGORY_DEFINITIONS[this.data.activeCategory] || CATEGORY_DEFINITIONS[0]
    const searchQuery = String(this.data.searchQuery || '').trim().toLowerCase()
    const cart = Array.isArray(cartSnapshot) ? cartSnapshot : getCart()
    const cartQuantityMap = cart.reduce((map, item) => {
      const id = String(item && item.id || '')
      if (id) map[id] = Math.max(0, Number(item.quantity || 0))
      return map
    }, {})

    const products = sortProducts(
      this.data.allProducts
        .filter((item) => item.onSale !== false && item.stock > 0)
        .filter((item) => matchesCategory(item, definition))
        .filter((item) => !searchQuery || item._searchText.includes(searchQuery))
        .map((item) => ({
          ...item,
          cartQuantity: cartQuantityMap[String(item.id)] || 0,
          recentlyAdded: String(item.id) === String(this.data.recentlyAddedId || '')
        })),
      this.data.sortMode
    )


    this.setData({
      products,
      resultTitle: definition.label,
      resultCount: products.length
    })
  },

  selectCategory(event) {
    const index = Number(event.currentTarget.dataset.index || 0)
    this.setData({ activeCategory: index })
    this.applyProducts()
  },

  selectSort(event) {
    const mode = String(event.currentTarget.dataset.mode || 'comprehensive')
    const nextMode = mode === 'price'
      ? this.data.sortMode === 'priceAsc'
        ? 'priceDesc'
        : 'priceAsc'
      : mode

    this.setData({ sortMode: nextMode })
    this.applyProducts()
  },

  onSearchInput(event) {
    this.setData({ searchQuery: String(event.detail.value || '') })
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => this.applyProducts(), 220)
  },

  onSearchConfirm() {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this.applyProducts()
  },

  clearSearch() {
    this.setData({ searchQuery: '' })
    this.applyProducts()
  },

  addProduct(event) {
    this.increaseProduct(event, true)
  },

  increaseProduct(event, showAddedToast = false) {
    const id = String(event.currentTarget.dataset.productId || '')
    const item = this.data.products.find((product) => String(product.id) === id)
    if (!item) return

    const currentQuantity = Math.max(0, Number(item.cartQuantity || 0))
    const maxStock = Math.max(1, Number(item.stock || 1))

    if (currentQuantity >= maxStock) {
      wx.showToast({ title: '已达到库存上限', icon: 'none' })
      return
    }

    const cart = addToCart(item)
    const cartItem = cart.find((product) => String(product.id) === id)
    const quantity = Math.max(1, Number(cartItem && cartItem.quantity || 1))

    this.setData({ recentlyAddedId: id })
    this.applyProducts(cart)

    if (showAddedToast || quantity === 1) {
      wx.showToast({
        title: '已加入购物车',
        icon: 'success',
        duration: 900
      })
    }

    if (this._addedTimer) clearTimeout(this._addedTimer)
    this._addedTimer = setTimeout(() => {
      this.setData({ recentlyAddedId: '' })
      this.applyProducts()
    }, 500)
  },

  decreaseProduct(event) {
    const id = String(event.currentTarget.dataset.productId || '')
    if (!id) return

    const cart = getCart()
    const index = cart.findIndex((item) => String(item && item.id || '') === id)
    if (index < 0) return

    const currentQuantity = Math.max(0, Number(cart[index].quantity || 0))
    if (currentQuantity <= 1) {
      cart.splice(index, 1)
    } else {
      cart[index] = {
        ...cart[index],
        quantity: currentQuantity - 1
      }
    }

    setCart(cart)
    this.setData({ recentlyAddedId: '' })
    this.applyProducts(cart)
  },

  stopPropagation() {},


  openProduct(event) {
    const id = String(event.currentTarget.dataset.productId || '')
    if (!id) return

    wx.navigateTo({
      url: `/pages/product-detail/index?id=${encodeURIComponent(id)}`
    })
  }
})
