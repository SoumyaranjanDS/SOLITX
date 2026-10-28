import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, Check, RotateCcw, Move } from 'lucide-react';

/**
 * ImageCropModal
 * 
 * Provides an interactive circular crop and resize modal for profile avatars (DP).
 * Features:
 * - Circular mask overlay showing exactly what will appear in the DP circle.
 * - Smooth drag-to-pan (mouse and touch friendly).
 * - Zoom slider and buttons (1x to 3x).
 * - Live mini-DP circle preview.
 * - High-resolution (512x512) canvas export into a standard File object.
 */
const ImageCropModal = ({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
  isUploading = false,
  uploadProgress = 0,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const containerRef = useRef(null);
  const imageRef = useRef(null);

  // Viewport & Circle diameter
  const CROP_SIZE = 260; // diameter of the crop circle in px

  // Reset transforms whenever a new image is loaded
  useEffect(() => {
    if (isOpen && imageSrc) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imageSrc]);

  // Handle image load to determine initial fitting scale
  const onImageLoaded = (e) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setImageSize({ width: naturalWidth, height: naturalHeight });

    // Fit image so shortest dimension fills the CROP_SIZE
    const minDim = Math.min(naturalWidth, naturalHeight);
    if (minDim > 0) {
      // Scale so that minimum dimension matches at least the crop size
      const initialScale = Math.max(1, CROP_SIZE / minDim);
      setScale(initialScale);
    }
  };

  // Mouse drag handlers
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch drag handlers for mobile devices
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  };

  const handleTouchMove = useCallback((e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.min(3, Math.max(0.8, Number((prev + delta).toFixed(2)))));
  };

  // Perform High-Res Canvas Crop
  const handleApplyCrop = () => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    // Circle center relative to container
    const circleCenterX = containerRect.width / 2;
    const circleCenterY = containerRect.height / 2;
    const circleRadius = CROP_SIZE / 2;

    // Image center relative to container:
    // The image has transform translate(position.x, position.y) scale(scale)
    // We compute the source coordinates on the natural image:
    const outputSize = 512;
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Smooth rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Current displayed dimensions of the image:
    const renderedWidth = img.width * scale;
    const renderedHeight = img.height * scale;

    // Image top-left in container coordinates:
    const imgLeftInContainer = (containerRect.width - renderedWidth) / 2 + position.x;
    const imgTopInContainer = (containerRect.height - renderedHeight) / 2 + position.y;

    // Circle top-left in container coordinates:
    const circleLeftInContainer = circleCenterX - circleRadius;
    const circleTopInContainer = circleCenterY - circleRadius;

    // Distance from image top-left to circle top-left in displayed pixels:
    const cropXDisplayed = circleLeftInContainer - imgLeftInContainer;
    const cropYDisplayed = circleTopInContainer - imgTopInContainer;

    // Convert displayed pixels to natural image pixels:
    const naturalRatio = img.naturalWidth / renderedWidth;
    const srcX = cropXDisplayed * naturalRatio;
    const srcY = cropYDisplayed * naturalRatio;
    const srcSize = CROP_SIZE * naturalRatio;

    // Draw cropped region to canvas
    ctx.drawImage(
      img,
      srcX,
      srcY,
      srcSize,
      srcSize,
      0,
      0,
      outputSize,
      outputSize
    );

    // Export as high-quality JPEG File
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `avatar_${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        const previewUrl = URL.createObjectURL(blob);
        onCropComplete(file, previewUrl);
      },
      'image/jpeg',
      0.92
    );
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        if (!isUploading) onClose();
      }}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-[440px] overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-[17px] text-[#0F1419]">
              Adjust profile picture
            </h3>
            <p className="text-[12px] text-gray-500">
              Drag to reposition • Zoom to fit
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-black transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewport Area */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onWheel={handleWheel}
          className="relative w-full h-[320px] bg-slate-950 overflow-hidden flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
        >
          {/* Underlying Image */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="To crop"
            onLoad={onImageLoaded}
            draggable={false}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.05s ease-out',
            }}
            className="max-w-none max-h-none pointer-events-none select-none"
          />

          {/* Circular Cutout Mask */}
          {/* Using huge boxShadow to darken everything outside the circle */}
          <div
            className="absolute rounded-full border-2 border-white/90 pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
            style={{
              width: `${CROP_SIZE}px`,
              height: `${CROP_SIZE}px`,
            }}
          >
            {/* Subtle crosshair guide lines */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <div className="w-full h-[1px] bg-white" />
              <div className="h-full w-[1px] bg-white absolute" />
            </div>
          </div>

          {/* Uploading Overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white z-30">
              <div className="w-8 h-8 rounded-full border-2 border-violet-400/20 border-t-violet-400 animate-spin mb-2" />
              <span className="text-[13px] font-bold">Uploading & saving... {uploadProgress}%</span>
            </div>
          )}

          {/* Instruction Pill */}
          {!isUploading && (
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-white/90 text-[11px] font-medium flex items-center gap-1.5 pointer-events-none">
              <Move size={12} />
              <span>Drag to move</span>
            </div>
          )}
        </div>

        {/* Controls Toolbar */}
        <div className="px-6 py-4 space-y-4 bg-gray-50/50 border-t border-gray-100">
          {/* Zoom Slider */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.8, Number((s - 0.1).toFixed(2))))}
              className="p-1.5 rounded-full hover:bg-gray-200 text-gray-600 transition-colors"
              title="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
            <input
              type="range"
              min="0.8"
              max="3"
              step="0.02"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#7C3AED]"
            />
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(3, Number((s + 0.1).toFixed(2))))}
              className="p-1.5 rounded-full hover:bg-gray-200 text-gray-600 transition-colors"
              title="Zoom in"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setScale(1);
                setPosition({ x: 0, y: 0 });
              }}
              className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 hover:text-black transition-colors"
              title="Reset position and zoom"
            >
              <RotateCcw size={15} />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold text-[13px] rounded-full transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              disabled={isUploading}
              className="px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white font-bold text-[13px] rounded-full shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Check size={16} strokeWidth={2.5} />
              <span>Apply & Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
