# Chloris V6.13 商户管理后台

Vue 3 + Vite + Element Plus + CloudBase 管理端，用于管理：

- 商品、库存、轮播图和数据导入；
- 订单、顾客和图片定制报价；
- 情人节及其他节日预售活动；
- 限时商品自动上架与下架；
- 现货销售与预约销售；
- 合作工作室、每日产能、特殊日期停接、接单和确认制作。

图鉴和积分功能已删除，优惠券相关数据仍由小程序保留。

## 本地启动

```bash
npm ci --include=dev
npm run dev
```

Windows 也可以直接运行：

```text
build-v6.13.bat
```

## 生产构建

```bash
npm ci --include=dev
npm run build
```

构建结果写入 `dist/`。部署前请填写 `public/huayu-config.js` 中的 CloudBase 环境 ID 和 Publishable Key；不要在前端文件中填写 SecretId 或 SecretKey。

## 首次启用 V6.13

1. 在 CloudBase 数据库创建空集合 `festivalCampaigns` 和 `studios`；
2. 重新部署 `adminApi`、`dataImportApi`、`getHomeData`、`orderApi`、`userApi`；
3. 先新增合作工作室并设置产能；
4. 再创建节日活动并关联商品；
5. 完成后台生产构建后部署静态文件。
