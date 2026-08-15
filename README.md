# M2GO 每周可上班时间

这是 M2GO 员工填写每周可上班时间的内部工具，电脑和手机都可以使用。

## 使用方式

- 首页有八个固定员工位置，初始名称为 `1–8`。
- 员工选择自己的名称后，只会打开该员工的个人时间编辑器。
- 周一至周五可选择 `11-6`、`6-C` 或全天 `11-C`。
- 周六、周日可选择 `11:30-6`、`6-C` 或全天 `11:30-C`。
- 每天也可以填写一个自定义连续时段，修改后自动保存。
- `C` 代表当天午夜 `12:00 AM`。

经理通过 `/manager` 和六位经理 PIN 登录，可以查看全员总表，并把待定编号修改成正式姓名。员工位置的内部 ID 不会改变，因此改名不会影响历史记录。

员工暂时没有 PIN。这一版默认不展示其他人的时间，但不能阻止有人故意返回列表并选择另一个员工位置。

## 在这台电脑启动

双击 `启动M2GO.bat` 或 `Start-M2GO-Schedule.cmd`。浏览器会自动打开
`http://localhost:3000`。启动窗口需要保持开启；关闭窗口即可停止网站。

本地数据保存在项目的 `.wrangler` 目录中。经理密钥保存在 Windows 本机的
`%LOCALAPPDATA%\M2GO\manager.env`，不会放进 OneDrive 或上传到 GitHub。

## 配置新的经理 PIN

运行下面的命令，把 `123456` 换成新的六位数字：

```powershell
node scripts/create-manager-config.mjs 123456 --write-local
```

命令会直接更新本机经理配置；重新启动网站后生效。公开仓库中的
`.env.example` 只包含变量名称，不包含真实 PIN 或会话密钥。

## 技术结构

- 界面：React + Vinext
- 数据：Cloudflare D1 / SQLite
- 员工时间接口：`app/api/availability/route.ts`
- 经理权限：`app/api/manager/`
- 数据库结构：`db/schema.ts`
- 数据库迁移：`drizzle/`

## 验证

```powershell
npm run build
npm test
```
