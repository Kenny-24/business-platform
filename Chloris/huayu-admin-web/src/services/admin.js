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

  listFestivalCampaigns() {
    return callAdmin('listFestivalCampaigns')
  },

  saveFestivalCampaign(campaign) {
    return callAdmin('saveFestivalCampaign', { campaign })
  },

  deleteFestivalCampaign(id) {
    return callAdmin('deleteFestivalCampaign', { id })
  },

  listStudios() {
    return callAdmin('listStudios')
  },

  saveStudio(studio) {
    return callAdmin('saveStudio', { studio })
  },

  deleteStudio(id) {
    return callAdmin('deleteStudio', { id })
  },

  listStudioOrders(filters = {}) {
    return callAdmin('listStudioOrders', filters)
  },

  studioAcceptOrder(id, payload = {}) {
    return callAdmin('studioAcceptOrder', { id, ...payload })
  },

  studioStartMaking(id, payload = {}) {
    return callAdmin('studioStartMaking', { id, ...payload })
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

  updateDeliverySchedule(id, payload = {}) {
    return callAdmin('updateDeliverySchedule', { id, ...payload })
  },

  rejectOrder(id, reason) {
    return callAdmin('rejectOrder', { id, reason })
  },

  markOrderPaid(id, note = '') {
    return callAdmin('markOrderPaid', { id, note })
  },

  startDelivery(id, payload = {}) {
    return callAdmin('startDelivery', { id, ...payload })
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
  },

  listQuoteRequests() {
    return callAdmin('listQuoteRequests')
  },

  updateQuoteRequest(id, payload = {}) {
    return callAdmin('updateQuoteRequest', { id, ...payload })
  }
}
