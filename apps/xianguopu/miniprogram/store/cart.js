const KEY='xianguopu_cart_v2';
const LEGACY_KEY='xianguopu_cart_v1';
function round(value){ return Number(Number(value || 0).toFixed(3)); }
function normalize(item){
  return {...item,quantity:round(item.quantity),price:Number(item.price||0),stock:Number(item.stock||0),minPurchase:Number(item.minPurchase||1),step:Number(item.step||1),checked:item.checked!==false};
}
function getCart(){
  let items=wx.getStorageSync(KEY);
  if(!Array.isArray(items)){
    const legacy=wx.getStorageSync(LEGACY_KEY);
    items=Array.isArray(legacy)?legacy:[];
    if(items.length) wx.setStorageSync(KEY,items.map(normalize));
  }
  return items.map(normalize);
}
function saveCart(items){ wx.setStorageSync(KEY, (items||[]).map(normalize)); syncBadge(); return getCart(); }
function add(item, quantity=1){
  const items=getCart(); const i=items.findIndex(x=>x.skuId===item.skuId);
  if(i>=0) items[i].quantity=Math.min(Number(items[i].stock||999999),round(Number(items[i].quantity)+Number(quantity)));
  else items.push(normalize({...item,quantity:Number(quantity),checked:true}));
  saveCart(items); return items;
}
function update(skuId, patch){ return saveCart(getCart().map(x=>x.skuId===skuId?{...x,...patch}:x)); }
function remove(skuId){ return saveCart(getCart().filter(x=>x.skuId!==skuId)); }
function clearChecked(){ return saveCart(getCart().filter(x=>!x.checked)); }
function count(){ return getCart().reduce((sum,item)=>sum+Number(item.quantity||0),0); }
function syncBadge(){
  const total=Math.floor(count());
  if(total>0) wx.setTabBarBadge({index:2,text:String(Math.min(total,99)),fail:()=>{}});
  else wx.removeTabBarBadge({index:2,fail:()=>{}});
}
module.exports={getCart,saveCart,add,update,remove,clearChecked,count,syncBadge,round};
