const { fetchHomeData } = require('../../services/home-data')
const { flowers, bouquets, succulents } = require('../../data/mock')
const { addToCart } = require('../../services/storage')

const CATEGORY_INTENT_KEY = 'huayuCategoryIntent'

const FILTERS = [
  {
    key: 'recipient',
    label: '送给谁',
    options: [
      { value: '', label: '不限' },
      { value: 'self', label: '给自己' },
      { value: 'lover', label: '恋人 / 伴侣' },
      { value: 'friend', label: '朋友' },
      { value: 'elder', label: '长辈' },
      { value: 'space', label: '家庭 / 商业空间' }
    ]
  },
  {
    key: 'color',
    label: '偏爱哪种颜色',
    options: [
      { value: '', label: '不限' },
      { value: '粉色', label: '粉色 / 裸粉' },
      { value: '白色', label: '白色 / 白绿' },
      { value: '香槟色', label: '香槟色' },
      { value: '红色', label: '红色 / 酒红' },
      { value: '紫色', label: '紫色 / 蓝紫' },
      { value: '黄色', label: '黄色 / 橙黄' },
      { value: '绿色', label: '绿色系' }
    ]
  }
]

const DEFAULT_SELECTIONS = {
  recipient: '',
  color: ''
}

const RECIPIENT_KEYWORDS = {
  self: ['给自己', '日常', '办公室', '居家'],
  lover: ['恋人', '浪漫', '纪念', '周年'],
  friend: ['朋友', '生日', '感谢'],
  elder: ['长辈', '感谢', '探望'],
  space: ['居家', '空间', '桌花', '软装', '商业']
}

function normalizeProduct(item) {
  const product = {
    ...item,
    id: item.id || item._id,
    type:
      item.type ||
      ({
        鲜花: 'flower',
        花束: 'bouquet',
        多肉植物: 'succulent'
      }[item.category] || ''),
    onSale: item.onSale !== false,
    price: Number(item.price || 0),
    stock: Number(item.stock || 0),
    sceneTags: Array.isArray(item.sceneTags) ? item.sceneTags : [],
    colorTags: Array.isArray(item.colorTags) ? item.colorTags : [],
    searchKeywords: Array.isArray(item.searchKeywords)
      ? item.searchKeywords
      : []
  }

  product._searchText = [
    product.name,
    product.subtitle,
    ...product.sceneTags,
    ...product.colorTags,
    ...product.searchKeywords
  ].join(' ').toLowerCase()

  return product
}

function scoreProduct(item, selections, minPrice, maxPrice) {
  if (item.price < minPrice || item.price > maxPrice) return -1000
  if (selections.color && !item.colorTags.includes(selections.color)) return -1000

  let score = item.featured ? 4 : 0
  if (item.type === 'bouquet') score += 2

  ;(RECIPIENT_KEYWORDS[selections.recipient] || []).forEach((keyword) => {
    if (item._searchText.includes(String(keyword).toLowerCase())) score += 3
  })

  if (selections.color && item._searchText.includes(selections.color.toLowerCase())) {
    score += 2
  }

  return score
}

function buildSections(selections) {
  return FILTERS.map((section) => ({
    ...section,
    selectedValue: selections[section.key] || ''
  }))
}

function parsePrice(value, fallback) {
  const raw = String(value == null ? '' : value).replace(/[^0-9.]/g, '')
  if (!raw) return fallback
  const number = Number(raw)
  return Number.isFinite(number) ? Math.max(0, number) : fallback
}

Page({
  data: {
    filterSections: buildSections(DEFAULT_SELECTIONS),
    selections: { ...DEFAULT_SELECTIONS },
    products: [],
    results: [],
    loading: true,
    minPriceInput: '',
    maxPriceInput: '',
    appliedMinPrice: 0,
    appliedMaxPrice: Number.MAX_SAFE_INTEGER
  },

  onLoad() {
    this.loadProducts()
  },

  onUnload() {
    if (this._priceTimer) clearTimeout(this._priceTimer)
  },

  async loadProducts() {
    let products

    try {
      const data = await fetchHomeData()
      products = (data.products || []).map(normalizeProduct)
    } catch (error) {
      console.warn('选花助手使用内置商品：', error)
      products = [...flowers, ...bouquets, ...succulents].map(normalizeProduct)
    }

    this.setData({ products, loading: false })
    this.buildResults()
  },

  selectOption(event) {
    const key = String(event.currentTarget.dataset.key || '')
    const value = String(event.currentTarget.dataset.value || '')
    if (!key) return

    const selections = {
      ...this.data.selections,
      [key]: value
    }

    this.setData({
      selections,
      filterSections: buildSections(selections)
    })
    this.buildResults()
  },

  onPriceInput(event) {
    const field = String(event.currentTarget.dataset.field || '')
    if (!field) return
    const value = String(event.detail.value || '').replace(/[^0-9.]/g, '')
    this.setData({ [field]: value })

    if (this._priceTimer) clearTimeout(this._priceTimer)
    this._priceTimer = setTimeout(() => this.applyPriceInputs(false), 280)
  },

  onPriceBlur() {
    this.applyPriceInputs(true)
  },

  applyPriceInputs(showMessage = false) {
    let minPrice = parsePrice(this.data.minPriceInput, 0)
    let maxPrice = parsePrice(this.data.maxPriceInput, Number.MAX_SAFE_INTEGER)

    if (maxPrice < minPrice) {
      const temp = minPrice
      minPrice = maxPrice
      maxPrice = temp
      this.setData({
        minPriceInput: String(minPrice),
        maxPriceInput: String(maxPrice)
      })
      if (showMessage) {
        wx.showToast({ title: '已自动调整价格顺序', icon: 'none' })
      }
    }

    this.setData({
      appliedMinPrice: minPrice,
      appliedMaxPrice: maxPrice
    })
    this.buildResults()
  },

  buildResults() {
    const {
      products,
      selections,
      appliedMinPrice,
      appliedMaxPrice
    } = this.data

    const ranked = products
      .filter((item) => item.onSale !== false && item.stock > 0)
      .map((item) => ({
        ...item,
        _score: scoreProduct(
          item,
          selections,
          appliedMinPrice,
          appliedMaxPrice
        )
      }))
      .filter((item) => item._score > -900)
      .sort(
        (a, b) =>
          b._score - a._score ||
          Number(b.featured) - Number(a.featured) ||
          Number(b.sort || 0) - Number(a.sort || 0)
      )

    this.setData({ results: ranked.slice(0, 12) })
  },

  resetFilters() {
    const selections = { ...DEFAULT_SELECTIONS }
    this.setData({
      selections,
      filterSections: buildSections(selections),
      minPriceInput: '',
      maxPriceInput: '',
      appliedMinPrice: 0,
      appliedMaxPrice: Number.MAX_SAFE_INTEGER
    })
    this.buildResults()
  },

  addProduct(event) {
    const item = event.detail.item
    if (!item || item.stock <= 0) {
      wx.showToast({ title: '当前商品已售罄', icon: 'none' })
      return
    }

    addToCart(item)
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  openProduct(event) {
    const item = event.detail && event.detail.item
    const id = String(item && (item.id || item._id) || '')
    if (!id) return

    wx.navigateTo({
      url: `/pages/product-detail/index?id=${encodeURIComponent(id)}`
    })
  },

  seeMore() {
    wx.setStorageSync(CATEGORY_INTENT_KEY, '花束')
    wx.switchTab({ url: '/pages/category/index' })
  }
})
