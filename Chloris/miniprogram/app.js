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

function writeStorage(key, value) {
  try {
    wx.setStorageSync(key, value)
  } catch (error) {
    console.warn(`保存 ${key} 失败：`, error)
  }
}

App({
  onLaunch() {
    this.globalData.startupSplashStartedAt = Date.now()
    this.globalData.startupSplashFinished = false

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
        console.log('Chloris 顾客身份初始化完成')
        this.maybePromptLocation(user)
      })
      .catch((error) => {
        console.warn('顾客身份初始化暂未完成：', error)
        this.maybePromptLocation(null)
      })
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
        this.finishLocationPrompt()

        if (!res.confirm) {
          return
        }

        wx.getLocation({
          type: 'gcj02',
          success: (location) => {
            const latestLocation = {
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy,
              horizontalAccuracy: location.horizontalAccuracy,
              verticalAccuracy: location.verticalAccuracy,
              source: 'firstLaunch'
            }

            writeStorage(LOCATION_STORAGE_KEY, latestLocation)

            saveLocation(latestLocation)
              .then((result) => {
                if (result && result.lastLocation) {
                  writeStorage(LOCATION_STORAGE_KEY, result.lastLocation)
                }
              })
              .catch((error) => {
                console.warn('保存最新定位失败：', error)
              })
          },
          fail: (error) => {
            console.warn('获取定位失败：', error)
          }
        })
      },
      fail: () => {
        this._locationPrompting = false
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
    startupSplashStartedAt: 0,
    startupSplashFinished: false
  }
})
