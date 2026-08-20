const api=require('../../../services/api');const cart=require('../../../store/cart');
Page({
  data:{keyword:'',products:[],searched:false,page:1,pageSize:20,hasMore:true,loading:false},
  input(e){this.setData({keyword:e.detail.value})},
  async search(reset=true){
    const k=this.data.keyword.trim();if(!k)return;if(this.data.loading)return;if(!reset&&!this.data.hasMore)return;
    const page=reset?1:this.data.page;this.setData({loading:true});
    try{const r=await api.products({keyword:k,page,pageSize:this.data.pageSize});const products=reset?r.items:this.data.products.concat(r.items);this.setData({products,searched:true,page:page+1,hasMore:products.length<r.total,loading:false})}catch(e){this.setData({loading:false});wx.showToast({title:e.message,icon:'none'})}
  },
  onReachBottom(){this.search(false)},
  openProduct(e){wx.navigateTo({url:`/subpackages/product/detail/index?id=${e.detail.id}`})},
  addCart(e){const{product,sku}=e.detail;cart.add({skuId:sku.id,productId:product.id,name:product.name,imageUrl:product.imageUrl,specText:sku.specText,unitName:sku.unitName,price:Number(sku.price),stock:Number(sku.stock),minPurchase:Number(sku.minPurchase||1),step:Number(sku.step||1)},Number(sku.minPurchase||1));wx.showToast({title:'已加入'})}
});
