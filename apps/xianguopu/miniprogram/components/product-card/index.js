const { imageUrl, money } = require('../../utils/format');
Component({
  options:{ virtualHost:true },
  properties:{ product:{type:Object,value:{}} },
  data:{ img:'' },
  observers:{ 'product':function(p){ this.setData({img:imageUrl(p?.imageUrl)}) } },
  methods:{
    open(){ this.triggerEvent('open',{id:this.data.product.id}); },
    add(){ const p=this.data.product; const sku=p.skus?.[0]; if(!sku)return; this.triggerEvent('add',{product:p,sku}); }
  }
});
