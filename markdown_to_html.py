#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Markdown dosyasını oku
with open('SONUC_OZET.md', 'r', encoding='utf-8') as f:
    md_content = f.read()

# Basit Markdown -> HTML dönüşümü (markdown kütüphanesi olmadan)
html_content = md_content

# Başlıkları dönüştür
import re
html_content = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html_content, flags=re.MULTILINE)
html_content = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html_content, flags=re.MULTILINE)
html_content = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html_content, flags=re.MULTILINE)
html_content = re.sub(r'^#### (.+)$', r'<h4>\1</h4>', html_content, flags=re.MULTILINE)

# Bold ve italic
html_content = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html_content)
html_content = re.sub(r'\*(.+?)\*', r'<em>\1</em>', html_content)

# Code blocks
html_content = re.sub(r'```(.+?)```', r'<pre><code>\1</code></pre>', html_content, flags=re.DOTALL)
html_content = re.sub(r'`(.+?)`', r'<code>\1</code>', html_content)

# Listeler
html_content = re.sub(r'^- (.+)$', r'<li>\1</li>', html_content, flags=re.MULTILINE)
html_content = re.sub(r'^✅ (.+)$', r'<li>✅ \1</li>', html_content, flags=re.MULTILINE)
html_content = re.sub(r'^❌ (.+)$', r'<li>❌ \1</li>', html_content, flags=re.MULTILINE)
html_content = re.sub(r'^⚠️ (.+)$', r'<li>⚠️ \1</li>', html_content, flags=re.MULTILINE)

# Paragraflar
html_content = html_content.replace('\n\n', '</p><p>')

# HTML template
full_html = f"""
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OCR Model Karşılaştırma Sonuç Özeti</title>
    <style>
        @media print {{
            body {{ margin: 1cm; }}
            .no-print {{ display: none; }}
        }}
        
        body {{
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.8;
            max-width: 1000px;
            margin: 0 auto;
            padding: 40px 20px;
            color: #1a1a1a;
            background: #ffffff;
        }}
        
        h1 {{
            color: #1e40af;
            font-size: 2.5em;
            border-bottom: 4px solid #3b82f6;
            padding-bottom: 15px;
            margin-top: 0;
        }}
        
        h2 {{
            color: #1e3a8a;
            font-size: 2em;
            border-bottom: 2px solid #93c5fd;
            padding-bottom: 10px;
            margin-top: 40px;
            page-break-after: avoid;
        }}
        
        h3 {{
            color: #1e40af;
            font-size: 1.5em;
            margin-top: 30px;
            page-break-after: avoid;
        }}
        
        h4 {{
            color: #3b82f6;
            font-size: 1.2em;
            margin-top: 20px;
        }}
        
        p {{
            margin: 15px 0;
            text-align: justify;
        }}
        
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 25px 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            page-break-inside: avoid;
        }}
        
        th, td {{
            border: 1px solid #e5e7eb;
            padding: 14px;
            text-align: left;
        }}
        
        th {{
            background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
            color: white;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.85em;
            letter-spacing: 0.5px;
        }}
        
        tr:nth-child(even) {{
            background-color: #f9fafb;
        }}
        
        tr:hover {{
            background-color: #eff6ff;
        }}
        
        code {{
            background-color: #f3f4f6;
            padding: 3px 8px;
            border-radius: 4px;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 0.9em;
            color: #dc2626;
        }}
        
        pre {{
            background-color: #1e293b;
            color: #e2e8f0;
            padding: 20px;
            border-radius: 8px;
            overflow-x: auto;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            page-break-inside: avoid;
        }}
        
        pre code {{
            background-color: transparent;
            color: #e2e8f0;
            padding: 0;
        }}
        
        ul, ol {{
            margin: 15px 0;
            padding-left: 30px;
        }}
        
        li {{
            margin: 8px 0;
            line-height: 1.6;
        }}
        
        strong {{
            color: #1e40af;
            font-weight: 600;
        }}
        
        em {{
            color: #4b5563;
            font-style: italic;
        }}
        
        hr {{
            border: none;
            border-top: 2px solid #e5e7eb;
            margin: 40px 0;
        }}
        
        .page-break {{
            page-break-after: always;
        }}
        
        .no-print {{
            background: #eff6ff;
            border: 2px solid #3b82f6;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: center;
        }}
        
        .no-print button {{
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 30px;
            font-size: 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s;
        }}
        
        .no-print button:hover {{
            background: #2563eb;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
        }}
        
        @page {{
            size: A4;
            margin: 2cm;
        }}
    </style>
</head>
<body>
    <div class="no-print">
        <button onclick="window.print()">🖨️ PDF Olarak Kaydet (Ctrl+P)</button>
        <p style="margin-top: 10px; color: #4b5563;">Tarayıcıda "Hedef: PDF olarak kaydet" seçeneğini seçin</p>
    </div>
    
    <p>{html_content}</p>
</body>
</html>
"""

# HTML dosyasını kaydet
with open('SONUC_OZET.html', 'w', encoding='utf-8') as f:
    f.write(full_html)

print("✅ HTML dosyası oluşturuldu: SONUC_OZET.html")
print("📄 Tarayıcıda açıp Ctrl+P ile PDF olarak kaydedebilirsiniz")
print("   veya 'PDF olarak kaydet' butonuna tıklayın")
