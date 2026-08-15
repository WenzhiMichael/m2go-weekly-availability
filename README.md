# M2GO 每周可上班时间

这是 M2GO 全员共用的每周可上班时间收集表，电脑和手机都可以使用。

## 主要功能

- 员工只需填写一个英文名，不区分前台或后厨。
- 周一至周五可选择 `11-6`、`6-C` 或全天 `11-C`。
- 周六、周日可选择 `11:30-6`、`6-C` 或全天 `11:30-C`。
- 每天也可以填写一个自定义连续时段。
- 每次修改都会自动保存；同一位员工同一周只更新一份记录。
- 全员总表用绿色格子显示大家可以上班的班次。
- 可以复制个人时间，直接发送到聊天群。
- 系统按 Toronto 时间在每周一自动切换到新的一周，旧记录会保留。

`C` 代表当天午夜 `12:00 AM`。

## 在这台电脑启动

双击 `启动M2GO.bat` 或 `Start-M2GO-Schedule.cmd`。浏览器会自动打开
`http://localhost:3000`。启动窗口需要保持开启；关闭窗口即可停止网站。

本地预览数据保存在项目的 `.wrangler` 目录中，这个目录不会上传到 GitHub。

## 技术结构

- 界面：React + Vinext
- 数据：Cloudflare D1 / SQLite
- 可上班时间页面：`app/ScheduleApp.tsx`
- 数据接口：`app/api/availability/route.ts`
- 数据库结构：`db/schema.ts`
- 数据库迁移：`drizzle/`

## 验证

```powershell
npm run build
npm test
```
