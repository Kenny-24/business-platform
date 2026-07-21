const {
  banners: fallbackBanners,
  atlasItems: fallbackAtlas
} = require('../../data/mock')
const { addToCart } = require('../../services/storage')
const { fetchHomeData } = require('../../services/home-data')
const { getLayoutMetrics } = require('../../utils/layout')
const { eventMatchesDate, dateKey } = require('../../utils/holiday-engine')
const { saveLocation } = require('../../services/user-service')

const LOCATION_STORAGE_KEY = 'huayuSelectedLocation'
const CATEGORY_INTENT_KEY = 'huayuCategoryIntent'
const CATEGORY_SEARCH_KEY = 'huayuCategorySearch'
const CALENDAR_INTENT_KEY = 'huayuCalendarIntentDate'
const STARTUP_SPLASH_MIN_DURATION = 1100
const STARTUP_SPLASH_MAX_DURATION = 5000
const STARTUP_SPLASH_FADE_DURATION = 260

const CARE_GUIDES = [
  {
    id: 'fresh-cut',
    number: '01',
    title: '鲜切花基础护理',
    summary: '醒花、修剪、换水与摆放的正确顺序。'
  },
  {
    id: 'rose',
    number: '02',
    title: '玫瑰护理',
    summary: '处理保护瓣、垂头与水位的小技巧。'
  },
  {
    id: 'hydrangea',
    number: '03',
    title: '绣球补水',
    summary: '缺水时如何判断并快速恢复状态。'
  }
]

function getLocationDisplay(location) {
  if (!location) return '选择位置'

  const raw = String(location.name || location.address || '').trim()
  if (raw) {
    return raw.length > 6 ? `${raw.slice(0, 6)}…` : raw
  }

  const hasCoordinates =
    Number.isFinite(Number(location.latitude)) &&
    Number.isFinite(Number(location.longitude))

  return hasCoordinates ? '当前位置' : '选择位置'
}

function productSearchText(item) {
  return [
    item.name,
    ...(item.searchKeywords || []),
    ...(item.sceneTags || []),
    ...(item.colorTags || [])
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ')
}

function pickEventProduct(event, products) {
  const available = (products || []).filter(
    (item) => item.onSale !== false && Number(item.stock || 0) > 0
  )

  for (const id of event.productIds || []) {
    const product = available.find(
      (item) => String(item.id) === String(id)
    )
    if (product) return product
  }

  const keywords = (event.searchKeywords || [])
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)

  if (keywords.length) {
    const product = available.find((item) =>
      keywords.some((keyword) => productSearchText(item).includes(keyword))
    )
    if (product) return product
  }

  return available.find((item) => item.featured) || available[0] || null
}

function findUpcomingEvent(events, products) {
  const today = new Date()
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )

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
      dateKey: dateKey(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate()
      ),
      dateLabel: `${date.getMonth() + 1}月${date.getDate()}日`,
      countdown:
        offset === 0
          ? '今天'
          : offset === 1
            ? '明天'
            : `还有${offset}天`,
      name: event.name,
      description:
        event.description ||
        event.title ||
        '为重要日子提前准备一束花。',
      region: event.region || 'domestic',
      regionLabel:
        event.region === 'international' ? '国际节日' : '国内节日',
      productImage: product ? product.image : '',
      categoryIntent: event.categoryIntent || '花束',
      searchKeyword: (event.searchKeywords || [])[0] || event.name
    }
  }

  return null
}

