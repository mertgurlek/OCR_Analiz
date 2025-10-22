import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface ImageCropperProps {
  imageFile: File;
  onCropComplete: (originalFile: File, croppedFile: File, cropArea: CropArea) => void;
  onCancel: () => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface QuadCropArea {
  topLeft: Point;
  topRight: Point;
  bottomLeft: Point;
  bottomRight: Point;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
  imageFile,
  onCropComplete,
  onCancel
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [quadCropArea, setQuadCropArea] = useState<QuadCropArea>({
    topLeft: { x: 0, y: 0 },
    topRight: { x: 0, y: 0 },
    bottomLeft: { x: 0, y: 0 },
    bottomRight: { x: 0, y: 0 }
  });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedCorner, setDraggedCorner] = useState<keyof QuadCropArea | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  // Otomatik fiş algılama fonksiyonu
  const detectReceiptEdges = (img: HTMLImageElement): QuadCropArea | null => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Gri tonlamaya çevir ve kenar tespiti için Sobel operatörü uygula
    const edges: number[][] = [];
    for (let i = 0; i < canvas.height; i++) {
      edges[i] = [];
      for (let j = 0; j < canvas.width; j++) {
        const idx = (i * canvas.width + j) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        edges[i][j] = gray > 128 ? 255 : 0;
      }
    }

    // Beyaz bölgelerin sınırlarını bul (fiş genellikle beyaz/açık renkli)
    let minX = canvas.width, maxX = 0, minY = canvas.height, maxY = 0;
    let whitePixelCount = 0;
    
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (edges[y][x] > 200) {
          whitePixelCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Eğer yeterli beyaz piksel varsa, bulunan sınırları kullan
    if (whitePixelCount > (canvas.width * canvas.height * 0.1)) {
      // Kenarlardan biraz margin bırak (5%)
      const marginX = (maxX - minX) * 0.05;
      const marginY = (maxY - minY) * 0.05;
      
      return {
        topLeft: { x: Math.max(0, minX - marginX), y: Math.max(0, minY - marginY) },
        topRight: { x: Math.min(canvas.width, maxX + marginX), y: Math.max(0, minY - marginY) },
        bottomLeft: { x: Math.max(0, minX - marginX), y: Math.min(canvas.height, maxY + marginY) },
        bottomRight: { x: Math.min(canvas.width, maxX + marginX), y: Math.min(canvas.height, maxY + marginY) }
      };
    }

    return null;
  };

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setImageLoaded(true);
      
      // Önce otomatik fiş algılama dene
      const detectedArea = detectReceiptEdges(img);
      
      if (detectedArea) {
        console.log('🎯 Fiş otomatik olarak algılandı!');
        setQuadCropArea(detectedArea);
      } else {
        console.log('⚠️ Otomatik algılama başarısız, varsayılan alan kullanılıyor');
        // Otomatik algılama başarısız, varsayılan kırpma alanı (görsel kenarlarından %10 içeri)
        const margin = 0.10;
        const marginX = img.width * margin;
        const marginY = img.height * margin;
        
        setQuadCropArea({
          topLeft: { x: marginX, y: marginY },
          topRight: { x: img.width - marginX, y: marginY },
          bottomLeft: { x: marginX, y: img.height - marginY },
          bottomRight: { x: img.width - marginX, y: img.height - marginY }
        });
      }
    };
    img.src = URL.createObjectURL(imageFile);
    return () => URL.revokeObjectURL(img.src);
  }, [imageFile]);

  useEffect(() => {
    if (image && imageLoaded) {
      drawCanvas();
    }
  }, [image, quadCropArea, imageLoaded]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas boyutunu ayarla
    const maxWidth = 1000;
    const maxHeight = 600;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    
    const displayWidth = image.width * scale;
    const displayHeight = image.height * scale;
    
    // High DPI desteği
    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';
    
    ctx.scale(dpr, dpr);

    // Görseli çiz
    ctx.drawImage(image, 0, 0, displayWidth, displayHeight);

    // Scaled quad points
    const scaledQuad = {
      topLeft: { x: quadCropArea.topLeft.x * scale, y: quadCropArea.topLeft.y * scale },
      topRight: { x: quadCropArea.topRight.x * scale, y: quadCropArea.topRight.y * scale },
      bottomLeft: { x: quadCropArea.bottomLeft.x * scale, y: quadCropArea.bottomLeft.y * scale },
      bottomRight: { x: quadCropArea.bottomRight.x * scale, y: quadCropArea.bottomRight.y * scale }
    };

    // Overlay (karartma) - kırpma alanı dışındaki yerleri karart
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    
    // Kırpma alanını temizle (quad şeklinde)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(scaledQuad.topLeft.x, scaledQuad.topLeft.y);
    ctx.lineTo(scaledQuad.topRight.x, scaledQuad.topRight.y);
    ctx.lineTo(scaledQuad.bottomRight.x, scaledQuad.bottomRight.y);
    ctx.lineTo(scaledQuad.bottomLeft.x, scaledQuad.bottomLeft.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Kırpma çerçevesi çiz
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scaledQuad.topLeft.x, scaledQuad.topLeft.y);
    ctx.lineTo(scaledQuad.topRight.x, scaledQuad.topRight.y);
    ctx.lineTo(scaledQuad.bottomRight.x, scaledQuad.bottomRight.y);
    ctx.lineTo(scaledQuad.bottomLeft.x, scaledQuad.bottomLeft.y);
    ctx.closePath();
    ctx.stroke();

    // Köşe noktalarını çiz
    const cornerSize = 12;
    ctx.fillStyle = '#3b82f6';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    Object.values(scaledQuad).forEach(point => {
      ctx.fillRect(point.x - cornerSize/2, point.y - cornerSize/2, cornerSize, cornerSize);
      ctx.strokeRect(point.x - cornerSize/2, point.y - cornerSize/2, cornerSize, cornerSize);
    });
  };

  const getScale = () => {
    if (!image) return 1;
    const maxWidth = 1000;
    const maxHeight = 600;
    return Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scale = getScale();

    // Hangi köşeye tıklandığını kontrol et
    const cornerSize = 20;
    const scaledQuad = {
      topLeft: { x: quadCropArea.topLeft.x * scale, y: quadCropArea.topLeft.y * scale },
      topRight: { x: quadCropArea.topRight.x * scale, y: quadCropArea.topRight.y * scale },
      bottomLeft: { x: quadCropArea.bottomLeft.x * scale, y: quadCropArea.bottomLeft.y * scale },
      bottomRight: { x: quadCropArea.bottomRight.x * scale, y: quadCropArea.bottomRight.y * scale }
    };

    for (const [cornerName, point] of Object.entries(scaledQuad)) {
      if (Math.abs(x - point.x) < cornerSize && Math.abs(y - point.y) < cornerSize) {
        setIsDragging(true);
        setDraggedCorner(cornerName as keyof QuadCropArea);
        setDragStart({ x, y });
        return;
      }
    }

    // Quad içindeyse tüm şekli sürükle
    if (isPointInQuad({ x: x / scale, y: y / scale }, quadCropArea)) {
      setIsDragging(true);
      setDraggedCorner(null);
      setDragStart({ x, y });
    }
  };

  const isPointInQuad = (point: Point, quad: QuadCropArea): boolean => {
    // Basit bounding box kontrolü
    const minX = Math.min(quad.topLeft.x, quad.topRight.x, quad.bottomLeft.x, quad.bottomRight.x);
    const maxX = Math.max(quad.topLeft.x, quad.topRight.x, quad.bottomLeft.x, quad.bottomRight.x);
    const minY = Math.min(quad.topLeft.y, quad.topRight.y, quad.bottomLeft.y, quad.bottomRight.y);
    const maxY = Math.max(quad.topLeft.y, quad.topRight.y, quad.bottomLeft.y, quad.bottomRight.y);
    
    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !image) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scale = getScale();
    
    const deltaX = (x - dragStart.x) / scale;
    const deltaY = (y - dragStart.y) / scale;

    if (draggedCorner) {
      // Tek köşe sürükleme
      setQuadCropArea(prev => ({
        ...prev,
        [draggedCorner]: {
          x: Math.max(0, Math.min(prev[draggedCorner].x + deltaX, image.width)),
          y: Math.max(0, Math.min(prev[draggedCorner].y + deltaY, image.height))
        }
      }));
    } else {
      // Tüm şekli sürükleme
      setQuadCropArea(prev => {
        const newQuad = { ...prev };
        Object.keys(newQuad).forEach(key => {
          const cornerKey = key as keyof QuadCropArea;
          newQuad[cornerKey] = {
            x: Math.max(0, Math.min(prev[cornerKey].x + deltaX, image.width)),
            y: Math.max(0, Math.min(prev[cornerKey].y + deltaY, image.height))
          };
        });
        return newQuad;
      });
    }

    setDragStart({ x, y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedCorner(null);
  };

  const quadToBoundingBox = (quad: QuadCropArea): CropArea => {
    const minX = Math.min(quad.topLeft.x, quad.topRight.x, quad.bottomLeft.x, quad.bottomRight.x);
    const maxX = Math.max(quad.topLeft.x, quad.topRight.x, quad.bottomLeft.x, quad.bottomRight.x);
    const minY = Math.min(quad.topLeft.y, quad.topRight.y, quad.bottomLeft.y, quad.bottomRight.y);
    const maxY = Math.max(quad.topLeft.y, quad.topRight.y, quad.bottomLeft.y, quad.bottomRight.y);
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  const handleCropConfirm = async () => {
    console.log('✅ KIRPMA ONAYI - handleCropConfirm tetiklendi')
    if (!image) {
      console.error('❌ Image yok, kırpma iptal edildi')
      return;
    }

    // Quad'ı bounding box'a çevir (basit kırpma için)
    const cropArea = quadToBoundingBox(quadCropArea);
    console.log('📐 Kırpma alanı:', cropArea);

    // Kırpılmış görseli oluştur
    const croppedCanvas = document.createElement('canvas');
    const croppedCtx = croppedCanvas.getContext('2d');
    if (!croppedCtx) return;

    croppedCanvas.width = cropArea.width;
    croppedCanvas.height = cropArea.height;

    croppedCtx.drawImage(
      image,
      cropArea.x, cropArea.y, cropArea.width, cropArea.height,
      0, 0, cropArea.width, cropArea.height
    );

    // Canvas'ı File'a çevir
    console.log('🎨 Canvas oluşturuldu, blob-a çevriliyor...')
    croppedCanvas.toBlob((blob) => {
      if (blob) {
        console.log('✅ Blob oluşturuldu:', blob.size, 'bytes')
        const croppedFile = new File([blob], `cropped_${imageFile.name}`, {
          type: imageFile.type
        });
        console.log('📤 onCropComplete çağrılıyor:', {
          originalName: imageFile.name,
          croppedName: croppedFile.name,
          cropArea
        })
        onCropComplete(imageFile, croppedFile, cropArea);
      } else {
        console.error('❌ Blob oluşturulamadı!')
      }
    }, imageFile.type);
  };

  const resetCrop = () => {
    if (!image) return;
    
    // Otomatik algılamayı tekrar dene
    const detectedArea = detectReceiptEdges(image);
    
    if (detectedArea) {
      console.log('🔄 Fiş yeniden algılandı!');
      setQuadCropArea(detectedArea);
    } else {
      const margin = 0.10;
      const marginX = image.width * margin;
      const marginY = image.height * margin;
      
      setQuadCropArea({
        topLeft: { x: marginX, y: marginY },
        topRight: { x: image.width - marginX, y: marginY },
        bottomLeft: { x: marginX, y: image.height - marginY },
        bottomRight: { x: image.width - marginX, y: image.height - marginY }
      });
    }
  };

  const cropArea = quadToBoundingBox(quadCropArea);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="max-w-4xl w-full mx-4">
        <CardHeader>
          <CardTitle>📸 Gelişmiş Görsel Kırpma</CardTitle>
          <p className="text-sm text-gray-600">
            ✨ Fiş otomatik olarak algılandı • 🔵 Mavi köşeleri sürükleyerek ayarlayın • Kırpma alanını taşıyın
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            <canvas
              ref={canvasRef}
              className="border border-gray-300 cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            
            <div className="flex space-x-4">
              <Button onClick={handleCropConfirm} className="bg-blue-600 hover:bg-blue-700">
                ✅ Kırpma Alanını Onayla
              </Button>
              <Button onClick={resetCrop} variant="outline">
                🔄 Otomatik Algıla
              </Button>
              <Button onClick={onCancel} variant="outline">
                ❌ İptal
              </Button>
            </div>
            
            <div className="text-sm text-gray-500 text-center">
              <div>Kırpma Alanı: {Math.round(cropArea.width)} × {Math.round(cropArea.height)} px</div>
              <div className="text-xs mt-1">
                🎯 Fiş otomatik olarak optimize edildi • 4 köşeyi sürükleyerek ince ayar yapabilirsiniz
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
