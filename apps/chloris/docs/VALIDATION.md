# V6.1 验证记录

- 小程序与云函数全部 JavaScript 文件已通过 `node -c` 语法检查；
- 全部 JSON 文件已解析通过；
- `app.json` 中登记的每个页面均具备 JS、JSON、WXML、WXSS 文件；
- 小程序静态图片与组件引用已检查，无缺失路径；
- 商户管理端已执行 `npm ci` 与 `npm run build`，生产构建成功；
- 最新生产文件已写入 `huayu-admin-web/dist/`；
- 最终压缩包不包含 `node_modules`，使用时在管理端目录执行 `npm ci` 即可恢复依赖。
