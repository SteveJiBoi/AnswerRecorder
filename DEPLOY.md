# 部署到 GitHub Pages

本网站是纯静态站点（HTML/CSS/JS，无后端），可以直接托管在 GitHub Pages 上，完全免费。

## 一、准备

- 一个 GitHub 账号
- 电脑上已安装 git（在终端输入 `git --version` 能看到版本号即可）

## 二、把网站推送到 GitHub

1. 在 GitHub 上新建一个仓库（Repository）
   - 点击右上角 **+ → New repository**
   - 名称随意，例如 `toefl-practice`
   - 选择 **Public**（公开，Pages 才能访问）
   - **不要**勾选 “Add a README”（保持空仓库）
   - 点击 **Create repository**

2. 打开终端，进入本网站文件夹（就是包含 `index.html` 的这个 `toefl-practice-site` 文件夹）：

   ```bash
   cd "/Users/steveji/Desktop/托福上课/托福每周任务/答案/toefl-practice-site"
   ```

3. 依次执行（把 `<你的用户名>` 和 `<仓库名>` 换成你自己的）：

   ```bash
   git init
   git add .
   git commit -m "TOEFL practice site"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```

   > 第一次推送会让你登录 GitHub（浏览器授权或输入 Personal Access Token）。

## 三、开启 GitHub Pages

1. 打开你的仓库页面 → **Settings**（设置）
2. 左侧菜单点 **Pages**
3. **Source** 选择 **Deploy from a branch**
4. **Branch** 选择 **main**，文件夹选择 **/ (root)**，点击 **Save**
5. 等待约 1–2 分钟，页面顶部会出现网址：

   ```
   https://<你的用户名>.github.io/<仓库名>/
   ```

   打开它就能使用了。手机、平板、其他电脑都能访问。

## 四、以后更新

### 改了网页代码或答案数据后重新发布
```bash
cd "/Users/steveji/Desktop/托福上课/托福每周任务/答案/toefl-practice-site"
git add .
git commit -m "update"
git push
```
推送后 1–2 分钟，线上网站自动更新。

### 新增 / 修改答案文档后，重新生成题库
当你在「答案」文件夹里新增或修改了 `.pdf` / `.docx` 真题文档，运行下面命令重新生成 `data/tasks.js`（需要 Python 3）：

```bash
cd "/Users/steveji/Desktop/托福上课/托福每周任务/答案/toefl-practice-site"
pip3 install python-docx pdfplumber pyspellchecker
python3 parse_answers.py "/Users/steveji/Desktop/托福上课/托福每周任务/答案"
```

它会自动扫描该文件夹下所有 `.pdf` / `.docx`，把题目和答案写入 `data/tasks.js`。然后按上面的步骤 `git add / commit / push` 即可。

## 说明

- **做题记录**保存在浏览器本地（localStorage），换设备或清理浏览器数据后会消失；每次提交导出的 **Excel 文件**才是可长期保存的正式记录。
- 网站使用 CDN 上的 SheetJS 生成 Excel，需要联网才能导出。
