const { getLayoutMetrics } = require('./utils/layout')
const {
  ensureUser,
  saveLocation,
  markLocationPrompted
} = require('./services/user-service')

const CLOUD_ENV_ID = 'cloudbase-d6gspds9z5e38b6f0'
const LOCATION_PROMPTED_KEY = 'chloris_location_prompted_v1'
const LOCATION_STORAGE_KEY = 'huayuSelectedLocation'

function readBooleanStorage(key) {
  try {
    return wx.getStorageSync(key) === true
  } catch (error) {
    return false
  }
}

function readStorage(key) {
  try {
    return wx.getStorageSync(key) || null
  } catch (error) {
    return null
  }
}

function writeStorage(key, value) {
  try {
    wx.setStorageSync(key, value)
  } catch (error) {
    console.warn(`保存 ${key} 失败：`, error)
  }
}

function hasCoordinates(location) {
  return Boolean(
    location &&
    Number.isFinite(Number(location.latitude)) &&
    Number.isFinite(Number(location.longitude))
  )
}

App({
  onLaunch() {
    this.globalData.startupSplashStartedAt = Date.now()
    this.globalData.startupSplashFinished = false
    this.globalData.latestLocation = readStorage(LOCATION_STORAGE_KEY)

    if (!wx.cloud) {
      console.error('当前微信基础库不支持云开发')
      return
    }

    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true
    })

    this.globalData.layout = getLayoutMetrics()
    console.log('Chloris 云开发初始化完成：', CLOUD_ENV_ID)

    ensureUser()
      .then((user) => {
        this.globalData.user = user
        this.restoreSavedLocation(user)
        console.log('Chloris 顾客身份初始化完成')
        this.maybePromptLocation(user)
      })
      .catch((error) => {
        console.warn('顾客身份初始化暂未完成：', error)
        this.maybePromptLocation(null)
      })
  },

  restoreSavedLocation(user) {
    const localLocation = readStorage(LOCATION_STORAGE_KEY)
    const cloudLocation = user && user.lastLocation
    const latestLocation = hasCoordinates(localLocation)
      ? localLocation
      : hasCoordinates(cloudLocation)
        ? cloudLocation
        : null

    if (!latestLocation) return

    writeStorage(LOCATION_STORAGE_KEY, latestLocation)
    this.notifyLocationChanged(latestLocation)
  },

  notifyLocationChanged(location) {
    if (!location) return

    this.globalData.latestLocation = location

    try {
      const pages = typeof getCurrentPages === 'function'
        ? getCurrentPages()
        : []

      pages.forEach((page) => {
        if (page && typeof page.onAppLocationChanged === 'function') {
          page.onAppLocationChanged(location)
        }
      })
    } catch (error) {
      console.warn('同步页面定位状态失败：', error)
    }
  },

  maybePromptLocation(user) {
    if (!this.globalData.startupSplashFinished) {
      this._pendingLocationPrompt = true
      this._pendingLocationUser = user || null
      return
    }

    const promptedLocally = readBooleanStorage(LOCATION_PROMPTED_KEY)
    const promptedInCloud = Boolean(
      user && (user.locationPrompted || user.lastLocation)
    )

    if (promptedLocally || promptedInCloud || this._locationPrompting) {
      if (promptedInCloud && !promptedLocally) {
        writeStorage(LOCATION_PROMPTED_KEY, true)
      }
      return
    }

    this._locationPrompting = true

    wx.showModal({
      title: '获取定位',
      content: '为了判断配送范围并保存你最近一次的配送位置，首次进入小程序时需要请求定位授权。',
      confirmText: '允许',
      cancelText: '暂不',
      success: (res) => {
        if (!res.confirm) {
          this.finishLocationPrompt()
          return
        }

        this.requestAndSaveCurrentLocation()
      },
      fail: () => {
        this._locationPrompting = false
      }
    })
  },

  requestAndSaveCurrentLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (location) => {
        const latestLocation = {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          horizontalAccuracy: location.horizontalAccuracy,
          verticalAccuracy: location.verticalAccuracy,
          source: 'firstLaunch',
          capturedAt: new Date().toISOString()
        }

        // 先更新本地和当前页面，避免必须再次点击“选择位置”才能看到状态。
        writeStorage(LOCATION_STORAGE_KEY, latestLocation)
        this.notifyLocationChanged(latestLocation)
        this.finishLocationPrompt()

        saveLocation(latestLocation)
          .then((result) => {
            if (!result || !result.lastLocation) return

            writeStorage(LOCATION_STORAGE_KEY, result.lastLocation)
            this.notifyLocationChanged(result.lastLocation)
          })
          .catch((error) => {
            console.warn('保存最新定位失败：', error)
          })
      },
      fail: (error) => {
        console.warn('获取定位失败：', error)
        this.finishLocationPrompt()

        const message = String(error && error.errMsg || '')
        if (!message.includes('cancel')) {
          wx.showToast({
            title: '定位未成功，可稍后手动选择',
            icon: 'none',
            duration: 1800
          })
        }
      }
    })
  },

  finishStartupSplash() {
    if (this.globalData.startupSplashFinished) return

    this.globalData.startupSplashFinished = true

    if (this._pendingLocationPrompt) {
      const pendingUser = this._pendingLocationUser || null
      this._pendingLocationPrompt = false
      this._pendingLocationUser = null

      setTimeout(() => {
        this.maybePromptLocation(pendingUser)
      }, 180)
    }
  },

  finishLocationPrompt() {
    writeStorage(LOCATION_PROMPTED_KEY, true)
    this._locationPrompting = false

    markLocationPrompted().catch((error) => {
      console.warn('同步首次定位提示状态失败：', error)
    })
  },

  globalData: {
    brandName: 'Chloris（克罗丽丝）',
    cloudEnvId: CLOUD_ENV_ID,
    layout: null,
    user: null,
    latestLocation: null,
    startupSplashStartedAt: 0,
    startupSplashFinished: false
  }
})
