# 组件用法

当前提供常用后台组件独立入口，以及由这些组件驱动的首页、库详情、总览和同类页面预览。固定发行、项目采用和技能安装仍在开发。组件不会请求业务服务；保存、上传等业务动作由使用方通过回调实现。

本页说明公共区域与基础组件，其余方法见 [表单](FORMS.md)、[表格](TABLE.md)、[导航](NAVIGATION.md)和[图表与反馈](FEEDBACK.md)。

## 本地预览与测试

需要 Node.js 24。首次安装测试浏览器需要联网下载，运行组件本身不依赖远程资源。

```sh
npm ci
npx playwright install chromium
npm run build
npm run preview
```

打开 <http://127.0.0.1:4173/> 进入首页，从卡片进入当前配色的库详情。详情固定当前库，颜色主题与亮暗切换不清空当前输入和筛选；组件总览、页面预览和库说明处于同级导航。

原始交互样稿保留在 `examples/preview/index.html`，用于设计回归对照。基础验证和独立组件目录分别位于 `src/preview/foundation.html`、`src/preview/components.html`。

```sh
npm test
npm run test:browser
```

预览只监听本机地址并只提供构建清单中的资源，不能将此开发服务器当作互联网服务部署。构建加入新资源后，重新启动预览服务以加载新的资源清单。

### 首页图片

`npm run capture:previews` 从运行中的正式页面生成三库六张亮色配色图，固定窗口为 931 × 792。它先拍完全部图片，再替换首页资产。图片是模拟数据页面的截图，不能替代其他场景和真实业务验收；重新发布图片前应检查内容、元数据与许可。

## 在页面内采用基础组件

加载 `src/components/styles.css`，再通过 ES modules（浏览器原生模块）导入入口。每个区域固定一套库，在区域内切换配色和亮暗模式。

```html
<link rel="stylesheet" href="./src/components/styles.css">
<div id="example"></div>
<script type="module">
  import { createSurface } from './src/index.mjs';

  const surface = createSurface(document.querySelector('#example'), {
    library: 'order', color: 'indigo', mode: 'light',
  });
  const input = surface.input({
    label: '项目名称', value: '演示项目', hint: '请输入项目名称',
    onInput(value) { input.update({ error: value.trim() ? '' : '请填写项目名称' }); },
  });
  const save = surface.button({
    label: '保存', icon: 'check-circle',
    onPress() {
      // 在此连接自己的业务；组件不会自动保存数据。
      input.update({ hint: '已收到保存操作' });
    },
  });
  const details = surface.details({
    title: '项目详情', description: '当前项目的说明',
    content: '这是按文字显示的详情内容。',
  });

  surface.setAppearance({ color: 'slate', mode: 'dark' });
  // 离开当前页面时调用 surface.destroy()，释放组件及其事件。
</script>
```

## 更新与移除

| 对象 | 能力 |
|---|---|
| 区域 | `element` 为区域根节点；`appearance` 返回选用信息；`setAppearance({color,mode})` 只改颜色；`destroy()` 移除区域及其创建的组件 |
| 按钮 | `label`、`variant`、`icon`、`ariaLabel`、`disabled`、`loading`、`onPress`；返回 `element`、`update(patch)`、`destroy()` |
| 单行输入 | `label`、`value`、`hint`、`error`、`placeholder`、`disabled`、`readOnly`、`onInput(value,event)`；返回外层 `element`、实际 `control`、`update(patch)`、`destroy()` |
| 详情 | `title`、`description`、`content`、`triggerLabel`、`onOpenChange(isOpen)`；返回 `element`、`trigger`、`panel`、`open()`、`close()`、`isOpen`、`update(patch)`、`destroy()` |

- `button`、`input`、`details` 的第二个参数可指定区域内的目标容器，便于组合业务布局；不能挂载到另一个区域。
- 输入框更新提示或错误不会清空已输入内容；显式更新 `value` 才会替换输入。
- 按钮加载或禁用时不触发业务回调；图标按钮必须提供 `ariaLabel`，输入框必须提供标签。
- 三库分别使用侧边抽屉、居中弹窗和就地详情。弹窗使用原生对话框管理焦点，关闭后恢复此前焦点；就地详情内也可按 Escape 关闭。
- `content` 字符串始终按文字呈现。可传调用方构造的可信 DOM 节点；该节点自身的业务监听或外部资源由调用方管理。
- `destroy()` 可重复调用。卸载后不能再次更新或挂载，应创建新的区域。
- CSS（样式规则）限定在组件区域内；本阶段尚未验证所有既有框架、样式系统或桌面宿主组合。

## 配色

| 库 | 颜色主题 | 详情方式 |
|---|---|---|
| `order` 规整 | `indigo` 靛青、`slate` 岩灰 | 侧边抽屉 |
| `ease` 松弛 | `clay` 陶土、`sage` 鼠尾草 | 居中弹窗 |
| `edge` 棱角 | `ocean` 深海、`amber` 琥珀 | 就地展开 |

每个颜色主题支持 `light` 和 `dark`。颜色、模式和库不匹配时明确报错，不自动改用另一套设计。