function formatPrice(value) {
  const number = Number(value || 0)
  return Number.isInteger(number)
    ? String(number)
    : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

Page({
  data: {
    banners: fallbackBanners,
    bouquets: [],
    atlasItems: fallbackAtlas,
    careGuides: CARE_GUIDES,
    upcomingEvent: null,
    currentBanner: 0,
    heroHeight: 560,
    navSolid: false,
    locationText: '选择位置',
    loading: true,
    loadFailed: false,
    showStartupSplash: true,
    startupSplashLeaving: false
  },

  onLoad() {
    const app = getApp()
    const showStartupSplash = !Boolean(
      app && app.globalData && app.globalData.startupSplashFinished
    )

    this._startupSplashStartedAt = Number(
      app && app.globalData && app.globalData.startupSplashStartedAt
    ) || Date.now()

    if (showStartupSplash) {
      wx.hideTabBar({ animation: false })
      this._startupSplashSafetyTimer = setTimeout(() => {
        this.finishStartupSplash()
      }, STARTUP_SPLASH_MAX_DURATION)
    }

    const metrics = getLayoutMetrics()
    const heroHeight = Math.min(
      660,
      Math.max(500, Math.round(metrics.windowHeight * 0.74))
    )

    this._navSwitchPoint = Math.max(
      120,
      heroHeight - metrics.navTotalHeight - 48
    )

    const storedLocation =
      (app && app.globalData && app.globalData.latestLocation) ||
      wx.getStorageSync(LOCATION_STORAGE_KEY)

    this.setData({
      heroHeight,
      locationText: getLocationDisplay(storedLocation),
      showStartupSplash
    })

    this.loadHomeData()
  },

  onShow() {
    const app = getApp()
    const latestLocation =
      (app && app.globalData && app.globalData.latestLocation) ||
      wx.getStorageSync(LOCATION_STORAGE_KEY)
    const nextText = getLocationDisplay(latestLocation)

    if (nextText !== this.data.locationText) {
      this.setData({ locationText: nextText })
    }

    if (
      app &&
      typeof app.refreshCurrentLocationIfAuthorized === 'function'
    ) {
      app.refreshCurrentLocationIfAuthorized({
        source: 'homeShow'
      })
    }

    const now = Date.now()
    if (this._hasShown && now - Number(this._lastHomeLoadAt || 0) > 30000) {
      this.loadHomeData()
    }
    this._hasShown = true
  },

  onAppLocationChanged(location) {
    const nextText = getLocationDisplay(location)
    if (nextText !== this.data.locationText) {
      this.setData({ locationText: nextText })
    }
  },

  onUnload() {
    this.clearStartupSplashTimers()
  },

  async onPullDownRefresh() {
    await this.loadHomeData(true)
    wx.stopPullDownRefresh()
  },

  async loadHomeData(forceRefresh = false) {
    if (!this._hasLoadedHomeData) {
      this.setData({ loading: true, loadFailed: false })
    } else if (this.data.loadFailed) {
      this.setData({ loadFailed: false })
    }

    try {
      const data = await fetchHomeData({ forceRefresh })
      const products = data.products || []
      const atlas = data.atlas || []
      const homeAtlas = atlas.filter((item) => item.homeFeatured)
      const featuredAtlas = homeAtlas.length ? homeAtlas : atlas

      const availableBouquets = products
        .filter(
          (item) =>
            item.type === 'bouquet' &&
            item.onSale !== false &&
            Number(item.stock || 0) > 0
        )
        .sort(
          (a, b) =>
            Number(b.featured) - Number(a.featured) ||
            Number(b.sort || 0) - Number(a.sort || 0)
        )
        .slice(0, 8)
        .map((item) => ({
          ...item,
          price: formatPrice(item.price)
        }))

      this._lastHomeLoadAt = Date.now()
      this._hasLoadedHomeData = true
      this.setData({
        banners: data.banners.length ? data.banners : fallbackBanners,
        bouquets: availableBouquets,
        atlasItems: featuredAtlas.length
          ? featuredAtlas.slice(0, 3)
          : fallbackAtlas,
        upcomingEvent: findUpcomingEvent(
          data.calendarEvents || [],
          products
        ),
        currentBanner: 0,
        loading: false
      })
    } catch (error) {
      console.error('Chloris 首页数据加载失败：', error)
      this.setData({
        loading: false,
        loadFailed: true,
        banners: fallbackBanners,
        atlasItems: fallbackAtlas
      })
    } finally {
      this.scheduleStartupSplashFinish()
    }
  },

  scheduleStartupSplashFinish() {
    if (!this.data.showStartupSplash || this._startupSplashFinishTimer) {
      return
    }

    const elapsed = Date.now() - Number(this._startupSplashStartedAt || 0)
    const delay = Math.max(0, STARTUP_SPLASH_MIN_DURATION - elapsed)

    this._startupSplashFinishTimer = setTimeout(() => {
      this.finishStartupSplash()
    }, delay)
  },

  finishStartupSplash() {
    if (!this.data.showStartupSplash || this._startupSplashFinishing) {
      return
    }

    this._startupSplashFinishing = true
    clearTimeout(this._startupSplashSafetyTimer)
    clearTimeout(this._startupSplashFinishTimer)
    this._startupSplashSafetyTimer = null
    this._startupSplashFinishTimer = null

    this.setData({ startupSplashLeaving: true })

    this._startupSplashRemoveTimer = setTimeout(() => {
      this.setData({
        showStartupSplash: false,
        startupSplashLeaving: false
      })

      wx.showTabBar({ animation: false })

      const app = getApp()
      if (app && typeof app.finishStartupSplash === 'function') {
        app.finishStartupSplash()
      }
    }, STARTUP_SPLASH_FADE_DURATION)
  },

  clearStartupSplashTimers() {
    clearTimeout(this._startupSplashSafetyTimer)
    clearTimeout(this._startupSplashFinishTimer)
    clearTimeout(this._startupSplashRemoveTimer)
    this._startupSplashSafetyTimer = null
    this._startupSplashFinishTimer = null
    this._startupSplashRemoveTimer = null
  },

  preventStartupTouch() {},

  onPageScroll(event) {
    const solid = event.scrollTop >= this._navSwitchPoint
    if (solid !== this.data.navSolid) {
      this.setData({ navSolid: solid })
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
          longitude: result.longitude,
          source: 'chooseLocation',
          capturedAt: new Date().toISOString()
        }

        const app = getApp()
        if (app && typeof app.notifyLocationChanged === 'function') {
          app.notifyLocationChanged(selected)
        } else {
          this.setData({ locationText: getLocationDisplay(selected) })
        }
        saveLocation(selected).catch((error) => {
          console.warn('保存用户位置失败：', error)
        })
        wx.showToast({
          title: '配送位置已更新',
          icon: 'success',
          duration: 1200
        })
      },
      fail: (error) => {
        const message = error && error.errMsg ? error.errMsg : ''
        if (message.includes('cancel')) return

        wx.showModal({
          title: '暂时无法选择位置',
          content:
            '请在微信隐私授权中允许使用位置信息，用于判断配送范围。',
          showCancel: false
        })
      }
    })
  },

  onHeroAction(event) {
    const { action, categoryIntent } = event.currentTarget.dataset

    if (action === 'builder') return this.openBuilder()
    if (action === 'calendar') return this.openCalendar()
    if (action === 'flowers') return this.openCategory('花束')
    if (action === 'homeDecor') return this.openCategory('家居插花')
    if (action === 'quote') return this.openQuoteStudio()
    if (action === 'category') {
      return this.openCategory(categoryIntent || '花束')
    }

    return this.openCategory('花束')
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

  openProduct(event) {
    const item = event.detail && event.detail.item
    const id = String(item && (item.id || item._id) || '')
    if (!id) return

    wx.navigateTo({
      url: `/pages/product-detail/index?id=${encodeURIComponent(id)}`
    })
  },

  openSectionMore(event) {
    const target = event.detail.target

    if (target === 'calendar') return this.openCalendar()
    if (target === 'atlas') return this.openAtlas()
    if (target === 'care') return this.openCare()

    return this.openCategory('花束')
  },

  openCategory(category, searchKeyword = '') {
    wx.setStorageSync(CATEGORY_INTENT_KEY, category)
    if (searchKeyword) {
      wx.setStorageSync(CATEGORY_SEARCH_KEY, searchKeyword)
    }
    wx.switchTab({ url: '/pages/category/index' })
  },

  openEvent() {
    const event = this.data.upcomingEvent
    if (!event) return this.openCalendar()

    wx.setStorageSync(CALENDAR_INTENT_KEY, event.dateKey)
    return wx.switchTab({ url: '/pages/calendar/index' })
  },

  openAtlasItem(event) {
    const id = String(event.currentTarget.dataset.id || '')
    if (!id) return this.openAtlas()

    return wx.navigateTo({
      url: `/pages/atlas-detail/index?id=${encodeURIComponent(id)}`
    })
  },

  openAtlas() {
    wx.navigateTo({ url: '/pages/atlas/index' })
  },

  openBuilder() {
    wx.navigateTo({ url: '/pages/flower-picker/index' })
  },

  openQuoteStudio() {
    wx.navigateTo({ url: '/pages/custom-quote/index' })
  },

  openCare(event) {
    const id = event && event.currentTarget
      ? String(event.currentTarget.dataset.id || '')
      : ''

    wx.navigateTo({
      url: `/pages/flower-care/index${
        id ? `?id=${encodeURIComponent(id)}` : ''
      }`
    })
  },

  openCalendar() {
    wx.switchTab({ url: '/pages/calendar/index' })
  }
})
