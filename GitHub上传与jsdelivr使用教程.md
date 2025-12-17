# MClite 项目上传到 GitHub 并使用 jsdelivr 教程

## 一、准备工作

### 1. 确保已安装 Git

```bash
git --version
```

如果未安装，请前往 <https://git-scm.com/downloads> 下载安装。

### 2. 配置 Git 用户信息（首次使用需要）

```bash
git config --global user.name "你的用户名"
git config --global user.email "你的邮箱@example.com"
```

---

## 二、创建 GitHub 仓库

### 方法一：通过 GitHub 网页创建（推荐）

1. 访问 <https://github.com> 并登录
2. 点击右上角 "+" → "New repository"
3. 填写信息：
   - **Repository name**: `MClite`
   - **Description**: `MClite - 一个轻量级的内容管理界面` (可选)
   - **Visibility**: 选择 **Public**（公开）- ⚠️ 这是使用 jsdelivr 的必要条件！
   - **不要**勾选 "Add a README file"
4. 点击 "Create repository"

---

## 三、将 MClite 文件夹上传到 GitHub

### 方式一：只上传 MClite 文件夹（推荐）

如果你只想上传 MClite 项目，需要在 MClite 文件夹内初始化 Git：

```bash
# 进入 MClite 文件夹
cd src/MClite

# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 提交更改
git commit -m "Initial commit: MClite project"

# 添加远程仓库（将 YOUR_USERNAME 替换为你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/MClite.git

# 推送到 GitHub
git push -u origin main
```

**如果提示分支名是 master 而不是 main：**

```bash
git branch -M main
git push -u origin main
```

### 方式二：使用 GitHub Desktop（图形界面，更简单）

1. 下载 GitHub Desktop: <https://desktop.github.com/>
2. 登录你的 GitHub 账号
3. 点击 "Add" → "Add Existing Repository"
4. 选择 MClite 文件夹
5. 填写提交信息，点击 "Commit to main"
6. 点击 "Publish repository"

---

## 四、使用 jsdelivr CDN

### jsdelivr 是什么？

jsdelivr 是一个免费的 CDN 服务，可以直接从 GitHub 仓库中获取文件，非常适合托管静态资源。

### 基本 URL 格式

```
https://cdn.jsdelivr.net/gh/用户名/仓库名@版本/文件路径
```

### 版本说明

- `@main` 或 `@master` - 使用主分支最新版本
- `@v1.0.0` - 使用特定 tag 版本
- `@commit-hash` - 使用特定提交

### 实际示例

假设你的 GitHub 用户名是 `myuser`，仓库名是 `MClite`：

#### 1. 引用 JavaScript/TypeScript 文件

```
https://cdn.jsdelivr.net/gh/myuser/MClite@main/index.ts
```

#### 2. 引用 Vue 组件

```
https://cdn.jsdelivr.net/gh/myuser/MClite@main/App.vue
```

#### 3. 引用样式文件

```
https://cdn.jsdelivr.net/gh/myuser/MClite@main/styles/index.scss
```

#### 4. 引用 JSON 配置

```
https://cdn.jsdelivr.net/gh/myuser/MClite@main/想法集/设计文档/MClite示例变量.json
```

### 在酒馆中使用

如果要在 SillyTavern 的 iframe 中引用资源：

```html
<script src="https://cdn.jsdelivr.net/gh/myuser/MClite@main/dist/bundle.js"></script>
```

或者用于 CSS：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/myuser/MClite@main/dist/style.css">
```

---

## 五、重要提示

### 1. 仓库必须是 Public（公开）

jsdelivr 只能访问公开仓库，私有仓库无法使用。

### 2. 文件路径是大小写敏感的

确保 URL 中的路径与实际文件路径完全匹配。

### 3. 缓存问题

jsdelivr 会缓存文件。如果更新了文件但没有生效：

- 等待约 24 小时让缓存自动失效
- 或者使用 `https://purge.jsdelivr.net/gh/用户名/仓库名@版本/文件路径` 手动清除缓存

### 4. 中文路径可能有问题

建议将 `想法集` 等中文文件夹重命名为英文，如 `ideas`，以避免编码问题。

### 5. 使用版本 tag 而非分支名

```bash
# 创建版本 tag
git tag v1.0.0
git push origin v1.0.0
```

然后使用：

```
https://cdn.jsdelivr.net/gh/myuser/MClite@v1.0.0/文件路径
```

---

## 六、常见问题

### Q: 推送时要求输入密码但失败了？

A: GitHub 已禁用密码认证，需要使用 Personal Access Token：

1. 前往 GitHub → Settings → Developer settings → Personal access tokens
2. 生成新 token，勾选 `repo` 权限
3. 用这个 token 代替密码

### Q: jsdelivr 返回 404？

A: 检查：

- 仓库是否为 Public
- 文件路径是否正确（大小写）
- 文件是否已推送到 GitHub

### Q: 如何更新文件？

```bash
git add .
git commit -m "Update: 描述你的更改"
git push
```

---

## 七、推荐的项目结构

为了更好地使用 jsdelivr，建议将编译/打包后的文件放在 `dist` 文件夹：

```
MClite/
├── dist/           # 编译后的文件（用于 CDN）
│   ├── bundle.js
│   └── style.css
├── src/            # 源代码
├── components/
├── styles/
└── README.md
```

这样引用时更清晰：

```
https://cdn.jsdelivr.net/gh/myuser/MClite@v1.0.0/dist/bundle.js
