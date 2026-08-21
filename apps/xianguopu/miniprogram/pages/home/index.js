const api = require('../../services/api');
const cart = require('../../store/cart');
const ui = require('../../utils/ui');
const { imageUrl, decorateProducts } = require('../../utils/format');
const { DELIVERY_NOTICE, DELIVERY_DETAIL } = require('../../data/delivery-slots');

const SCENE_FILTERS = {
  fresh: { featuredOnly: true, sort: 'featured' },
  gift: { giftOnly: true, sort: 'featured' },
  pair: { sort: 'featured' }
};

Page({
  data: {
    top: 20,
    menuRight: 15,
    store: {
      storeName: '鲜果铺',
      slogan: '把新鲜送到家',
      serviceArea: '全国',
      deliveryPromise: '应季鲜达'
    },
    banner: '',
    categories: [],
    featured: [],
    scenes: [
      { key: 'fresh', icon: '鲜', name: '本周鲜选', note: '新到好果' },
      { key: 'gift', icon: '礼', name: '礼盒好果', note: '体面心意' },
      { key: 'pair', icon: '搭', name: '搭配推荐', note: '组合更省心' },
      { key: 'invite', icon: '邀', name: '邀请好友', note: '分享鲜甜' }
    ],
    cartCount: 0,
    deliveryNotice: DELIVERY_NOTICE,
    deliveryDetail: DELIVERY_DETAIL,
    loading: true,
    refreshing: false,
    ready: false,
    error: ''
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    const menuRight = menu && menu.left ? Number(info.windowWidth || 375) - menu.left + 8 : 15;
    this.setData({
      top: info.statusBarHeight || 20,
      menuRight,
      banner: imageUrl('/static/banners/home-hero.jpg')
    });
    this.load(false);
  },

  onShow() {
    cart.syncBadge();
    this.refreshCartCount();
  },

  onPullDownRefresh() {
    this.load(true).finally(() => wx.stopPullDownRefresh());
  },

  refreshCartCount() {
    this.setData({ cartCount: Math.floor(cart.count()) });
  },

  async load(force) {
    const initial = !this.data.ready;
    this.setData({ loading: initial, refreshing: !initial, error: '' });
    try {
      const [store, categories, result] = await Promise.all([
        api.storeSettings(Boolean(force)),
        api.categories(Boolean(force)),
        api.products({ pageSize: 36 })
      ]);
      const products = decorateProducts(result.items);
      const featured = products.filter(item => item.featured);
      this.setData({
        store: {
          ...this.data.store,
          ...(store || {}),
          serviceArea: String(store && store.serviceArea || '全国').trim() || '全国',
          deliveryPromise: String(store && store.deliveryPromise || '应季鲜达').trim() || '应季鲜达'
        },
        categories,
        featured: (featured.length ? featured : products).slice(0, 8),
        loading: false,
        refreshing: false,
        ready: true,
        error: ''
      });
    } catch (error) {
      this.setData({
        loading: false,
        refreshing: false,
        error: error.message || '果单暂时没有送达'
      });
    }
  },

  retry() { this.load(true); },
  openSearch() { ui.navigate('/subpackages/search/index/index'); },
  goAll() { ui.navigate('/pages/category/index', 'switchTab'); },
  goCart() { ui.navigate('/pages/cart/index', 'switchTab'); },
  goCategory(event) {
    wx.setStorageSync('category_focus', Number(event.currentTarget.dataset.id));
    ui.navigate('/pages/category/index', 'switchTab');
  },
  selectScene(event) {
    const scene = SCENE_FILTERS[event.currentTarget.dataset.key];
    if (!scene) return;
    wx.setStorageSync('category_scene_filter', scene);
    ui.navigate('/pages/category/index', 'switchTab');
  },
  showDelivery() {
    wx.showModal({
      title: '可选配送时段',
      content: this.data.deliveryDetail,
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#2F5F47'
    });
  },
  openProduct(event) {
    ui.navigate(`/subpackages/product/detail/index?id=${event.detail.id}`);
  },
  addCart(event) {
    const { product, sku } = event.detail;
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
    this.refreshCartCount();
    ui.addedToast();
  },
  onShareAppMessage() {
    return { title: `${this.data.store.storeName}｜好果简单送到家`, path: '/pages/home/index' };
  }
});
