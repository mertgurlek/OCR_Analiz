"""
OpenAI Vision direkt test - structured_data kontrolü
"""
import asyncio
import sys
import os

# Backend path ekle
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.accounting_service import AccountingService
from app.core.config import settings

async def test():
    # Mock OCR result (senin örneğindeki JSON)
    ocr_results = [
        {
            "model_name": "openai_vision",
            "text_content": "YÜZGEÇ...",  # Metin önemli değil
            "structured_data": {
                "metadata": {"source": "other", "ocrQualityScore": 0.95, "classification": "restaurant", "vatTreatment": "VAT included", "notes": ""},
                "document": {"merchantName": "YÜZGEÇ", "merchantVKN": "6241630069", "merchantTCKN": None, "address": "MÜSKEBİ MH.", "date": "16/08/2025", "time": "22:41", "receiptNo": "0009", "plate": None, "invoiceNo": None, "mersisNo": None},
                "items": [
                    {"description": "Büyük Su", "quantity": 1.0, "unitPrice": 154.55, "grossAmount": 170.0, "netAmount": 154.55, "vatRate": 10, "vatAmount": 15.45, "discountAmount": 0.0, "accountCode": "153", "itemType": "drink", "confidence": 1.0},
                    {"description": "Kalamar Tava", "quantity": 1.0, "unitPrice": 636.36, "grossAmount": 700.0, "netAmount": 636.36, "vatRate": 10, "vatAmount": 63.64, "discountAmount": 0.0, "accountCode": "153", "itemType": "food", "confidence": 1.0},
                    {"description": "Yüzgeç Salata", "quantity": 1.0, "unitPrice": 272.73, "grossAmount": 300.0, "netAmount": 272.73, "vatRate": 10, "vatAmount": 27.27, "discountAmount": 0.0, "accountCode": "153", "itemType": "food", "confidence": 1.0},
                ],
                "extraTaxes": [],
                "totals": {"vatBreakdown": [{"vatRate": 10, "taxBase": 2009.09, "vatAmount": 200.91}, {"vatRate": 20, "taxBase": 758.33, "vatAmount": 151.67}], "totalVat": 352.58, "totalAmount": 3000.0, "paymentAccountCode": "108", "currency": "TRY"},
                "paymentLines": [{"method": "credit_card", "amount": 3000.0, "accountCode": "108"}],
                "entryLines": [],
                "unprocessedLines": [],
                "validationFlags": [],
                "errorFlags": [],
                "stats": {"itemCount": 3, "parsedLines": 15, "unprocessedCount": 0}
            },
            "error": None
        }
    ]
    
    # Accounting service oluştur
    service = AccountingService(
        api_key=settings.OPENAI_API_KEY,
        gpt_model="gpt-4o-mini"
    )
    
    # Process et
    print("\n" + "="*50)
    print("🧪 OpenAI Vision Test Başlıyor...")
    print("="*50 + "\n")
    
    results = await service.extract_accounting_data_per_model(ocr_results)
    
    print("\n" + "="*50)
    print("📊 SONUÇLAR")
    print("="*50)
    
    for result in results:
        print(f"\n🤖 Model: {result['model_name']}")
        print(f"⏱️  İşlem Süresi: {result['processing_time_ms']:.0f}ms")
        print(f"💰 Maliyet: ${result['estimated_cost']:.6f}")
        
        acc_data = result['accounting_data']
        print(f"\n📋 Muhasebe Verisi:")
        print(f"   - Line Items: {len(acc_data.get('line_items', []))}")
        print(f"   - Subtotal: {acc_data.get('subtotal_gpt', 0):.2f} TL")
        print(f"   - Total VAT: {acc_data.get('total_vat_gpt', 0):.2f} TL")
        print(f"   - Grand Total: {acc_data.get('grand_total_gpt', 0):.2f} TL")
        
        if acc_data.get('line_items'):
            print(f"\n   Kalemler:")
            for idx, item in enumerate(acc_data['line_items'][:3], 1):
                print(f"   {idx}. {item.get('name', 'N/A')} - {item.get('total_price', 0):.2f} TL")

if __name__ == "__main__":
    asyncio.run(test())
