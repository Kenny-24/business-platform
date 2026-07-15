const { getLayoutMetrics } = require('./utils/layout')

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
  },

  globalData: {
    brandName: '花予',
    cloudEnvId: CLOUD_ENV_ID,
    layout: null
  }
})
