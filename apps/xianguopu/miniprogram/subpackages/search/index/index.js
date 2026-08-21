const api = require('../../../services/api');
const cart = require('../../../store/cart');
const ui = require('../../../utils/ui');
const { decorateProducts } = require('../../../utils/format');
const HISTORY_KEY = 'xianguopu_search_history';

Page({
  data: {
    keyword: '', products: [], recommended: [], searched: false,
    page: 1, pageSize: 20, hasMore: true, loading: false, initialLoading: true, error: '', history: [],
    hot: ['阳光玫瑰', '榴莲', '蓝莓', '新疆', '当季柑橘'],
    tastes: [
      { name: '清脆', note: '爽口低负担', keyword: '苹果' }, { name: '爆汁', note: '水润果香', keyword: '梨' },
      { name: '软糯', note: '绵密香甜', keyword: '芒果' }, { name: '浓郁', note: '香气饱满', keyword: '榴莲' }
    ]
  },
  onLoad(options) {
    const keyword = decodeURIComponent(options.keyword || '');
    this.setData({ keyword, history: wx.getStorageSync(HISTORY_KEY) || [] });
    if (keyword) this.search(true); else this.loadRecommended();
  },
  async loadRecommended() {
    this.setData({ initialLoading: true, error: '' });
    try { const result = await api.products({ pageSize: 6 }); this.setData({ recommended: decorateProducts(result.items).slice(0, 6), initialLoading: false }); }
    catch (error) { this.setData({ initialLoading: false, error: error.message || '推荐商品加载失败' }); }
  },
  input(event) { this.setData({ keyword: event.detail.value }); },
  clearInput() { this.setData({ keyword: '', products: [], searched: false, loading: false, hasMore: true }); if (!this.data.recommended.length) this.loadRecommended(); },
  useKeyword(event) { this.setData({ keyword: event.currentTarget.dataset.keyword }); this.search(true); },
  clearHistory() { wx.removeStorageSync(HISTORY_KEY); this.setData({ history: [] }); },
  async search(reset) {
    const keyword = String(this.data.keyword || '').trim();
    const isReset = reset !== false;
    if (!keyword || this.data.loading || (!isReset && !this.data.hasMore)) return;
    const page = isReset ? 1 : this.data.page;
    const requestId = (this.searchId || 0) + 1;
    this.searchId = requestId;
    this.setData({ loading: true, searched: true, error: '', ...(isReset ? { products: [], hasMore: true } : {}) });
    try {
      const result = await api.products({ keyword, page, pageSize: this.data.pageSize });
      if (requestId !== this.searchId) return;
      const incoming = decorateProducts(result.items);
      const products = isReset ? incoming : this.data.products.concat(incoming);
      const history = [keyword].concat(this.data.history.filter(item => item !== keyword)).slice(0, 8);
      wx.setStorageSync(HISTORY_KEY, history);
      this.setData({ products, history, page: page + 1, hasMore: products.length < result.total, loading: false });
    } catch (error) { if (requestId === this.searchId) this.setData({ loading: false, error: error.message || '搜索失败' }); }
  },
  submit() { this.search(true); },
  retry() { this.data.searched ? this.search(true) : this.loadRecommended(); },
  onReachBottom() { this.search(false); },
  openById(event) { ui.navigate(`/subpackages/product/detail/index?id=${event.currentTarget.dataset.id}`); },
  openProduct(event) { ui.navigate(`/subpackages/product/detail/index?id=${event.detail.id}`); },
  addCart(event) { const { product, sku } = event.detail; cart.add({ skuId: sku.id, productId: product.id, name: product.name, imageUrl: product.imageUrl, specText: sku.specText, unitName: sku.unitName, price: Number(sku.price), stock: Number(sku.stock), minPurchase: Number(sku.minPurchase || 1), step: Number(sku.step || 1) }, Number(sku.minPurchase || 1)); ui.addedToast(); }
});
