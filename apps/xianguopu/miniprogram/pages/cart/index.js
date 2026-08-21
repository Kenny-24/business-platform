const api = require('../../services/api');
const cart = require('../../store/cart');
const ui = require('../../utils/ui');
const { imageUrl, money, quantity, decorateProducts } = require('../../utils/format');

Page({
  data: {
    top: 20,
    menuRight: 15,
    items: [],
    total: '0',
    selectedCount: 0,
    allChecked: false,
    giftEnabled: false,
    recommendations: [],
    recommendationLoading: true,
    recommendationError: ''
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    const menuRight = menu && menu.left ? Number(info.windowWidth || 375) - menu.left + 8 : 15;
    this.setData({
      top: info.statusBarHeight || 20,
      menuRight,
      giftEnabled: Boolean(wx.getStorageSync('checkout_gift_enabled'))
    });
  },

  onShow() {
    this.refresh();
    this.loadRecommendations(false);
  },

  refresh() {
    const raw = cart.getCart();
    const items = raw.map(item => ({
      ...item,
      img: imageUrl(item.imageUrl),
      quantityText: quantity(item.quantity),
      priceText: money(item.price)
    }));
    const selected = raw.filter(item => item.checked);
    const totalNumber = selected.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    this.setData({
      items,
      total: money(totalNumber),
      selectedCount: selected.length,
      allChecked: Boolean(raw.length) && raw.every(item => item.checked)
    });
    this.syncRecommendations(raw);
    cart.syncBadge();
  },

  syncRecommendations(cartItems = cart.getCart()) {
    if (!this.recommendationPool) return;
    const productIds = new Set(cartItems.map(item => Number(item.productId)));
    this.setData({
      recommendations: this.recommendationPool.filter(item => !productIds.has(Number(item.id))).slice(0, 8)
    });
  },

  async loadRecommendations(force) {
    if (this.recommendationPromise) return this.recommendationPromise;
    if (this.recommendationPool && !force) {
      this.syncRecommendations();
      return this.recommendationPool;
    }
    this.setData({ recommendationLoading: true, recommendationError: '' });
    this.recommendationPromise = api.products({ pageSize: 20 }).then(result => {
      const products = decorateProducts(result.items);
      const featured = products.filter(item => item.featured && Number(item.primarySku.stock) > 0);
      this.recommendationPool = (featured.length ? featured : products.filter(item => Number(item.primarySku.stock) > 0));
      this.setData({ recommendationLoading: false, recommendationError: '' });
      this.syncRecommendations();
      return this.recommendationPool;
    }).catch(error => {
      this.setData({
        recommendationLoading: false,
        recommendationError: error.message || '推荐商品暂时没有加载好'
      });
      return [];
    }).finally(() => {
      this.recommendationPromise = null;
    });
    return this.recommendationPromise;
  },

  retryRecommendations() { this.loadRecommendations(true); },
  openRecommendation(event) {
    ui.navigate(`/subpackages/product/detail/index?id=${event.currentTarget.dataset.id}`);
  },
  addRecommendation(event) {
    const product = this.data.recommendations.find(item => Number(item.id) === Number(event.currentTarget.dataset.id));
    const sku = product && product.primarySku;
    if (!product || !sku || Number(sku.stock) <= 0) return;
    cart.add({
      skuId: sku.id,
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      specText: sku.specText,
      unitName: sku.unitName,
      price: Number(sku.price),
      stock: Number(sku.stock),
      minPurchase: Number(sku.minPurchase || 1),
      step: Number(sku.step || 1)
    }, Number(sku.minPurchase || 1));
    this.refresh();
    ui.addedToast();
  },

  toggle(event) {
    cart.update(event.currentTarget.dataset.id, { checked: !event.currentTarget.dataset.checked });
    ui.feedback();
    this.refresh();
  },
  toggleAll() {
    const checked = !this.data.allChecked;
    cart.saveCart(cart.getCart().map(item => ({ ...item, checked })));
    ui.feedback();
    this.refresh();
  },
  minus(event) {
    const item = cart.getCart().find(value => value.skuId === event.currentTarget.dataset.id);
    if (!item) return;
    const next = Math.max(Number(item.minPurchase || 1), Number(item.quantity) - Number(item.step || 1));
    if (next !== Number(item.quantity)) {
      cart.update(item.skuId, { quantity: next });
      ui.feedback();
      this.refresh();
    }
  },
  plus(event) {
    const item = cart.getCart().find(value => value.skuId === event.currentTarget.dataset.id);
    if (!item) return;
    const next = Math.min(Number(item.stock || 9999), Number(item.quantity) + Number(item.step || 1));
    if (next === Number(item.quantity)) return wx.showToast({ title: '已达到可购库存', icon: 'none' });
    cart.update(item.skuId, { quantity: next });
    ui.feedback();
    this.refresh();
  },
  remove(event) {
    const skuId = event.currentTarget.dataset.id;
    wx.showModal({
      title: '移出果篮？',
      content: '商品将从果篮中移除',
      confirmText: '移出',
      confirmColor: '#E96D3D',
      success: result => {
        if (!result.confirm) return;
        cart.remove(skuId);
        ui.feedback();
        this.refresh();
      }
    });
  },
  toggleGift(event) {
    const giftEnabled = Boolean(event.detail.value);
    wx.setStorageSync('checkout_gift_enabled', giftEnabled);
    this.setData({ giftEnabled });
    ui.feedback();
  },
  browse() { ui.navigate('/pages/category/index', 'switchTab'); },
  checkout() {
    if (!this.data.selectedCount) return wx.showToast({ title: '请先选择商品', icon: 'none' });
    ui.navigate('/subpackages/order/checkout/index');
  }
});
