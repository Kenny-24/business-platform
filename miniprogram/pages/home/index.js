const {
  banners: fallbackBanners,
  atlasItems: fallbackAtlas
} = require('../../data/mock')
const { addToCart } = require('../../services/storage')
const { fetchHomeData } = require('../../services/home-data')
const { getLayoutMetrics } = require('../../utils/layout')
const { eventMatchesDate, dateKey } = require('../../utils/holiday-engine')

const LOCATION_STORAGE_KEY = 'huayuSelectedLocation'

function getLocationDisplay(location) {
  if (!location) return '选择位置'
  const raw = String(location.name || location.address || '').trim()
  if (!raw) return '选择位置'
  return raw.length > 6 ? `${raw.slice(0, 6)}…` : raw
}

function productSearchText(item) {
  return [
    item.name,
    ...(item.searchKeywords || []),
    ...(item.sceneTags || []),
    ...(item.colorTags || [])
  ].map((value) => String(value || '').toLowerCase()).join(' ')
}

function pickEventProduct(event, products) {
  const available = (products || []).filter(
    (item) => item.onSale !== false && Number(item.stock || 0) > 0
  )

  for (const id of event.productIds || []) {
    const product = available.find((item) => String(item.id) === String(id))
    if (product) return product
  }

  const keywords = (event.searchKeywords || [])
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)

  if (keywords.length) {
    const product = available.find((item) => {
      const source = productSearchText(item)
      return keywords.some((keyword) => source.includes(keyword))
    })
    if (product) return product
  }

  return available.find((item) => item.featured) || available[0] || null
}

function findUpcomingEvent(events, products) {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  for (let offset = 0; offset <= 120; offset += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + offset)

    const candidates = (events || [])
      .filter((event) => event.enabled !== false && event.rule)
      .filter((event) => eventMatchesDate(event, date))
      .sort((a, b) => Number(b.sort || 0) - Number(a.sort || 0))

    if (!candidates.length) continue

    const event = candidates[0]
    const product = pickEventProduct(event, products)

    return {
      id: event.eventKey,
      dateKey: dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate()),
      dateLabel: `${date.getMonth() + 1}月${date.getDate()}日`,
      countdown: offset === 0 ? '今天' : offset === 1 ? '明天' : `还有${offset}天`,
      name: event.name,
      description: event.description || event.title || '为重要日子提前准备一束花。',
      region: event.region || 'domestic',
      regionLabel: event.region === 'international' ? '国际节日' : '国内节日',
      productImage: product ? product.image : '',
      categoryIntent: event.categoryIntent || '成品花束',
      searchKeyword: (event.searchKeywords || [])[0] || event.name
    }
  }

  return null
}

