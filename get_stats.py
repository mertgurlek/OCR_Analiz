import sqlite3
import json

conn = sqlite3.connect('backend/ocr_test.db')
cursor = conn.cursor()

print("=== GERÇEK İSTATİSTİKLER ===\n")

# Toplam analiz
cursor.execute('SELECT COUNT(*) FROM analyses')
total_analyses = cursor.fetchone()[0]
print(f"Toplam Analiz: {total_analyses}")

# Toplam değerlendirme
cursor.execute('SELECT COUNT(*) FROM model_evaluations')
total_evals = cursor.fetchone()[0]
print(f"Toplam Değerlendirme: {total_evals}\n")

# Model bazlı başarı oranları
print("=== MODEL BAŞARI ORANLARI ===")
cursor.execute('''
    SELECT 
        model_name, 
        COUNT(*) as total,
        SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) as correct
    FROM model_evaluations 
    GROUP BY model_name
''')
for row in cursor.fetchall():
    model, total, correct = row
    accuracy = (correct/total*100) if total > 0 else 0
    print(f"{model}: {correct}/{total} doğru ({accuracy:.1f}%)")

# Model performans metrikleri
print("\n=== MODEL PERFORMANS ===")
cursor.execute('''
    SELECT 
        model_name, 
        AVG(processing_time_ms) as avg_time,
        AVG(estimated_cost) as avg_cost,
        AVG(confidence_score) as avg_confidence,
        COUNT(*) as test_count
    FROM ocr_results 
    WHERE error IS NULL
    GROUP BY model_name
''')
for row in cursor.fetchall():
    model, avg_time, avg_cost, avg_conf, count = row
    print(f"{model}:")
    print(f"  - Ortalama Süre: {avg_time:.0f}ms")
    print(f"  - Ortalama Maliyet: ${avg_cost:.6f} (₺{avg_cost*41.80:.4f})")
    print(f"  - Ortalama Confidence: {avg_conf:.2f}" if avg_conf else "  - Confidence: N/A")
    print(f"  - Test Sayısı: {count}")

# Prompt test istatistikleri
print("\n=== PROMPT TEST İSTATİSTİKLERİ ===")
cursor.execute('SELECT COUNT(*) FROM prompt_tests')
prompt_tests = cursor.fetchone()[0]
print(f"Toplam Prompt Testi: {prompt_tests}")

cursor.execute('''
    SELECT 
        label,
        COUNT(*) as count
    FROM prompt_tests
    WHERE label IS NOT NULL
    GROUP BY label
''')
print("Etiket Dağılımı:")
for row in cursor.fetchall():
    print(f"  {row[0]}: {row[1]}")

# Fiş kütüphanesi
print("\n=== FİŞ KÜTÜPHANESİ ===")
cursor.execute('SELECT COUNT(*) FROM receipts')
receipt_count = cursor.fetchone()[0]
print(f"Toplam Fiş: {receipt_count}")

cursor.execute('SELECT COUNT(*) FROM receipts WHERE is_cropped=1')
cropped = cursor.fetchone()[0]
print(f"Kırpılmış Fiş: {cropped}")

conn.close()
