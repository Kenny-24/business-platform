const api=require('../../services/api'); const cart=require('../../store/cart');
Page({
  data:{top:0,categories:[],products:[],loading:true,searchText:'',bannerText:'好水果，简单买'},
  onLoad(){ const info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync(); this.setData({top:info.statusBarHeight||20}); this.load(); },
  onPullDownRefresh(){ this.load().finally(()=>wx.stopPullDownRefresh()); },
  async load(){
    this.setData({loading:true});
    try{ const [categories,res]=await Promise.all([api.categories(),api.products({featured:1,pageSize:20})]); this.setData({categories,products:res.items,loading:false}); }
    catch(e){ this.setData({loading:false}); wx.showToast({title:e.message||'加载失败',icon:'none'}); }
  },
  openSearch(){wx.navigateTo({url:'/subpackages/search/index/index'});},
  goCategory(e){ const id=e.currentTarget.dataset.id; wx.setStorageSync('category_focus',id); wx.switchTab({url:'/pages/category/index'}); },
  openProduct(e){wx.navigateTo({url:`/subpackages/product/detail/index?id=${e.detail.id}`});},
  addCart(e){ const {product,sku}=e.detail; cart.add({skuId:sku.id,productId:product.id,name:product.name,imageUrl:product.imageUrl,specText:sku.specText,unitName:sku.unitName,price:Number(sku.price),stock:Number(sku.stock),minPurchase:Number(sku.minPurchase||1),step:Number(sku.step||1)},Number(sku.minPurchase||1)); wx.showToast({title:'已加入购物车',icon:'success'}); }
});
