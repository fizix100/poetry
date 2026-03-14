#!/usr/bin/env python3
"""从 有林诗文正式稿.pdf 提取全文到 raw.txt，供 parse.js 使用。"""
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
pdf_path = root / "有林诗文正式稿.pdf"
out_path = root / "raw.txt"

if not pdf_path.exists():
    print("未找到 有林诗文正式稿.pdf", file=sys.stderr)
    sys.exit(1)

try:
    from pypdf import PdfReader
except ImportError:
    print("请先安装: pip3 install pypdf", file=sys.stderr)
    sys.exit(1)

reader = PdfReader(str(pdf_path))
text = ""
for page in reader.pages:
    text += (page.extract_text() or "") + "\n"

out_path.write_text(text, encoding="utf-8")
print(f"已写入 raw.txt，共 {len(text)} 字符，{len(text.splitlines())} 行")
