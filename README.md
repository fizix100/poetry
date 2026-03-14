# 友林诗文集

静态网站，用于浏览《有林诗文》诗文集。风格简约，按类别展示，支持按时间排序。

## 结构

- **首页** `index.html`：六类入口（至亲乡情、四季更迭、咏物感怀、寄情山水、忧国忧民、散文）
- **列表页** `list.html?category=xxx`：该类别下全部诗/文，可切换「默认顺序」「时间从早到晚」「时间从晚到早」
- **单篇页** `item.html?id=xxx`：标题、日期、正文
- **关于** `about.html`：简介与《自述》链接

数据来自 `data/poems.json`，由 `scripts/parse.js` 从 `raw.txt`（PDF 提取文本）生成。

## 本地预览

需通过 HTTP 打开（不能直接打开 `file://`，否则无法加载 JSON）：

```bash
# Python
python3 -m http.server 8765

# 或 Node
npx serve .
```

浏览器访问：<http://localhost:8765/>

## 重新生成数据

1. **重新提取 PDF 全文**（推荐先做，确保无遗漏）：
   ```bash
   pip3 install pypdf
   python3 scripts/extract_pdf.py
   ```
   会从 `有林诗文正式稿.pdf` 生成/覆盖 `raw.txt`。

2. **解析为 JSON**：
   ```bash
   node scripts/parse.js
   ```
   会更新 `data/poems.json`。

3. **检查完整性**（可选）：
   ```bash
   node scripts/check-completeness.js
   ```
   会输出篇数、是否有空正文、重复标题等。

4. **逐篇核对正文**（确保一字不差）：
   ```bash
   node scripts/verify-all-content.js
   ```
   从 `raw.txt` 按行重新提取每篇正文，与 `data/poems.json` 逐条比对；通过则打印「所有篇目正文与 raw.txt 一致」，否则输出差异并写入 `verify-report.json`。

## 部署

将项目根目录下所有文件（含 `index.html`、`list.html`、`item.html`、`about.html`、`css/`、`js/`、`data/poems.json`）上传至任意静态托管（如 GitHub Pages、Netlify）即可。