Page({
  data: {
    banners: fallbackBanners,
    flowers: [],
    bouquets: [],
    succulents: [],
    atlasItems: fallbackAtlas,
    upcomingEvent: null,
    currentBanner: 0,
    heroHeight: 560,
    navSolid: false,
    locationText: '选择位置',
    loading: true,
    loadFailed: false
  },

  onLoad() {
    const metrics = getLayoutMetrics()
    const heroHeight = Math.min(660, Math.max(500, Math.round(metrics.windowHeight * 0.74)))

    this._navSwitchPoint = Math.max(
      120,
      heroHeight - metrics.navTotalHeight - 48
    )

    const storedLocation = wx.getStorageSync(LOCATION_STORAGE_KEY)
    this.setData({
      heroHeight,
      locationText: getLocationDisplay(storedLocation)
    })
    this.loadHomeData()
  },

  onShow() {
    const storedLocation = wx.getStorageSync(LOCATION_STORAGE_KEY)
    const nextText = getLocationDisplay(storedLocation)
    if (nextText !== this.data.locationText) this.setData({ locationText: nextText })

    if (this._hasShown) this.loadHomeData()
    this._hasShown = true
  },

  async onPullDownRefresh() {
    await this.loadHomeData(true)
    wx.stopPullDownRefresh()
  },

  async loadHomeData(forceRefresh = false) {
    this.setData({ loading: true, loadFailed: false })

    try {
      const data = await fetchHomeData({ forceRefresh })
      const products = data.products || []
      const atlas = data.atlas || []
      const homeAtlas = atlas.filter((item) => item.homeFeatured)

      this.setData({
        banners: data.banners.length > 0 ? data.banners : fallbackBanners,
        flowers: products.filter((item) => item.type === 'flower').slice(0, 3),
        bouquets: products.filter((item) => item.type === 'bouquet').slice(0, 8),
        succulents: products.filter((item) => ['succulent', 'greenPlant'].includes(item.type)).slice(0, 6),
        atlasItems: (homeAtlas.length ? homeAtlas : atlas).slice(0, 3).length
          ? (homeAtlas.length ? homeAtlas : atlas).slice(0, 3)
          : fallbackAtlas,
        upcomingEvent: findUpcomingEvent(data.calendarEvents || [], products),
        currentBanner: 0,
        loading: false
      })
    } catch (error) {
      console.error('花予首页数据加载失败：', error)
      this.setData({
        loading: false,
        loadFailed: true,
        banners: fallbackBanners,
        atlasItems: fallbackAtlas
      })
    }
  },

  onPageScroll(event) {
    const solid = event.scrollTop >= this._navSwitchPoint
    if (solid !== this.data.navSolid) this.setData({ navSolid: solid })
  },

  onBannerChange(event) {
    this.setData({ currentBanner: event.detail.current })
  },

  chooseLocation() {
    if (!wx.canIUse('chooseLocation')) {
      wx.showToast({ title: '当前微信版本暂不支持选择位置', icon: 'none' })
      return
    }

    wx.chooseLocation({
      success: (result) => {
        const selected = {
          name: result.name || '',
          address: result.address || '',
          latitude: result.latitude,
          longitude: result.longitude
        }
        wx.setStorageSync(LOCATION_STORAGE_KEY, selected)
        this.setData({ locationText: getLocationDisplay(selected) })
        wx.showToast({ title: '位置已更新', icon: 'success', duration: 1200 })
      },
      fail: (error) => {
        const message = error && error.errMsg ? error.errMsg : ''
        if (message.includes('cancel')) return
        wx.showModal({
          title: '暂时无法选择位置',
          content: '请确认已在小程序后台完成用户隐私保护指引，并允许使用位置信息。',
          showCancel: false
        })
      }
    })
  },

  onHeroAction(event) {
    const { action } = event.currentTarget.dataset
    if (action === 'builder') return this.openBuilder()
    if (action === 'calendar') return this.openCalendar()
    if (action === 'flowers') return this.openCategory('鲜花')
    if (action === 'homeDecor') return this.openCategory('绿植')
    this.openCategory('成品花束')
  },

  addProduct(event) {
    const item = event.detail.item
    if (!item || Number(item.stock || 0) <= 0) {
      wx.showToast({ title: '当前商品已售罄', icon: 'none' })
      return
    }
    addToCart(item)
    wx.showToast({ title: '已加入购物车', icon: 'success', duration: 1200 })
  },

  openSectionMore(event) {
    const target = event.detail.target
    if (target === 'calendar') return this.openCalendar()
    if (target === 'atlas') return this.openAtlas()

    const map = {
      flowers: '鲜花',
      bouquets: '成品花束',
      succulents: '多肉植物'
    }
    this.openCategory(map[target] || '推荐')
  },

  openCategory(category, searchKeyword = '') {
    wx.setStorageSync('huayuCategoryIntent', category)
    if (searchKeyword) wx.setStorageSync('huayuCategorySearch', searchKeyword)
    wx.switchTab({ url: '/pages/category/index' })
  },

  openEvent() {
    const event = this.data.upcomingEvent
    if (!event) return this.openCalendar()
    wx.setStorageSync('huayuCalendarIntentDate', event.dateKey)
    wx.switchTab({ url: '/pages/calendar/index' })
  },

  openAtlasItem(event) {
    const id = String(event.currentTarget.dataset.id || '')
    if (!id) return this.openAtlas()

    wx.navigateTo({
      url: `/pages/atlas-detail/index?id=${encodeURIComponent(id)}`
    })
  },

  openAtlas() {
    wx.navigateTo({ url: '/pages/atlas/index' })
  },

  openBuilder() {
    wx.showToast({ title: '搭配器将在后续版本接入', icon: 'none' })
  },

  openCalendar() {
    wx.switchTab({ url: '/pages/calendar/index' })
  }
})
