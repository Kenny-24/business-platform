import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

const products = [
  ['苹果','红富士','陕西洛川','苹果梨类','5斤/箱','箱',59.9,120,'脆甜多汁，家庭常备'],
  ['秋月梨','秋月','河北','苹果梨类','5斤/箱','箱',49.9,100,'细腻多汁，清甜少渣'],
  ['库尔勒香梨','香梨','新疆库尔勒','苹果梨类','3斤/箱','箱',45.9,90,'小果脆甜，香气清爽'],
  ['香蕉','威廉斯','云南','热带水果','约3斤/把','把',19.9,150,'软糯香甜'],
  ['海南金钻凤梨','金钻','海南','热带水果','约1.5kg/个','个',29.9,80,'香甜少酸，可直接切食'],
  ['椰青','香水椰','泰国','热带水果','1个','个',15.9,100,'清甜椰汁'],
  ['金枕榴莲','金枕','泰国','热带水果','按斤称重','斤',39.9,200,'绵密香甜，按实际重量结算'],
  ['凯特芒果','凯特','四川攀枝花','热带水果','5斤/箱','箱',49.9,80,'果肉厚，甜香浓郁'],
  ['贵妃芒','贵妃','海南','热带水果','3斤/箱','箱',45.9,80,'香甜多汁'],
  ['红心火龙果','红心','广西','热带水果','4个装','盒',32.9,70,'清甜多汁'],
  ['阳光玫瑰','阳光玫瑰','云南','葡萄提子','2斤/盒','盒',49.9,100,'脆甜清香'],
  ['夏黑葡萄','夏黑','山东','葡萄提子','2斤/盒','盒',29.9,90,'无籽浓甜'],
  ['玫瑰香葡萄','玫瑰香','河北','葡萄提子','2斤/盒','盒',35.9,90,'玫瑰香气明显'],
  ['蓝莓','奥尼尔','云南','浆果莓类','125g×4盒','提',39.9,120,'大果清甜'],
  ['丹东草莓','红颜','辽宁丹东','浆果莓类','500g/盒','盒',39.9,80,'香气浓郁，果肉细嫩'],
  ['树莓','红树莓','云南','浆果莓类','125g/盒','盒',18.9,60,'酸甜芳香'],
  ['车厘子','Regina','智利','进口精品','2.5kg/箱','箱',199.0,50,'大果脆甜，冷链到仓'],
  ['新西兰奇异果','金果','新西兰','进口精品','6个装','盒',49.9,60,'软糯香甜'],
  ['牛油果','Hass','秘鲁','进口精品','4个装','盒',29.9,70,'奶油质感'],
  ['山竹','油竹','泰国','进口精品','2斤/盒','盒',59.9,50,'酸甜细腻'],
  ['水蜜桃','水蜜桃','山东蒙阴','桃李杏类','3斤/箱','箱',39.9,90,'软甜多汁'],
  ['油桃','中油','河北','桃李杏类','3斤/箱','箱',29.9,80,'脆甜爽口'],
  ['新疆西梅','法兰西','新疆','桃李杏类','2斤/盒','盒',39.9,80,'脆甜带微酸'],
  ['恐龙蛋李','杏李','新疆','桃李杏类','2斤/盒','盒',45.9,60,'甜度高，果香足'],
  ['赣南脐橙','纽荷尔','江西赣南','柑橘橙柚','5斤/箱','箱',39.9,140,'汁多清甜'],
  ['沃柑','沃柑','广西武鸣','柑橘橙柚','5斤/箱','箱',35.9,140,'皮薄汁多'],
  ['砂糖橘','砂糖橘','广西','柑橘橙柚','3斤/箱','箱',29.9,120,'小果高甜'],
  ['红心柚','红肉蜜柚','福建平和','柑橘橙柚','2个装','袋',29.9,80,'清甜微酸'],
  ['麒麟西瓜','麒麟瓜','江苏','瓜类','约4-5kg/个','个',39.9,80,'薄皮爽甜'],
  ['哈密瓜','西州蜜','新疆','瓜类','约2.5kg/个','个',29.9,70,'脆甜多汁'],
  ['羊角蜜','羊角蜜','山东','瓜类','3斤/箱','箱',35.9,60,'脆甜清香'],
  ['石榴','突尼斯软籽','四川会理','特色水果','5斤/箱','箱',69.9,60,'软籽高甜'],
  ['猕猴桃','徐香','陕西眉县','特色水果','12个装','箱',39.9,80,'酸甜均衡'],
  ['冬枣','冬枣','山东沾化','特色水果','2斤/盒','盒',35.9,70,'清脆高甜'],
  ['无花果','波姬红','山东威海','特色水果','6个装','盒',29.9,40,'软糯蜜甜'],
  ['百香果','紫香一号','广西','特色水果','12个装','袋',29.9,60,'酸香浓郁'],
];

const icons: Record<string,string> = {'苹果梨类':'🍎','热带水果':'🥭','葡萄提子':'🍇','浆果莓类':'🫐','进口精品':'🌍','桃李杏类':'🍑','柑橘橙柚':'🍊','瓜类':'🍉','特色水果':'✨'};

async function main(){
  await prisma.setting.upsert({
    where: { key: 'store' },
    update: {},
    create: {
      key: 'store',
      value: {
        storeName: '鲜果铺',
        slogan: '把新鲜送到家',
        serviceArea: '全国',
        deliveryPromise: '应季鲜达',
        baseFreight: 8,
        freeShippingThreshold: 99,
        nationwideEnabled: true,
        afterSaleText: '签收后如发现运输导致的明显坏果，请及时联系客服处理'
      }
    }
  });
    const hash=await bcrypt.hash(process.env.ADMIN_SEED_PASSWORD || 'FreshFruit@2026', 12);
  await prisma.admin.upsert({where:{username:'admin'},update:{passwordHash:hash},create:{username:'admin',passwordHash:hash,name:'鲜果铺管理员'}});
  const categoryMap=new Map<string,number>();
  for(const [name,icon] of Object.entries(icons)){
    const c=await prisma.category.upsert({where:{name},update:{icon,enabled:true},create:{name,icon,enabled:true,sort:100-Object.keys(icons).indexOf(name)}});
    categoryMap.set(name,c.id);
  }
  for (let i=0;i<products.length;i++) {
    const [name,variety,origin,category,specText,unitName,price,stock,subtitle]=products[i] as any[];
    const existing=await prisma.product.findFirst({where:{name,variety}});
    const imageUrl=`/static/products/${String(i+1).padStart(2,'0')}.jpg`;
    const data:any={name,variety,origin,subtitle,description:`${name} · ${variety}。产地：${origin}。${subtitle}。`,imageUrl,tags:[origin,variety],status:'ON_SALE',featured:i<12,sort:200-i,categoryId:categoryMap.get(category)!};
    if(existing){
      await prisma.sku.deleteMany({where:{productId:existing.id}});
      await prisma.product.update({where:{id:existing.id},data:{...data,skus:{create:{name:specText,specText,unitName,pricingMode:name.includes('榴莲')?'WEIGHT':'FIXED',price,marketPrice:Number(price*1.15).toFixed(2),stock,minPurchase:1,step:1,enabled:true}}}});
    } else {
      await prisma.product.create({data:{...data,skus:{create:{name:specText,specText,unitName,pricingMode:name.includes('榴莲')?'WEIGHT':'FIXED',price,marketPrice:Number(price*1.15).toFixed(2),stock,minPurchase:1,step:1,enabled:true}}}});
    }
  }
  console.log(`seed complete: ${products.length} products`);
}
main().finally(()=>prisma.$disconnect());
