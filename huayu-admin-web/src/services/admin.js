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
    return callAdmin('toggleProduct', { id, field, value })
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
  },

  listCalendarEvents() {
    return callAdmin('listCalendarEvents')
  },

  saveCalendarEvent(item) {
    return callAdmin('saveCalendarEvent', { item })
  },

  deleteCalendarEvent(eventKey) {
    return callAdmin('deleteCalendarEvent', { eventKey })
  },

  listOrders(filters = {}) {
    return callAdmin('listOrders', { filters })
  },

  getOrder(id) {
    return callAdmin('getOrder', { id })
  },

  confirmOrder(id, payload = {}) {
    return callAdmin('confirmOrder', { id, ...payload })
  },

  rejectOrder(id, reason) {
    return callAdmin('rejectOrder', { id, reason })
  },

  markOrderPaid(id, note = '') {
    return callAdmin('markOrderPaid', { id, note })
  },

  startDelivery(id, note = '') {
    return callAdmin('startDelivery', { id, note })
  },

  completeOrder(id, note = '') {
    return callAdmin('completeOrder', { id, note })
  },

  cancelAdminOrder(id, reason) {
    return callAdmin('cancelAdminOrder', { id, reason })
  },

  listUsers(filters = {}) {
    return callAdmin('listUsers', { filters })
  },

  getUser(id) {
    return callAdmin('getUser', { id })
  }
}
