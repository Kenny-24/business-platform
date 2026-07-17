const { getLayoutMetrics } = require('./utils/layout')
const { ensureUser } = require('./services/user-service')

const CLOUD_ENV_ID = 'cloudbase-d6gspds9z5e38b6f0'

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('当前微信基础库不支持云开发')
      return
    }

    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true
    })

    this.globalData.layout = getLayoutMetrics()
    console.log('花予云开发初始化完成：', CLOUD_ENV_ID)

    ensureUser()
      .then((user) => {
        this.globalData.user = user
        console.log('花予顾客身份初始化完成')
      })
      .catch((error) => {
        console.warn('顾客身份初始化暂未完成：', error)
      })
  },

  globalData: {
    brandName: '花予',
    cloudEnvId: CLOUD_ENV_ID,
    layout: null,
    user: null
  }
})
