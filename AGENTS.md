# 项目规则

- 当前提供完整交互预览和常用后台组件独立入口；固定发行、项目采用与恢复及技能安装见 RELEASE.md、PROJECT.md、SKILLS.md；工具可运行不代表真实 Agent 独立生成或用户验收通过。
- 正式入口为 `src/preview/index.html`，详情为 `src/preview/preview.html`；原样稿 `examples/preview/` 仅供对照，正式代码不得导入它。组件用法见 `USAGE.md`。`npm run build` 构建，`npm run preview` 仅提供本机预览；`npm test` 跑状态和工具测试，`npm run test:browser` 跑浏览器回归。
- 正式组件仅依赖 `src/`，禁止反向导入样稿代码；组件销毁时清理事件，多个区域互不影响，切色不重新创建控件。
- 构建输出为受管的 `dist/`，不要手工放入其他资料；已有未知文件或目录时构建应拒绝覆盖。
- 组件库控制结构与交互，库内配色与亮暗模式只改变颜色；切色保持当前输入、筛选与选择。
- 技能、包、命令及新增 Agent／MCP／插件入口使用 `design-pal-codex` 前缀，不注册 `design-pal` 泛名；遇到同名安装不得覆盖。
- 只提交源码、必要使用说明、测试与虚构示例；不要提交私人数据、凭据、会话记录或开发过程文档。
- 修改图标时保留第三方许可与来源记录。

- 新组件同步 `src/libraries/component-list.mjs` 及对应浏览器行为测试；新组的样式从统一样式入口导入，不能污染宿主样式。

- 页面或库外观变更后运行 `npm run capture:previews`，逐件查看六张实际页面截图后再发布。主导航和配色切换保留组件实例，首页记忆只使用 design-pal-codex 命名的会话记录。

- 固定发行不可覆盖；采用、升级、确认及恢复必须先审阅对应计划。修改发行范围后同步 `release-files.json`，运行 `npm test`；不要让旧项目静默读取新版。
