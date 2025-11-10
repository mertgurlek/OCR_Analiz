#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re

def parse_markdown_table(table_text):
    """Markdown tablosunu HTML'e çevir"""
    lines = [line.strip() for line in table_text.strip().split('\n') if line.strip()]
    
    if len(lines) < 2:
        return table_text
    
    # Header ve separator'ı ayır
    header_line = lines[0]
    separator_line = lines[1]
    data_lines = lines[2:] if len(lines) > 2 else []
    
    # Sütunları parse et
    def split_row(line):
        # | ile ayrılmış sütunları al
        cells = [cell.strip() for cell in line.split('|')]
        # Boş ilk ve son elemanları temizle
        cells = [c for c in cells if c]
        return cells
    
    headers = split_row(header_line)
    
    # HTML tablo oluştur
    html = '<table>\n<thead>\n<tr>\n'
    for header in headers:
        html += f'<th>{header}</th>\n'
    html += '</tr>\n</thead>\n<tbody>\n'
    
    for data_line in data_lines:
        cells = split_row(data_line)
        html += '<tr>\n'
        for cell in cells:
            html += f'<td>{cell}</td>\n'
        html += '</tr>\n'
    
    html += '</tbody>\n</table>\n'
    return html

def convert_markdown_to_html(md_content):
    """Gelişmiş Markdown -> HTML dönüşümü"""
    
    # Tabloları bul ve dönüştür (önce tabloları parse et)
    table_pattern = r'(\|.+\|[\r\n]+\|[-:\| ]+\|[\r\n]+(?:\|.+\|[\r\n]*)+)'
    tables = re.findall(table_pattern, md_content, re.MULTILINE)
    
    # Tabloları geçici placeholder'larla değiştir
    table_placeholders = {}
    for i, table in enumerate(tables):
        placeholder = f'___TABLE_{i}___'
        table_placeholders[placeholder] = parse_markdown_table(table)
        md_content = md_content.replace(table, placeholder)
    
    # Code blocks (``` ile)
    code_blocks = {}
    code_pattern = r'```(.*?)```'
    for i, match in enumerate(re.finditer(code_pattern, md_content, re.DOTALL)):
        placeholder = f'___CODE_{i}___'
        code_content = match.group(1).strip()
        code_blocks[placeholder] = f'<pre><code>{code_content}</code></pre>'
        md_content = md_content.replace(match.group(0), placeholder)
    
    # Başlıklar
    md_content = re.sub(r'^# (.+)$', r'<h1>\1</h1>', md_content, flags=re.MULTILINE)
    md_content = re.sub(r'^## (.+)$', r'<h2>\1</h2>', md_content, flags=re.MULTILINE)
    md_content = re.sub(r'^### (.+)$', r'<h3>\1</h3>', md_content, flags=re.MULTILINE)
    md_content = re.sub(r'^#### (.+)$', r'<h4>\1</h4>', md_content, flags=re.MULTILINE)
    
    # Bold ve italic
    md_content = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', md_content)
    md_content = re.sub(r'\*(.+?)\*', r'<em>\1</em>', md_content)
    
    # Inline code
    md_content = re.sub(r'`([^`]+)`', r'<code>\1</code>', md_content)
    
    # Listeler (- ile başlayanlar)
    lines = md_content.split('\n')
    result_lines = []
    in_list = False
    
    for line in lines:
        if re.match(r'^[-✅❌⚠️⭐🏆🥈🥉💰⚡] ', line):
            if not in_list:
                result_lines.append('<ul>')
                in_list = True
            # - veya emoji'yi kaldır ve li yap
            item = re.sub(r'^[-✅❌⚠️⭐🏆🥈🥉💰⚡] ', '', line)
            # Emoji'yi geri ekle
            emoji_match = re.match(r'^([✅❌⚠️⭐🏆🥈🥉💰⚡])', line)
            if emoji_match:
                item = emoji_match.group(1) + ' ' + item
            result_lines.append(f'<li>{item}</li>')
        else:
            if in_list:
                result_lines.append('</ul>')
                in_list = False
            result_lines.append(line)
    
    if in_list:
        result_lines.append('</ul>')
    
    md_content = '\n'.join(result_lines)
    
    # Horizontal rules
    md_content = re.sub(r'^---+$', '<hr>', md_content, flags=re.MULTILINE)
    
    # Paragraflar (boş satırlarla ayrılmış)
    paragraphs = md_content.split('\n\n')
    formatted_paragraphs = []
    for para in paragraphs:
        para = para.strip()
        if para and not any(tag in para for tag in ['<h1>', '<h2>', '<h3>', '<h4>', '<ul>', '<table>', '<pre>', '<hr>', '___']):
            para = f'<p>{para}</p>'
        formatted_paragraphs.append(para)
    md_content = '\n\n'.join(formatted_paragraphs)
    
    # Placeholder'ları geri koy
    for placeholder, html in table_placeholders.items():
        md_content = md_content.replace(placeholder, html)
    
    for placeholder, html in code_blocks.items():
        md_content = md_content.replace(placeholder, html)
    
    return md_content

