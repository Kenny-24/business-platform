const {
  createQuoteRequest,
  uploadFile,
  getCachedUser
} = require('../../services/user-service')

function isValidPhone(value) {
  return /^1\d{10}$/.test(String(value || '').replace(/\s+/g, ''))
}

Page({
  data: {
    imagePaths: [],
    submitting: false,
    contactName: '',
    contactPhone: '',
    message: ''
  },

  onLoad() {
    const user = getCachedUser() || {}
    this.setData({
      contactName: user.contactName || user.nickname || '',
      contactPhone: user.contactPhone || ''
    })
  },

  chooseImages() {
    const remaining = Math.max(1, 4 - this.data.imagePaths.length)
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (res) => {
        const files = (res.tempFiles || [])
          .map((item) => item.tempFilePath)
          .filter(Boolean)

        this.setData({
          imagePaths: [...this.data.imagePaths, ...files].slice(0, 4)
        })
      }
    })
  },

  removeImage(event) {
    const index = Number(event.currentTarget.dataset.index || 0)
    const next = [...this.data.imagePaths]
    next.splice(index, 1)
    this.setData({ imagePaths: next })
  },

  updateField(event) {
    const field = String(event.currentTarget.dataset.field || '')
    if (!field) return
    this.setData({ [field]: event.detail.value || '' })
  },

  async submit() {
    if (this.data.submitting) return

    const contactName = String(this.data.contactName || '').trim()
    const contactPhone = String(this.data.contactPhone || '').replace(/\s+/g, '')

    if (!this.data.imagePaths.length) {
      wx.showToast({ title: '请至少上传1张参考图', icon: 'none' })
      return
    }

    if (!contactName) {
      wx.showToast({ title: '请填写联系人', icon: 'none' })
      return
    }

    if (!isValidPhone(contactPhone)) {
      wx.showToast({ title: '请填写正确的11位手机号', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    try {
      wx.showLoading({ title: '提交中', mask: true })

      const fileIDs = await Promise.all(
        this.data.imagePaths.map((path) => uploadFile(path, 'quote-requests'))
      )

      await createQuoteRequest({
        images: fileIDs,
        contactName,
        contactPhone,
        message: this.data.message
      })

      wx.hideLoading()
      this.setData({
        imagePaths: [],
        message: ''
      })
      wx.showToast({
        title: '提交成功',
        icon: 'success',
        duration: 1800
      })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '提交失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
