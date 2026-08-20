# Chloris V6.19 商户管理后台

Vue 3 + Vite + Element Plus + CloudBase 管理端。

## 主要功能

- 商品、库存、分类、轮播图和数据导入
- 订单、配送时间、快递公司与运单号
- 顾客、地址、图片定制报价
- 优惠券模板、自动发券、定向发券、惊喜券预算和频率控制
- 国内/国际节日提醒和 BIG DAY 相关运营数据

日历后台已移除“商家活动”类型；历史商家活动数据不会再返回给顾客端。

## 本地运行

```bash
npm ci --include=dev
npm run dev
```

## 生产构建

```bash
npm run build
```

构建结果在 `dist/`。部署前请填写 `public/huayu-config.js` 中的 CloudBase 环境 ID 和 Publishable Key。不要把 SecretId、SecretKey、API v3 密钥或物流接口密钥写入 Web 前端。

## 首次启用优惠券

1. 在 CloudBase 创建 `coupons` 和 `userCoupons` 集合。
2. 部署 `adminApi`、`orderApi`、`userApi`。
3. 进入“优惠券管理”，点击“初始化推荐券”。
4. 检查券面、预算、适用分类和排除活动后再正式发放。
