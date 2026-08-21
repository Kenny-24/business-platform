const { decorateProduct } = require('../../utils/format');
Component({
  options:{ virtualHost:true },
  properties:{ product:{type:Object,value:{}} },
  data:{ view:null,adding:false,soldOut:false,favorite:false },
  observers:{
    'product':function(p){
      const view=decorateProduct(p);
      this.setData({
        view,
        adding:false,
        soldOut:Boolean(view&&view.primarySku&&Number(view.primarySku.stock)<=0),
        favorite:Boolean(view&&wx.getStorageSync(`favorite_product_${view.id}`))
      });
    }
  },
  pageLifetimes:{
    show(){
      const view=this.data.view;
      if(view) this.setData({favorite:Boolean(wx.getStorageSync(`favorite_product_${view.id}`))});
    }
  },
  methods:{
    open(){ if(this.data.view) this.triggerEvent('open',{id:this.data.view.id}); },
    toggleFavorite(){
      const view=this.data.view;
      if(!view)return;
      const favorite=!this.data.favorite;
      wx.setStorageSync(`favorite_product_${view.id}`,favorite);
      this.setData({favorite});
      if(wx.vibrateShort) wx.vibrateShort({type:'light',fail:()=>{}});
      wx.showToast({title:favorite?'已加入稍后购买':'已取消收藏',icon:'none'});
      this.triggerEvent('favorite',{id:view.id,favorite});
    },
    add(){
      if(this.data.adding)return;
      const p=this.data.product; const sku=p && p.skus && p.skus[0];
      if(!sku || Number(sku.stock)<=0)return;
      this.setData({adding:true});
      if(wx.vibrateShort) wx.vibrateShort({type:'light',fail:()=>{}});
      this.triggerEvent('add',{product:p,sku});
      setTimeout(()=>this.setData({adding:false}),420);
    }
  }
});
