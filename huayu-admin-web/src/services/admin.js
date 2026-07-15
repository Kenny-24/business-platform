import { callAdmin } from './cloudbase'

export const adminApi = {
  dashboard() {
    return callAdmin('dashboard')
  },

  listProducts(filters = {}) {
    return callAdmin('listProducts', { filters })
  },

  getProduct(id) {
    return callAdmin('getProduct', { id })
  },

  saveProduct(product) {
    return callAdmin('saveProduct', { product })
  },

  deleteProduct(id) {
    return callAdmin('deleteProduct', { id })
  },

  updateStock(id, stock) {
    return callAdmin('updateStock', { id, stock })
  },

  toggleProduct(id, field, value) {
    return callAdmin('toggleProduct', {
      id,
      field,
      value
    })
  },

  listBanners() {
    return callAdmin('listBanners')
  },

  saveBanner(banner) {
    return callAdmin('saveBanner', { banner })
  },

  deleteBanner(id) {
    return callAdmin('deleteBanner', { id })
  },

  listAtlas() {
    return callAdmin('listAtlas')
  },

  saveAtlas(item) {
    return callAdmin('saveAtlas', { item })
  },

  deleteAtlas(id) {
    return callAdmin('deleteAtlas', { id })
  }
}
