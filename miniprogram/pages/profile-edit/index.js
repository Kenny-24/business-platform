const {
  getLayoutMetrics
} = require('../../utils/layout')
const {
  getProfile,
  updateProfile,
  uploadAvatar
} = require('../../services/user-service')

function buildLayout() {
  const metrics = getLayoutMetrics()
  const width = Number(metrics.windowWidth || 375)

  return {
    contentHeight: metrics.contentHeight,
    horizontalPadding: width <= 350 ? 14 : width >= 768 ? 28 : 18,
    wideLayout: width >= 720
  }
}

Page({
  data: {
    contentHeight: 520,
    horizontalPadding: 18,
    wideLayout: false,
    loading: true,
    saving: false,
    avatarTempPath: '',
    form: {
      nickname: '',
      avatarFileId: '',
      avatarUrl: ''
    }
  },

  onLoad() {
    this.setData(buildLayout())
    this.loadProfile()
  },

  onResize() {
    this.setData(buildLayout())
  },

  async loadProfile() {
    try {
      const profile = await getProfile()
      this.setData({
        loading: false,
        form: {
          nickname: profile.nickname || '花予用户',
          avatarFileId: profile.avatarFileId || '',
          avatarUrl: profile.avatarUrl || ''
        }
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '资料加载失败', icon: 'none' })
    }
  },

  chooseAvatar(event) {
    const avatarTempPath = event.detail.avatarUrl || ''
    if (!avatarTempPath) return

    this.setData({ avatarTempPath })
  },

  updateNickname(event) {
    this.setData({
      'form.nickname': event.detail.value
    })
  },

  async submit() {
    if (this.data.saving) return

    const nickname = String(this.data.form.nickname || '').trim()
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    this.setData({ saving: true })

    try {
      let avatarFileId = this.data.form.avatarFileId

      if (this.data.avatarTempPath) {
        avatarFileId = await uploadAvatar(this.data.avatarTempPath)
      }

      await updateProfile({
        nickname,
        avatarFileId
      })

      wx.showToast({ title: '资料已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 450)
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