# Markdown dosyasını oku
with open('SONUC_OZET.md', 'r', encoding='utf-8') as f:
    md_content = f.read()

# Markdown'ı HTML'e çevir
html_body = convert_markdown_to_html(md_content)

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
            h2 {{ page-break-before: always; }}
            h2:first-of-type {{ page-break-before: avoid; }}
        }}
        
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.8;
            max-width: 1100px;
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
            margin: 30px 0 20px 0;
        }}
        
        h2 {{
            color: #1e3a8a;
            font-size: 2em;
            border-bottom: 3px solid #93c5fd;
            padding-bottom: 10px;
            margin-top: 50px;
            margin-bottom: 25px;
            page-break-after: avoid;
        }}
        
        h3 {{
            color: #1e40af;
            font-size: 1.6em;
            margin-top: 35px;
            margin-bottom: 15px;
            page-break-after: avoid;
        }}
        
        h4 {{
            color: #3b82f6;
            font-size: 1.3em;
            margin-top: 25px;
            margin-bottom: 12px;
        }}
        
        p {{
            margin: 15px 0;
            line-height: 1.8;
        }}
        
        /* TABLO STİLLERİ - GELİŞTİRİLMİŞ */
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 30px 0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            page-break-inside: avoid;
            border-radius: 8px;
            overflow: hidden;
            font-size: 0.95em;
        }}
        
        thead {{
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
        }}
        
        th {{
            padding: 16px 12px;
            text-align: left;
            color: white;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.85em;
            letter-spacing: 0.5px;
            border-right: 1px solid rgba(255,255,255,0.2);
        }}
        
        th:last-child {{
            border-right: none;
        }}
        
        td {{
            padding: 14px 12px;
            border-bottom: 1px solid #e5e7eb;
            border-right: 1px solid #f3f4f6;
            vertical-align: top;
        }}
        
        td:last-child {{
            border-right: none;
        }}
        
        tbody tr {{
            transition: background-color 0.2s;
        }}
        
        tbody tr:nth-child(odd) {{
            background-color: #ffffff;
        }}
        
        tbody tr:nth-child(even) {{
            background-color: #f9fafb;
        }}
        
        tbody tr:hover {{
            background-color: #eff6ff;
        }}
        
        /* İlk sütun bold (model isimleri için) */
        tbody td:first-child {{
            font-weight: 600;
            color: #1e40af;
        }}
        
        /* Emoji ve özel karakterler için */
        td strong {{
            color: #dc2626;
        }}
        
        /* Code stilleri */
        code {{
            background-color: #f1f5f9;
            padding: 3px 8px;
            border-radius: 4px;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 0.9em;
            color: #dc2626;
            border: 1px solid #e2e8f0;
        }}
        
        pre {{
            background-color: #1e293b;
            color: #e2e8f0;
            padding: 20px;
            border-radius: 8px;
            overflow-x: auto;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            page-break-inside: avoid;
            margin: 20px 0;
            border-left: 4px solid #3b82f6;
        }}
        
        pre code {{
            background-color: transparent;
            color: #e2e8f0;
            padding: 0;
            border: none;
        }}
        
        /* Liste stilleri */
        ul {{
            margin: 15px 0;
            padding-left: 0;
            list-style: none;
        }}
        
        li {{
            margin: 10px 0;
            padding-left: 30px;
            position: relative;
            line-height: 1.6;
        }}
        
        li::before {{
            content: "▪";
            position: absolute;
            left: 10px;
            color: #3b82f6;
            font-weight: bold;
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
            margin: 50px 0;
        }}
        
        .no-print {{
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border: 2px solid #3b82f6;
            padding: 25px;
            border-radius: 12px;
            margin: 20px 0;
            text-align: center;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
        }}
        
        .no-print button {{
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            border: none;
            padding: 14px 35px;
            font-size: 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }}
        
        .no-print button:hover {{
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
        }}
        
        .no-print p {{
            margin-top: 12px;
            color: #4b5563;
            font-size: 14px;
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
        <p>Tarayıcıda "Hedef: PDF olarak kaydet" seçeneğini seçin</p>
    </div>
    
    {html_body}
</body>
</html>
"""

# HTML dosyasını kaydet
with open('SONUC_OZET.html', 'w', encoding='utf-8') as f:
    f.write(full_html)

print("✅ Geliştirilmiş HTML dosyası oluşturuldu: SONUC_OZET.html")
print("📊 Tablolar düzgün şekilde formatlandı")
print("📄 Tarayıcıda açıp Ctrl+P ile PDF olarak kaydedebilirsiniz")
