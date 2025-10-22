"""
Schema Versiyonlama ve Dönüştürme Sistemi
Her prompt versiyonu için farklı schema parser'ları içerir
"""

import logging
from typing import Dict, Any, Callable, Optional
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class SchemaParser(ABC):
    """Base schema parser interface"""
    
    @abstractmethod
    def parse(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse edilecek veriyi standart formata çevirir"""
        pass
    
    @abstractmethod
    def get_version(self) -> str:
        """Schema versiyonunu döner"""
        pass


class SchemaV1Parser(SchemaParser):
    """
    Eski Schema Format (v1-v22)
    Flat yapı: vkn, company_name, line_items, vat_breakdown
    """
    
    def get_version(self) -> str:
        return "v1"
    
    def parse(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        V1 formatını V2 formatına çevirir
        """
        logger.info(f"📋 Parsing with Schema V1 (legacy format)")
        
        # V1 -> V2 dönüşümü
        v2_data = {
            "metadata": {
                "source": data.get("source", ""),
                "ocrQualityScore": 0.0,
                "classification": "unknown",
                "vatTreatment": "VAT included",
                "notes": ""
            },
            "document": {
                "merchantName": data.get("company_name"),
                "merchantVKN": data.get("vkn"),
                "merchantTCKN": None,
                "address": None,
                "date": data.get("date"),
                "time": None,
                "receiptNo": data.get("receipt_number"),
                "plate": data.get("plate"),
                "invoiceNo": None,
                "mersisNo": None
            },
            "items": [],
            "extraTaxes": [],
            "totals": {
                "vatBreakdown": [],
                "totalVat": data.get("total_vat"),
                "totalAmount": data.get("grand_total"),
                "paymentAccountCode": None,
                "currency": "TRY"
            },
            "paymentLines": [],
            "entryLines": [],
            "unprocessedLines": [],
            "validationFlags": [],
            "errorFlags": [],
            "stats": {
                "itemCount": 0,
                "parsedLines": 0,
                "unprocessedCount": 0
            }
        }
        
        # Line items -> items dönüşümü
        for item in data.get("line_items", []):
            v2_item = {
                "description": item.get("name", ""),
                "quantity": item.get("quantity"),
                "unitPrice": item.get("unit_price"),
                "grossAmount": item.get("total_price", 0.0),
                "netAmount": None,
                "vatRate": item.get("vat_rate"),
                "vatAmount": item.get("vat_amount"),
                "discountAmount": 0.0,
                "accountCode": None,
                "itemType": "unknown",
                "confidence": 0.0
            }
            v2_data["items"].append(v2_item)
        
        # VAT breakdown dönüşümü
        for vat in data.get("vat_breakdown", []):
            v2_vat = {
                "vatRate": vat.get("rate"),
                "taxBase": vat.get("base_amount"),
                "vatAmount": vat.get("vat_amount")
            }
            v2_data["totals"]["vatBreakdown"].append(v2_vat)
        
        # Payment method -> payment line
        if data.get("payment_method"):
            account_code = self._get_account_code(data.get("payment_method"))
            v2_data["paymentLines"].append({
                "method": data.get("payment_method", "").lower().replace(" ", "_"),
                "amount": data.get("grand_total", 0.0),
                "accountCode": account_code
            })
        
        v2_data["stats"]["itemCount"] = len(v2_data["items"])
        
        logger.info(f"✅ Converted V1 -> V2: {len(v2_data['items'])} items")
        return v2_data
    
    def _get_account_code(self, payment_method: str) -> str:
        """Ödeme yöntemine göre hesap kodu"""
        method = payment_method.upper()
        if "NAKİT" in method or "CASH" in method:
            return "100"
        elif "KREDİ" in method or "CARD" in method:
            return "108"
        elif "BANKA" in method or "EFT" in method or "TRANSFER" in method:
            return "102"
        return "100"


class SchemaV2Parser(SchemaParser):
    """
    Yeni Schema Format (v23+)
    Nested yapı: metadata, document, items, totals
    """
    
    def get_version(self) -> str:
        return "v2"
    
    def parse(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        V2 formatı zaten standart, direkt döner
        """
        logger.info(f"📋 Parsing with Schema V2 (current format)")
        
        # Validation ve default değerler
        if "metadata" not in data:
            data["metadata"] = {
                "source": "",
                "ocrQualityScore": 0.0,
                "classification": "unknown",
                "vatTreatment": "VAT included",
                "notes": ""
            }
        
        if "document" not in data:
            data["document"] = {}
        
        if "items" not in data:
            data["items"] = []
        
        # Items içinde null değer temizliği
        cleaned_items = []
        for item in data.get("items", []):
            if item and isinstance(item, dict):
                # Null veya empty string olan sayısal alanları 0 yap
                item.setdefault("quantity", 0)
                item.setdefault("unitPrice", 0)
                item.setdefault("grossAmount", 0)
                item.setdefault("netAmount", 0)
                item.setdefault("vatAmount", 0)
                item.setdefault("vatRate", 0)
                item.setdefault("discountAmount", 0)
                item.setdefault("confidence", 0.0)
                
                # String alanlar
                item.setdefault("description", "")
                item.setdefault("accountCode", None)
                item.setdefault("itemType", "unknown")
                
                cleaned_items.append(item)
        data["items"] = cleaned_items
        
        if "totals" not in data:
            data["totals"] = {
                "vatBreakdown": [],
                "totalVat": None,
                "totalAmount": None,
                "paymentAccountCode": None,
                "currency": "TRY"
            }
        
        # VAT breakdown temizliği
        if "vatBreakdown" in data["totals"]:
            cleaned_vat = []
            for vat in data["totals"]["vatBreakdown"]:
                if vat and isinstance(vat, dict):
                    vat.setdefault("vatRate", 0)
                    vat.setdefault("taxBase", 0)
                    vat.setdefault("vatAmount", 0)
                    cleaned_vat.append(vat)
            data["totals"]["vatBreakdown"] = cleaned_vat
        
        # Varsayılan liste alanları
        data.setdefault("extraTaxes", [])
        data.setdefault("paymentLines", [])
        data.setdefault("entryLines", [])
        data.setdefault("unprocessedLines", [])
        data.setdefault("validationFlags", [])
        data.setdefault("errorFlags", [])
        
        if "stats" not in data:
            data["stats"] = {
                "itemCount": len(data.get("items", [])),
                "parsedLines": 0,
                "unprocessedCount": 0
            }
        
        logger.info(f"✅ V2 parse complete: {len(data['items'])} items validated")
        return data


class SchemaRegistry:
    """
    Schema versiyonlarını yöneten merkezi registry
    """
    
    def __init__(self):
        self.parsers: Dict[str, SchemaParser] = {
            "v1": SchemaV1Parser(),
            "v2": SchemaV2Parser()
        }
        
        # Prompt version -> schema version mapping
        self.version_mapping = {
            # Eski versiyonlar (1-22) -> V1 schema
            **{i: "v1" for i in range(1, 23)},
            # Yeni versiyonlar (23+) -> V2 schema
            **{i: "v2" for i in range(23, 100)}
        }
    
    def get_parser(self, prompt_version: int) -> SchemaParser:
        """
        Prompt versiyonuna göre uygun parser'ı döner
        """
        schema_version = self.version_mapping.get(prompt_version, "v2")
        parser = self.parsers.get(schema_version)
        
        if not parser:
            logger.warning(f"⚠️ Unknown schema version: {schema_version}, using V2")
            return self.parsers["v2"]
        
        logger.info(f"🔧 Using parser: {parser.get_version()} for prompt v{prompt_version}")
        return parser
    
    def detect_schema_version(self, data: Dict[str, Any]) -> str:
        """
        JSON yapısına bakarak schema versiyonunu otomatik tespit eder
        """
        # V2 formatı kontrol et
        if "metadata" in data and "document" in data and "items" in data:
            return "v2"
        
        # V1 formatı kontrol et
        if "line_items" in data or "vkn" in data or "company_name" in data:
            return "v1"
        
        # Bilinmeyen format, en yeni versiyon kullan
        logger.warning("⚠️ Could not detect schema version, assuming V2")
        return "v2"
    
    def parse_with_auto_detection(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Schema versiyonunu otomatik tespit edip parse eder
        """
        schema_version = self.detect_schema_version(data)
        parser = self.parsers.get(schema_version, self.parsers["v2"])
        
        logger.info(f"🔍 Auto-detected schema: {schema_version}")
        return parser.parse(data)
    
    def register_parser(self, version: str, parser: SchemaParser):
        """
        Yeni bir parser ekler (gelecekte V3, V4 için)
        """
        self.parsers[version] = parser
        logger.info(f"✅ Registered new parser: {version}")


# Global singleton instance
_registry_instance: Optional[SchemaRegistry] = None


def get_schema_registry() -> SchemaRegistry:
    """
    Global schema registry instance'ını döner (singleton pattern)
    """
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = SchemaRegistry()
    return _registry_instance
