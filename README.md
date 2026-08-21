# business-platform

统一承载两个相互隔离的微信小程序业务：

- `apps/chloris`：鲜花小程序（保留原有样式与功能）
- `apps/xianguopu`：鲜果铺小程序、管理后台与独立 API
- `packages/common`：未来可复用但不包含业务规则的公共包
- `docs`：整体架构与启动说明

两个业务拥有独立的数据、订单、用户与部署边界，避免为了“复用”而互相耦合。启动方式见 [docs/startup.md](./docs/startup.md)。

鲜果铺可在 `apps/xianguopu` 下执行 `node scripts/verify.mjs`，无需安装依赖即可完成源码与核心规则自检。
