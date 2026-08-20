const {
  getLayoutMetrics
} = require('../../utils/layout')
const {
  getAddress,
  saveAddress
} = require('../../services/user-service')

function buildLayout() {
  const metrics = getLayoutMetrics()
  const width = Number(metrics.windowWidth || 375)

  return {
    contentHeight: metrics.contentHeight,
    horizontalPadding: Number(metrics.horizontalPadding || (width <= 350 ? 14 : width >= 768 ? 28 : 18)),
    compactLayout: Boolean(metrics.isSmallScreen || width <= 350),
    wideLayout: Boolean(metrics.isWideScreen || width >= 720)
  }
}

function finiteNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function cleanMapAddress(address, province, city, district) {
  let result = String(address || '').trim()

  ;[province, city, district]
    .filter(Boolean)
    .forEach((part) => {
      const normalized = String(part).trim()
      if (normalized && result.startsWith(normalized)) {
        result = result.slice(normalized.length).trim()
      }
    })

  return result
}

function buildMapDetail(result, form) {
  const cleanedAddress = cleanMapAddress(
    result.address,
    form.province,
    form.city,
    form.district
  )
  const name = String(result.name || '').trim()

  if (name && cleanedAddress.includes(name)) {
    return cleanedAddress
  }

  if (
    name &&
    cleanedAddress &&
    name.includes(cleanedAddress)
  ) {
    return name
  }

  return [cleanedAddress, name]
    .filter(Boolean)
    .join(' ')
}

Page({
  data: {
    contentHeight: 520,
    horizontalPadding: 18,
    compactLayout: false,
    wideLayout: false,
    id: '',
    loading: false,
    saving: false,
    regionText: '请选择省、市、区',
    locationText: '选择地图位置',
    form: {
      receiverName: '',
      phone: '',
      province: '',
      city: '',
      district: '',
      detail: '',
      label: '家',
      isDefault: false,
      locationName: '',
      locationAddress: '',
      latitude: null,
      longitude: null
    }
  },

  onLoad(options = {}) {
    const id = String(options.id || '')
    this.setData({
      ...buildLayout(),
      id
    })

    if (id) this.loadAddress(id)
  },

  onResize() {
    this.setData(buildLayout())
  },

  async loadAddress(id) {
    this.setData({ loading: true })

    try {
      const address = await getAddress(id)
      const locationName = address.locationName || ''
      const locationAddress = address.locationAddress || ''

      this.setData({
        loading: false,
        form: {
          receiverName: address.receiverName || '',
          phone: address.phone || '',
          province: address.province || '',
          city: address.city || '',
          district: address.district || '',
          detail: address.detail || '',
          label: address.label || '家',
          isDefault: address.isDefault === true,
          locationName,
          locationAddress,
          latitude: finiteNumber(address.latitude),
          longitude: finiteNumber(address.longitude)
        },
        regionText: [
          address.province,
          address.city,
          address.district
        ].filter(Boolean).join(' '),
        locationText:
          locationName ||
          locationAddress ||
          '选择地图位置'
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({
        title: error.message || '地址加载失败',
        icon: 'none'
      })
    }
  },

  updateField(event) {
    const field = String(
      event.currentTarget.dataset.field || ''
    )
    if (!field) return

    this.setData({
      [`form.${field}`]: event.detail.value
    })
  },

  chooseRegion(event) {
    const value = event.detail.value || []

    this.setData({
      'form.province': value[0] || '',
      'form.city': value[1] || '',
      'form.district': value[2] || '',
      regionText: value.filter(Boolean).join(' ')
    })
  },

  chooseMapLocation() {
    wx.chooseLocation({
      success: (result) => {
        const detail = buildMapDetail(
          result,
          this.data.form
        )
        const locationName =
          String(result.name || '').trim()
        const locationAddress =
          String(result.address || '').trim()

        this.setData({
          'form.locationName': locationName,
          'form.locationAddress': locationAddress,
          'form.latitude': finiteNumber(result.latitude),
          'form.longitude': finiteNumber(result.longitude),
          'form.detail': detail || this.data.form.detail,
          locationText:
            locationName ||
            locationAddress ||
            '已选择地图位置'
        })

        wx.showToast({
          title: '已填入定位地址',
          icon: 'success'
        })
      },
      fail: (error) => {
        const message = String(
          error && error.errMsg || ''
        )

        if (message.includes('cancel')) {
          return
        }

        if (
          message.includes('auth deny') ||
          message.includes('auth denied')
        ) {
          wx.showModal({
            title: '需要位置权限',
            content:
              '请在设置中允许微信使用位置，之后即可从地图选择收货地址。',
            confirmText: '去设置',
            confirmColor: '#6f8050',
            success: (result) => {
              if (result.confirm) {
                wx.openSetting()
              }
            }
          })
          return
        }

        wx.showToast({
          title: '地图定位失败，请稍后重试',
          icon: 'none'
        })
      }
    })
  },

  chooseLabel(event) {
    const label = String(
      event.currentTarget.dataset.label || '家'
    )
    this.setData({
      'form.label': label
    })
  },

  toggleDefault(event) {
    this.setData({
      'form.isDefault':
        event.detail.value === true
    })
  },

  async submit() {
    if (this.data.saving) return

    const form = this.data.form

    if (!String(form.receiverName || '').trim()) {
      wx.showToast({
        title: '请填写收货人姓名',
        icon: 'none'
      })
      return
    }

    if (
      !/^1\d{10}$/.test(
        String(form.phone || '')
          .replace(/\s+/g, '')
      )
    ) {
      wx.showToast({
        title: '请输入正确手机号',
        icon: 'none'
      })
      return
    }

    if (
      !form.province ||
      !form.city ||
      !form.district
    ) {
      wx.showToast({
        title: '请选择省、市、区',
        icon: 'none'
      })
      return
    }

    if (!String(form.detail || '').trim()) {
      wx.showToast({
        title: '请填写详细地址',
        icon: 'none'
      })
      return
    }

    this.setData({
      saving: true
    })

    try {
      const address = await saveAddress({
        _id: this.data.id,
        ...form
      })

      wx.setStorageSync(
        'huayu_selected_address_v1',
        address
      )
      wx.showToast({
        title: '地址已保存',
        icon: 'success'
      })

      setTimeout(() => {
        wx.navigateBack({
          delta: 1
        })
      }, 450)
    } catch (error) {
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      })
    } finally {
      this.setData({
        saving: false
      })
    }
  }
})
