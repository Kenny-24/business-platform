const {
  banners: fallbackBanners,
  atlasItems: fallbackAtlas
} = require('../../data/mock')
const { addToCart } = require('../../services/storage')
const { fetchHomeData } = require('../../services/home-data')
const { getLayoutMetrics } = require('../../utils/layout')

const LOCATION_STORAGE_KEY = 'huayuSelectedLocation'

function getLocationDisplay(location) {
  if (!location) return '选择位置'

  const raw = String(location.name || location.address || '').trim()
  if (!raw) return '选择位置'

  return raw.length > 6 ? `${raw.slice(0, 6)}…` : raw
}

Page({
  data: {
    banners: fallbackBanners,
    flowers: [],
    bouquets: [],
    succulents: [],
    atlasItems: fallbackAtlas,
    currentBanner: 0,
    heroHeight: 560,
    navSolid: false,
    locationText: '选择位置',
    loading: true,
    loadFailed: false
  },

  onLoad() {
    const metrics = getLayoutMetrics()
    const heroHeight = Math.min(
      660,
      Math.max(500, Math.round(metrics.windowHeight * 0.74))
    )

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

    if (nextText !== this.data.locationText) {
      this.setData({ locationText: nextText })
    }
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

      this.setData({
        banners: data.banners.length > 0 ? data.banners : fallbackBanners,
        flowers: products
          .filter((item) => item.type === 'flower')
          .slice(0, 3),
        bouquets: products
          .filter((item) => item.type === 'bouquet')
          .slice(0, 8),
        succulents: products
          .filter((item) => ['succulent', 'greenPlant'].includes(item.type))
          .slice(0, 6),
        atlasItems: data.atlas.length > 0 ? data.atlas.slice(0, 3) : fallbackAtlas,
        currentBanner: 0,
        loading: false
      })

      console.log('花予首页云数据加载成功：', data)
    } catch (error) {
      console.error('花予首页云数据加载失败：', error)
      this.setData({
        loading: false,
        loadFailed: true,
        banners: fallbackBanners,
        atlasItems: fallbackAtlas
      })
    }
  },

  onPageScroll(event) {
    const shouldUseSolidNav = event.scrollTop >= this._navSwitchPoint

    if (shouldUseSolidNav !== this.data.navSolid) {
      this.setData({ navSolid: shouldUseSolidNav })
    }
  },

  onBannerChange(event) {
    this.setData({ currentBanner: event.detail.current })
  },

  chooseLocation() {
    if (!wx.canIUse('chooseLocation')) {
      wx.showToast({
        title: '当前微信版本暂不支持选择位置',
        icon: 'none'
      })
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
        this.setData({
          locationText: getLocationDisplay(selected)
        })

        wx.showToast({
          title: '位置已更新',
          icon: 'success',
          duration: 1200
        })
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

    switch (action) {
      case 'builder':
        this.openBuilder()
        break
      case 'calendar':
        this.openCalendar()
        break
      case 'flowers':
        this.openCategory('鲜花')
        break
      case 'homeDecor':
        this.openCategory('绿植')
        break
      case 'bouquets':
      default:
        this.openCategory('成品花束')
        break
    }
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
  },

  openSectionMore(event) {
    const targetMap = {
      flowers: '鲜花',
      bouquets: '成品花束',
      succulents: '多肉植物',
      atlas: '鲜花',
      calendar: 'calendar'
    }

    const destination = targetMap[event.detail.target] || '推荐'

    if (destination === 'calendar') {
      this.openCalendar()
      return
    }

    this.openCategory(destination)
  },

  openCategory(category) {
    wx.setStorageSync('huayuCategoryIntent', category)
    wx.switchTab({ url: '/pages/category/index' })
  },

  openBuilder() {
    wx.showToast({
      title: '搭配器将在后续版本接入',
      icon: 'none'
    })
  },

  openCalendar() {
    wx.switchTab({ url: '/pages/calendar/index' })
  }
})
