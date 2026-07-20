function callCloudFunction(name, action, payload = {}) {
  if (!wx.cloud) {
    return Promise.reject(
      new Error('当前微信基础库不支持云开发')
    )
  }

  return wx.cloud
    .callFunction({
      name,
      data: {
        action,
        ...payload
      }
    })
    .then((response) => {
      const result = response && response.result

      if (!result || result.ok !== true) {
        const error = new Error(
          result && result.message
            ? result.message
            : `${name}.${action} 调用失败`
        )

        error.code =
          result && result.code
            ? result.code
            : 'CLOUD_API_ERROR'

        throw error
      }

      return result.data
    })
}

module.exports = {
  callCloudFunction
}
