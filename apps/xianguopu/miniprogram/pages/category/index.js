const api = require('../../services/api');
const cart = require('../../store/cart');
const ui = require('../../utils/ui');
const { decorateProducts } = require('../../utils/format');

const SORT_OPTIONS = [
  { key: 'default', name: '综合推荐' },
  { key: 'featured', name: '鲜选优先' },
  { key: 'priceAsc', name: '价格从低到高' },
  { key: 'priceDesc', name: '价格从高到低' }
];

const FILTER_OPTIONS = [
  { key: 'discount', name: '有折扣', desc: '仅看有真实划线价的商品' },
  { key: 'featured', name: '鲜选商品', desc: '后台已标记的精选商品' },
  { key: 'gift', name: '礼盒适配', desc: '箱、盒或提装规格' },
  { key: 'stock', name: '仅看有货', desc: '隐藏当前库存为零的商品' }
];

function freshFilters(active = {}) {
  return FILTER_OPTIONS.map(item => ({ ...item, active: Boolean(active[item.key]) }));
}

Page({
  data: {
    top: 20,
    menuRight: 15,
    categories: [],
    activeId: 0,
    activeName: '全部水果',
    products: [],
    visibleProducts: [],
    sort: 'default',
    sortLabel: '综合推荐',
    sortOptions: SORT_OPTIONS,
    filterOptions: freshFilters(),
    draftSort: 'default',
    draftFilterOptions: freshFilters(),
    activeFilterCount: 0,
    filterPanelVisible: false,
    loading: true,
    switching: false,
    ready: false,
    error: ''
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    const menuRight = menu && menu.left ? Number(info.windowWidth || 375) - menu.left + 8 : 15;
    this.setData({ top: info.statusBarHeight || 20, menuRight });
    this.consumeSceneFilter();
    this.init(false);
  },

  onShow() {
    cart.syncBadge();
    const sceneChanged = this.consumeSceneFilter();
    const stored = Number(wx.getStorageSync('category_focus') || 0);
    if (stored && this.data.ready) {
      wx.removeStorageSync('category_focus');
      this.activateCategory(stored);
      return;
    }
    if (sceneChanged && this.data.ready) this.applyFilters(this.data.products);
  },

  onPullDownRefresh() {
    this.init(true).finally(() => wx.stopPullDownRefresh());
  },

  consumeSceneFilter() {
    const scene = wx.getStorageSync('category_scene_filter');
    if (!scene || typeof scene !== 'object') return false;
    wx.removeStorageSync('category_scene_filter');
    const active = {
      featured: Boolean(scene.featuredOnly),
      gift: Boolean(scene.giftOnly),
      discount: Boolean(scene.discountOnly),
      stock: Boolean(scene.stockOnly)
    };
    const sort = SORT_OPTIONS.some(item => item.key === scene.sort) ? scene.sort : 'default';
    const filterOptions = freshFilters(active);
    const activeFilterCount = filterOptions.filter(item => item.active).length + (sort === 'default' ? 0 : 1);
    const sortLabel = SORT_OPTIONS.find(item => item.key === sort).name;
    this.setData({ sort, sortLabel, filterOptions, activeFilterCount });
    return true;
  },

  async init(force) {
    const initial = !this.data.ready;
    this.setData({ loading: initial, error: '' });
    try {
      const list = await api.categories(Boolean(force));
      const categories = [{ id: 0, name: '全部水果', icon: '果' }].concat(list);
      const stored = Number(wx.getStorageSync('category_focus') || this.data.activeId || 0);
      wx.removeStorageSync('category_focus');
      const active = categories.find(item => Number(item.id) === stored) || categories[0];
      this.setData({ categories, activeId: Number(active.id), activeName: active.name });
      await this.loadProducts(initial);
    } catch (error) {
      this.setData({ loading: false, switching: false, error: error.message || '分类暂时无法读取' });
    }
  },

  async loadProducts(initial) {
    const requestId = (this.requestId || 0) + 1;
    this.requestId = requestId;
    this.setData({ loading: Boolean(initial), switching: !initial, error: '' });
    try {
      const params = { pageSize: 50 };
      if (this.data.activeId) params.categoryId = this.data.activeId;
      const result = await api.products(params);
      if (requestId !== this.requestId) return;
      const products = decorateProducts(result.items);
      this.setData({ products, loading: false, switching: false, ready: true, error: '' });
      this.applyFilters(products);
    } catch (error) {
      if (requestId !== this.requestId) return;
      this.setData({ loading: false, switching: false, error: error.message || '商品暂时无法读取' });
    }
  },

  activateCategory(activeId) {
    activeId = Number(activeId);
    if (activeId === this.data.activeId) return;
    const active = this.data.categories.find(item => Number(item.id) === activeId);
    this.setData({ activeId, activeName: active ? active.name : '全部水果' });
    this.loadProducts(false);
  },

  selectCategory(event) { this.activateCategory(event.currentTarget.dataset.id); },

  applyFilters(source) {
    const active = new Set(this.data.filterOptions.filter(item => item.active).map(item => item.key));
    let products = (source || []).slice();
    if (active.has('discount')) products = products.filter(item => Boolean(item.marketPriceText));
    if (active.has('featured')) products = products.filter(item => Boolean(item.featured));
    if (active.has('gift')) products = products.filter(item => ['箱', '盒', '提'].includes(item.primarySku.unitName));
    if (active.has('stock')) products = products.filter(item => Number(item.primarySku.stock) > 0);
    if (this.data.sort === 'featured') {
      products.sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.id) - Number(a.id));
    }
    if (this.data.sort === 'priceAsc') {
      products.sort((a, b) => Number(a.primarySku.price) - Number(b.primarySku.price));
    }
    if (this.data.sort === 'priceDesc') {
      products.sort((a, b) => Number(b.primarySku.price) - Number(a.primarySku.price));
    }
    this.setData({ visibleProducts: products });
  },

  openFilter() {
    this.setData({
      filterPanelVisible: true,
      draftSort: this.data.sort,
      draftFilterOptions: this.data.filterOptions.map(item => ({ ...item }))
    });
  },
  closeFilter() { this.setData({ filterPanelVisible: false }); },
  noop() {},
  selectDraftSort(event) { this.setData({ draftSort: event.currentTarget.dataset.key }); },
  toggleDraftFilter(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({
      draftFilterOptions: this.data.draftFilterOptions.map(item => item.key === key ? { ...item, active: !item.active } : item)
    });
  },
  resetDraft() {
    this.setData({ draftSort: 'default', draftFilterOptions: freshFilters() });
  },
  confirmFilter() {
    const sort = this.data.draftSort;
    const filterOptions = this.data.draftFilterOptions.map(item => ({ ...item }));
    const activeFilterCount = filterOptions.filter(item => item.active).length + (sort === 'default' ? 0 : 1);
    const sortLabel = SORT_OPTIONS.find(item => item.key === sort).name;
    this.setData({ sort, sortLabel, filterOptions, activeFilterCount, filterPanelVisible: false });
    this.applyFilters(this.data.products);
    ui.feedback();
  },

  retry() { this.data.ready ? this.loadProducts(false) : this.init(true); },
  openSearch() { ui.navigate('/subpackages/search/index/index'); },
  openProduct(event) { ui.navigate(`/subpackages/product/detail/index?id=${event.detail.id}`); },
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
    ui.addedToast();
  }
});
