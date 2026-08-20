const KEY='xianguopu_cart_v1';
function getCart(){ return wx.getStorageSync(KEY) || []; }
function saveCart(items){ wx.setStorageSync(KEY, items); return items; }
function add(item, quantity=1){
  const items=getCart(); const i=items.findIndex(x=>x.skuId===item.skuId);
  if(i>=0) items[i].quantity=Number(items[i].quantity)+Number(quantity); else items.push({...item,quantity:Number(quantity),checked:true});
  saveCart(items); return items;
}
function update(skuId, patch){ return saveCart(getCart().map(x=>x.skuId===skuId?{...x,...patch}:x)); }
function remove(skuId){ return saveCart(getCart().filter(x=>x.skuId!==skuId)); }
function clearChecked(){ return saveCart(getCart().filter(x=>!x.checked)); }
module.exports={getCart,saveCart,add,update,remove,clearChecked};
