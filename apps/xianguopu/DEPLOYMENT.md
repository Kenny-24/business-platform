# 部署说明

## 开发环境

1. PostgreSQL：`docker compose up -d db`
2. API：进入 `server`，复制 `.env.example` 为 `.env`，安装依赖，执行 Prisma migration 和 seed。
3. 后台：进入 `admin` 执行 `npm install && npm run dev`。
4. 小程序：微信开发者工具导入 `miniprogram`。

## 生产环境建议拓扑

```text
微信小程序
   │ HTTPS
   ▼
api.example.com ── Node/Fastify × N
   │                 │
   │                 ├─ Redis（可选：限流/会话/热点缓存）
   │                 ├─ 对象存储 + CDN
   │                 └─ 微信登录 / 微信支付
   ▼
PostgreSQL 主库 + 自动备份

admin.example.com ── 静态 Vue 管理后台
```

## 上线必改

- `WX_APPID`
- `WX_APPSECRET`
- `JWT_SECRET`
- `DATABASE_URL`
- 小程序 `config/env.js` 的 HTTPS API 域名
- 微信公众平台 request 合法域名
- 图片 CDN 域名
- 管理后台管理员初始密码

## 支付

项目默认 `PAYMENT_MODE=mock` 仅用于本地完整联调。生产支付应该在服务端创建微信支付 JSAPI 订单，并将 `timeStamp / nonceStr / package / signType / paySign` 返回小程序，再由小程序调用 `wx.requestPayment`。

支付回调必须进行签名验证和幂等处理；不要仅依据前端“支付成功”回调更新订单。
