const api=require('../../services/api'); const cart=require('../../store/cart');
Page({
  data:{categories:[],activeId:0,activeName:'',products:[],loading:true,page:1,pageSize:20,hasMore:true},
  onShow(){this.init();},
  async init(){
    try{
      const cats=await api.categories();
      let active=Number(wx.getStorageSync('category_focus')||0);wx.removeStorageSync('category_focus');
      if(!active&&cats[0])active=cats[0].id;
      const c=cats.find(x=>x.id===active);
      this.setData({categories:cats,activeId:active,activeName:c?.name||'全部好果'});
      await this.load(true);
    }catch(e){wx.showToast({title:e.message,icon:'none'})}
  },
  async load(reset=false){
    if(this.data.loading&&!reset)return;
    if(!reset&&!this.data.hasMore)return;
    const page=reset?1:this.data.page;
    this.setData({loading:true});
    try{
      const r=await api.products({categoryId:this.data.activeId,page,pageSize:this.data.pageSize});
      const products=reset?r.items:this.data.products.concat(r.items);
      this.setData({products,loading:false,page:page+1,hasMore:products.length<r.total});
    }catch(e){this.setData({loading:false})}
  },
  select(e){
    const activeId=Number(e.currentTarget.dataset.id);const c=this.data.categories.find(x=>x.id===activeId);
    this.setData({activeId,activeName:c?.name||'全部好果',products:[],page:1,hasMore:true});this.load(true);
  },
  loadMore(){this.load(false);},
  openProduct(e){wx.navigateTo({url:`/subpackages/product/detail/index?id=${e.detail.id}`})},
  addCart(e){const {product,sku}=e.detail;cart.add({skuId:sku.id,productId:product.id,name:product.name,imageUrl:product.imageUrl,specText:sku.specText,unitName:sku.unitName,price:Number(sku.price),stock:Number(sku.stock),minPurchase:Number(sku.minPurchase||1),step:Number(sku.step||1)},Number(sku.minPurchase||1));wx.showToast({title:'已加入',icon:'success'})}
});
