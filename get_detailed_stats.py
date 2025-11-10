import sqlite3
import json

conn = sqlite3.connect('backend/ocr_test.db')
cursor = conn.cursor()

print("=== DETAYLI MODEL İSTATİSTİKLERİ ===\n")

# Prompt testlerinden model bazlı doğruluk
print("1. PROMPT TESTLERİ - MODEL BAZLI DOĞRULUK")
print("-" * 60)
cursor.execute('''
    SELECT 
        model_name,
        label,
        COUNT(*) as count
    FROM prompt_tests
    WHERE label IS NOT NULL AND model_name IS NOT NULL
    GROUP BY model_name, label
    ORDER BY model_name, label
''')

model_stats = {}
for row in cursor.fetchall():
    model, label, count = row
    if model not in model_stats:
        model_stats[model] = {'correct': 0, 'incorrect': 0, 'partial': 0, 'total': 0}
    model_stats[model][label] = count
    model_stats[model]['total'] += count

for model, stats in model_stats.items():
    total = stats['total']
    correct = stats['correct']
    incorrect = stats['incorrect']
    partial = stats['partial']
    
    accuracy = (correct / total * 100) if total > 0 else 0
    
    print(f"\n{model}:")
    print(f"  Toplam Test: {total}")
    print(f"  ✅ Doğru: {correct} ({correct/total*100:.1f}%)")
    print(f"  ⚠️ Kısmi: {partial} ({partial/total*100:.1f}%)")
    print(f"  ❌ Yanlış: {incorrect} ({incorrect/total*100:.1f}%)")
    print(f"  📊 Başarı Oranı: {accuracy:.1f}%")

# Model evaluation tablosundan
print("\n\n2. MODEL EVALUATIONS - MANUEL DEĞERLENDİRME")
print("-" * 60)
cursor.execute('''
    SELECT 
        model_name,
        is_correct,
        COUNT(*) as count
    FROM model_evaluations
    GROUP BY model_name, is_correct
    ORDER BY model_name
''')

eval_stats = {}
for row in cursor.fetchall():
    model, is_correct, count = row
    if model not in eval_stats:
        eval_stats[model] = {'correct': 0, 'incorrect': 0, 'total': 0}
    if is_correct:
        eval_stats[model]['correct'] = count
    else:
        eval_stats[model]['incorrect'] = count
    eval_stats[model]['total'] += count

for model, stats in eval_stats.items():
    total = stats['total']
    correct = stats['correct']
    accuracy = (correct / total * 100) if total > 0 else 0
    print(f"\n{model}:")
    print(f"  Toplam: {total}")
    print(f"  Doğru: {correct}")
    print(f"  Başarı: {accuracy:.1f}%")

# Hata tipi dağılımı
print("\n\n3. HATA TİPİ DAĞILIMI (Prompt Tests)")
print("-" * 60)
cursor.execute('''
    SELECT 
        model_name,
        error_type,
        COUNT(*) as count
    FROM prompt_tests
    WHERE error_type IS NOT NULL AND label = 'incorrect'
    GROUP BY model_name, error_type
    ORDER BY model_name, error_type
''')

print("\nYanlış olan testlerde hata tipleri:")
for row in cursor.fetchall():
    model, error_type, count = row
    print(f"  {model} - {error_type}: {count}")

# En çok test edilen promptlar
print("\n\n4. EN ÇOK KULLANILAN PROMPT VERSİYONLARI")
print("-" * 60)
cursor.execute('''
    SELECT 
        model_name,
        prompt_version,
        COUNT(*) as count,
        SUM(CASE WHEN label = 'correct' THEN 1 ELSE 0 END) as correct_count
    FROM prompt_tests
    WHERE prompt_version IS NOT NULL
    GROUP BY model_name, prompt_version
    HAVING count > 5
    ORDER BY model_name, count DESC
''')

for row in cursor.fetchall():
    model, version, total, correct = row
    accuracy = (correct / total * 100) if total > 0 else 0
    print(f"{model} - Prompt v{version}: {correct}/{total} doğru ({accuracy:.1f}%)")

conn.close()
