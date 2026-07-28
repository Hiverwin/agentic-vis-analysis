# WidgetVA Vgplot Standalone Harness

这个样例是一个**完全独立于 `apps/widgetva-system`** 的最小页面 harness。

它的目的不是替代真实 `vgplot` 官方页面，而是先把下面这条链路单独验证清楚：

- `context / plot` 创建
- `WidgetVA vgplot runtime assembly` 自动挂接
- canonical action -> `executeVgplotAction(...)`
- human direct mutation / agent action
- `readVgplotState(...)`
- `provider.inspectVerification`
- provider-native evidence 回读

## 当前边界

仓库里现在还**没有安装真实 `vgplot / Mosaic` 依赖**，所以这个样例不是官方库 demo。

它是一个 runtime-shape harness：

- 用和当前 `vgplot provider` 一样的 `context / plot / selection / param / configAction` 形态
- 直接走当前仓库里的 `installVgplotRuntimeAssembly(...)`
- 独立验证 WidgetVA 的 provider 接线与取证方式

后续如果把真实 `vgplot` 依赖装进来，这个 harness 可以作为替换模板，把这里的 mock plot/context 换成真实 `createAPIContext(...)` / `plot(...)` 创建链。

## 运行方式

这个样例现在带有真实的模型代理入口，所以**不要再用 `file://...` 或纯静态 `python3 -m http.server`**。

请在仓库根目录准备好本地环境变量：

```bash
OPENROUTER_API_KEY=...
```

然后启动这个样例自带的独立 server：

```bash
node widgetva-kit/examples/vgplot-standalone/server.mjs
```

默认地址：

```text
http://127.0.0.1:4177/widgetva-kit/examples/vgplot-standalone/
```

## 页面里能看到什么

- 左侧：
  - Natural Language Agent
  - Human runtime mutation
  - Agent through WidgetVA
- 中间：
  - 一个最小 scatter harness
  - 当前 viewport / selection / regression 状态的可视化
- 右侧：
  - `readVgplotState(...)` 的 provider-native snapshot
  - `provider.inspectVerification` 的统一 verify 形态证据
  - canonical action request / model-backed session 摘要
  - last action log

## 控制台入口

页面会暴露：

```js
window.__widgetvaVgplotStandalone
```

可直接调用：

```js
window.__widgetvaVgplotStandalone.readState()
window.__widgetvaVgplotStandalone.inspectProviderVerification()
window.__widgetvaVgplotStandalone.runAgentAction('scatter.zoomDomain', {
  xDomain: [60, 200],
  yDomain: [15, 32],
})
await window.__widgetvaVgplotStandalone.runNaturalLanguageAgent(
  '请显示当前视图的回归线，并告诉我 horsepower 和 mpg 的关系。'
)
```
