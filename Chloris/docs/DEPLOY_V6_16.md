# V6.16 部署步骤

1. 微信开发者工具重新导入项目根目录或覆盖完整项目。
2. 重新部署云函数：
   - `cloudfunctions/orderApi`
   - `cloudfunctions/userApi`
   - `cloudfunctions/adminApi`
3. 云函数均选择“上传并部署：云端安装依赖”。
4. Web 后台进入 `huayu-admin-web` 后执行：
   - `pnpm install`
   - `pnpm run build`
5. 在“工作室合作后台”编辑工作室，确认：
   - 启用合作
   - 开放到店取货
   - 工作室地址或自提地址已填写
6. 小程序执行“清缓存 → 全部清除 → 重新编译”。

旧工作室记录未配置 `supportsPickup` 时默认允许自提；顾客端会使用工作室名称、地址和电话作为默认自提信息。
