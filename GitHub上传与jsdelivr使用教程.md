# MClite 项目 - GitHub 同步与 jsdelivr 使用教程

> **你的仓库信息：**
>
> - GitHub 用户名：`CrHouse815`
> - 仓库名：`-MC-_lite-`
> - 仓库地址：<https://github.com/CrHouse815/-MC-_lite->

---

## 🔄 日常同步操作（每次改完代码后）

### 方法一：在 Cursor/VSCode 中操作（推荐，最简单）

1. 打开 Cursor/VSCode
2. 按 `Ctrl+Shift+G` 打开源代码管理面板
3. 在左侧看到有改动的文件
4. 点击 `+` 号暂存所有更改
5. 在输入框写一句话描述改了什么，比如 "修复了xxx问题"
6. 点击 ✓ 提交
7. 点击 `...` 菜单 → 推送（或按 `Ctrl+Shift+P` 输入 "git push"）

### 方法二：用命令行（在 MClite 文件夹的终端中）

```bash
# 第1步：把所有改动添加进去
git add .

# 第2步：写一句话说明改了什么
git commit -m "你的描述，比如：修复了按钮样式"

# 第3步：推送到 GitHub
git push
```

**就这三步！** 每次改完代码运行这三个命令就行了。

---

## 📦 编译文件并让酒馆能用

### 问题：为什么不能直接用 GitHub 上的源代码？

你的 `.vue` 和 `.ts` 文件是源代码，浏览器不能直接运行。需要先「编译」成 `.js` 和 `.css` 文件。

### 解决方案：设置自动编译

**第1步：在项目根目录运行编译命令**

```bash
# 在 tavern_helper_template-main 目录下运行
pnpm build:MClite
```

这会在 `dist/MClite` 目录下生成：

- `index.html` - 界面文件
- `index.js` - JavaScript 代码
- `style.css` - 样式文件

**第2步：把编译后的文件也推送到 GitHub**

编译完成后，进入 MClite 文件夹：

```bash
cd src/MClite
git add .
git commit -m "Build: 更新编译后的文件"
git push
```

---

## 🌐 使用 jsdelivr CDN

### jsdelivr 是什么？

免费的 CDN 服务，让你可以通过网址直接获取 GitHub 上的文件，速度快且稳定。

### 你的 jsdelivr 地址格式

```
https://cdn.jsdelivr.net/gh/CrHouse815/-MC-_lite-@main/文件路径
```

### 实际例子

| 文件 | jsdelivr 地址 |
|------|---------------|
| App.vue | `https://cdn.jsdelivr.net/gh/CrHouse815/-MC-_lite-@main/App.vue` |
| index.ts | `https://cdn.jsdelivr.net/gh/CrHouse815/-MC-_lite-@main/index.ts` |
| 样式文件 | `https://cdn.jsdelivr.net/gh/CrHouse815/-MC-_lite-@main/styles/index.scss` |

### ⚠️ 重要提示

1. **仓库必须是 Public（公开的）** - 你的已经是公开的了 ✓
2. **文件路径区分大小写** - 大小写必须完全一致
3. **缓存问题** - jsdelivr 会缓存文件约 24 小时，更新后可能不会立即生效
   - 手动清除缓存：访问 `https://purge.jsdelivr.net/gh/CrHouse815/-MC-_lite-@main/文件路径`

---

## 🎮 在酒馆中使用

### 方式一：直接引用编译后的文件（推荐）

如果你编译了项目并上传了 dist 文件夹：

```html
<!-- 在界面的 HTML 中 -->
<script src="https://cdn.jsdelivr.net/gh/CrHouse815/-MC-_lite-@main/dist/index.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/CrHouse815/-MC-_lite-@main/dist/style.css">
```

### 方式二：引用 JSON 配置文件

如果只是想用变量模板：

```javascript
// 在脚本中
fetch('https://cdn.jsdelivr.net/gh/CrHouse815/-MC-_lite-@main/想法集/设计文档/MClite示例变量.json')
  .then(res => res.json())
  .then(data => console.log(data));
```

---

## ❓ 常见问题解答

### Q: 每次都要手动编译推送，太麻烦了

A: 可以设置 GitHub Actions 自动编译，每次推送代码后自动生成编译文件。需要的话告诉我，我帮你设置。

### Q: jsdelivr 返回 404？

检查：

1. 文件路径是否正确（大小写）
2. 文件是否已经推送到 GitHub
3. 等几分钟让 jsdelivr 同步

### Q: 更新了文件但 jsdelivr 还是旧的？

访问清除缓存的地址：

```
https://purge.jsdelivr.net/gh/CrHouse815/-MC-_lite-@main/你的文件路径
```

### Q: 中文路径会不会有问题？

可能有编码问题，建议把 `想法集` 改成英文名如 `ideas`。

---

## 📋 快速命令参考

```bash
# 查看状态（看看有什么改动）
git status

# 添加所有改动
git add .

# 提交（写描述）
git commit -m "描述你的改动"

# 推送到 GitHub
git push

# 从 GitHub 拉取最新代码
git pull
```

---

## 🚀 完整工作流程示例

假设你刚改完一个 Vue 组件：

```bash
# 1. 进入 MClite 目录
cd src/MClite

# 2. 看看改了什么
git status

# 3. 添加改动
git add .

# 4. 提交
git commit -m "修复了 MainContent 组件的样式问题"

# 5. 推送
git push
```

然后在浏览器访问你的 GitHub 仓库，就能看到更新了！
