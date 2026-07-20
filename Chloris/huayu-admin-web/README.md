# Chloris 商户管理

Vue 3 + Vite + Element Plus + CloudBase 的商户管理，用于管理订单、顾客、商品、库存、首页轮播、节日、图鉴和批量数据导入。

## 本地启动

```bash
npm ci
npm run dev
```

## 生产构建

```bash
npm run build
```

构建产物位于 `dist/`。

## CloudBase 配置

复制并填写 `public/huayu-config.js`。文件名继续保留 `huayu` 是为了兼容现有部署配置；页面品牌已全部改为 Chloris（克罗丽丝）。

数据导入模板位于 `public/import-templates/`，管理端页面可直接下载。
