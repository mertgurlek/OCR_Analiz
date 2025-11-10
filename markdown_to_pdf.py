import markdown
from weasyprint import HTML
import os

# Markdown dosyasını oku
with open('SONUC_OZET.md', 'r', encoding='utf-8') as f:
    md_content = f.read()

# Markdown'ı HTML'e çevir
html_content = markdown.markdown(md_content, extensions=['tables', 'fenced_code'])

# HTML template ile sarmal
html_with_style = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 40px auto;
            padding: 20px;
            color: #333;
        }}
        h1 {{
            color: #2563eb;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 10px;
        }}
        h2 {{
            color: #1e40af;
            border-bottom: 2px solid #93c5fd;
            padding-bottom: 8px;
            margin-top: 30px;
        }}
        h3 {{
            color: #1e3a8a;
            margin-top: 20px;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }}
        th {{
            background-color: #2563eb;
            color: white;
        }}
        tr:nth-child(even) {{
            background-color: #f3f4f6;
        }}
        code {{
            background-color: #f3f4f6;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Consolas', 'Monaco', monospace;
        }}
        pre {{
            background-color: #1e293b;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }}
        pre code {{
            background-color: transparent;
            color: #e2e8f0;
        }}
        blockquote {{
            border-left: 4px solid #2563eb;
            padding-left: 20px;
            margin-left: 0;
            color: #666;
        }}
        .page-break {{
            page-break-after: always;
        }}
        @page {{
            margin: 2cm;
            size: A4;
        }}
    </style>
</head>
<body>
    {html_content}
</body>
</html>
"""

# PDF olarak kaydet
try:
    HTML(string=html_with_style).write_pdf('SONUC_OZET.pdf')
    print("✅ PDF başarıyla oluşturuldu: SONUC_OZET.pdf")
except Exception as e:
    print(f"❌ Hata: {e}")
    print("\nWeasyPrint yüklü değil. Yükleme için:")
    print("pip install weasyprint markdown")
