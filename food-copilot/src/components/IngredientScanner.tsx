'use client'

import { useRef, useState, useCallback } from 'react'
import { X, Camera, Upload, Loader2, ImageIcon, RotateCcw, Zap } from 'lucide-react'

interface IngredientScannerProps {
  onScan: (text: string) => void
  onClose: () => void
}

export default function IngredientScanner({ onScan, onClose }: IngredientScannerProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStage, setProcessingStage] = useState<'preprocessing' | 'recognizing'>('preprocessing')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [isVideoReady, setIsVideoReady] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startCamera = async () => {
    try {
      // Check if running in browser
      if (typeof window === 'undefined') {
        setError('Camera access only available in browser')
        return
      }

      // Check for secure context (HTTPS or localhost)
      if (!window.isSecureContext) {
        setError('Camera requires HTTPS. Your Vercel deployment should provide this automatically.')
        return
      }

      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // iOS Safari specific check - camera might still work
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        if (isIOS) {
          setError('Camera access may require Safari browser on iOS. Try uploading a photo instead, or use Safari if you\'re using a different browser.')
        } else {
          setError('Camera API not available. Please use a modern browser with HTTPS, or try uploading a photo instead.')
        }
        return
      }

      // Check permission status first if available (not supported on all browsers)
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName })
          if (permissionStatus.state === 'denied') {
            setError('Camera permission was previously denied. Please enable camera access in your browser settings:\n\n• iOS Safari: Settings → Safari → Camera\n• Chrome: Click the lock icon in the address bar → Site Settings → Camera\n• Android: Settings → Apps → Browser → Permissions → Camera')
            return
          }
        } catch {
          // Permission API not supported, continue anyway
        }
      }

      // Try with ideal constraints first
      let stream: MediaStream | null = null
      const constraints = [
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
        { video: { facingMode: 'environment' } },
        { video: { facingMode: 'user' } },
        { video: true }
      ]

      for (const constraint of constraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraint)
          break
        } catch (e) {
          console.log('Constraint failed:', constraint, e)
          continue
        }
      }

      if (!stream) {
        throw new Error('Could not start camera with any settings')
      }
      
      if (videoRef.current) {
        const video = videoRef.current
        video.srcObject = stream
        streamRef.current = stream
        
        // Set up video ready detection
        const handleCanPlay = () => {
          console.log('Video can play, dimensions:', video.videoWidth, 'x', video.videoHeight)
          setIsVideoReady(true)
        }
        
        video.addEventListener('canplay', handleCanPlay)
        video.addEventListener('playing', handleCanPlay)
        
        // Wait for video to be ready before showing
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.log('Video timeout, readyState:', video.readyState)
            // Even on timeout, try to continue if video seems to be working
            if (video.readyState >= 2) {
              setIsVideoReady(true)
              resolve()
            } else {
              reject(new Error('Video load timeout'))
            }
          }, 10000)
          
          video.onloadedmetadata = () => {
            console.log('Video metadata loaded:', video.videoWidth, 'x', video.videoHeight)
            clearTimeout(timeout)
            // On mobile, play() might fail silently or need user interaction
            video.play()
              .then(() => {
                console.log('Video playing')
                setIsVideoReady(true)
                resolve()
              })
              .catch((playError) => {
                console.warn('Video autoplay failed:', playError)
                // Still resolve - video might work with user interaction
                setIsVideoReady(true)
                resolve()
              })
          }
          
          video.onerror = (e) => {
            clearTimeout(timeout)
            reject(new Error('Video stream error'))
          }
        })
        
        setIsCameraActive(true)
        setError(null)
      }
    } catch (err: any) {
      console.error('Camera error:', err)
      let errorMessage = 'Could not access camera. '
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isAndroid = /Android/.test(navigator.userAgent)
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        if (isIOS) {
          errorMessage = 'Camera permission denied.\n\nTo enable:\n1. Open Settings app\n2. Scroll to Safari (or your browser)\n3. Enable Camera access\n4. Return here and try again\n\nOr simply upload a photo instead!'
        } else if (isAndroid) {
          errorMessage = 'Camera permission denied.\n\nTo enable:\n1. Tap the lock icon in the address bar\n2. Tap "Permissions"\n3. Enable Camera\n4. Refresh the page\n\nOr simply upload a photo instead!'
        } else {
          errorMessage = 'Camera permission denied. Click the camera icon in your browser\'s address bar to enable access, or upload a photo instead.'
        }
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera found on this device. Please upload a photo instead.'
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Camera is in use by another app. Close other apps (especially video call apps) and try again, or upload a photo instead.'
      } else if (err.name === 'SecurityError') {
        errorMessage = 'Camera blocked by browser security. Make sure you\'re using HTTPS. Try uploading a photo instead.'
      } else if (err.name === 'AbortError') {
        errorMessage = 'Camera initialization was interrupted. Please try again.'
      } else if (err.message?.includes('timeout')) {
        errorMessage = 'Camera took too long to start. Please try again or upload a photo instead.'
      } else {
        errorMessage = `Camera error: ${err.message || 'Unknown error'}. Try uploading a photo instead.`
      }
      
      setError(errorMessage)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsCameraActive(false)
    setIsVideoReady(false)
  }

  const capturePhoto = async () => {
    try {
      console.log('Capture started')
      
      if (!videoRef.current) {
        setError('Camera not initialized. Please try again.')
        return
      }
      
      const video = videoRef.current
      
      // Log video state for debugging
      console.log('Video state:', {
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        paused: video.paused,
        ended: video.ended
      })
      
      // Check if video is actually playing and has dimensions
      if (video.readyState < 2) {
        setError('Camera is still loading. Please wait a moment and try again.')
        return
      }
      
      // Get dimensions - use natural dimensions or fallback to display dimensions
      let width = video.videoWidth || video.clientWidth || 640
      let height = video.videoHeight || video.clientHeight || 480
      
      if (width === 0 || height === 0) {
        // Last resort: use fixed dimensions
        width = 640
        height = 480
      }
      
      console.log('Using dimensions:', width, 'x', height)
      
      // Create a new canvas for capture (don't rely on ref)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setError('Could not create capture context. Please try uploading a photo instead.')
        return
      }
      
      // Draw the video frame
      ctx.drawImage(video, 0, 0, width, height)
      
      // Get the image data
      let imageData: string
      try {
        imageData = canvas.toDataURL('image/jpeg', 0.85)
      } catch (e) {
        // Try PNG if JPEG fails
        console.warn('JPEG failed, trying PNG:', e)
        imageData = canvas.toDataURL('image/png')
      }
      
      console.log('Image captured, length:', imageData.length)
      
      // Validate the captured image (should be more than just the header)
      if (!imageData || imageData.length < 1000) {
        setError('Captured image appears to be empty. Please ensure the camera is working and try again.')
        return
      }
      
      setCapturedImage(imageData)
      setError(null)
      stopCamera()
      
    } catch (err: any) {
      console.error('Capture error:', err)
      setError(`Capture failed: ${err.message || 'Unknown error'}. Please try uploading a photo instead.`)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setCapturedImage(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const processImage = async () => {
    if (!capturedImage) return
    
    setIsProcessing(true)
    setProgress(0)
    setProcessingStage('preprocessing')
    setError(null)
    
    try {
      // Preprocess image for better OCR results
      const preprocessedImage = await preprocessImageForOCR(capturedImage)
      
      setProcessingStage('recognizing')
      setProgress(5)
      
      // Dynamic import Tesseract.js
      const Tesseract = await import('tesseract.js')
      
      const result = await Tesseract.recognize(
        preprocessedImage,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setProgress(5 + Math.round(m.progress * 95))
            }
          }
        }
      )
      
      const text = result.data.text.trim()
      
      if (text.length < 10) {
        setError('Could not read text clearly. Try taking another photo with better lighting and make sure the text is in focus.')
        setIsProcessing(false)
        return
      }
      
      // Clean up the text - remove excessive whitespace and common OCR errors
      const cleanedText = text
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[|]/g, 'I') // Common OCR error
        .replace(/[0O]/g, (match) => match) // Keep as is for now
        .trim()
      
      onScan(cleanedText)
      onClose()
      
    } catch (err) {
      console.error('OCR error:', err)
      setError('Failed to process image. Please try again with a clearer photo.')
    }
    
    setIsProcessing(false)
  }

  // Preprocess image to improve OCR accuracy
  const preprocessImageForOCR = (imageData: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          resolve(imageData)
          return
        }
        
        // Scale up small images for better OCR
        const scale = Math.max(1, 1500 / Math.max(img.width, img.height))
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        
        // Draw scaled image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        // Get image data for processing
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imgData.data
        
        // Apply contrast enhancement and convert to grayscale
        for (let i = 0; i < data.length; i += 4) {
          // Convert to grayscale
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
          
          // Apply contrast enhancement
          const contrast = 1.5 // Increase contrast
          const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255))
          const enhanced = factor * (gray - 128) + 128
          
          // Apply threshold for sharper text
          const threshold = enhanced > 140 ? 255 : enhanced > 80 ? enhanced : 0
          
          data[i] = threshold     // R
          data[i + 1] = threshold // G
          data[i + 2] = threshold // B
          // Alpha stays the same
        }
        
        ctx.putImageData(imgData, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      }
      img.src = imageData
    })
  }

  const resetCapture = () => {
    setCapturedImage(null)
    setError(null)
    setProgress(0)
  }

  // Cleanup on unmount
  const handleClose = useCallback(() => {
    stopCamera()
    onClose()
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white border-b border-white/10">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5" />
          <span className="font-medium">Scan Ingredients</span>
        </div>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-auto">
        {!capturedImage && !isCameraActive && (
          <div className="w-full max-w-md space-y-4">
            <div className="text-center text-white mb-8">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <ImageIcon className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Scan Ingredient List</h2>
              <p className="text-white/60 text-sm">
                Take a photo of the ingredient list on the package, 
                and I'll analyze what's in it
              </p>
            </div>

            <button
              onClick={startCamera}
              className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-medium flex items-center justify-center gap-3 hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/20"
            >
              <Camera className="w-5 h-5" />
              Open Camera
            </button>

            {error && (
              <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm whitespace-pre-line">
                {error}
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/20"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-black text-white/40">or</span>
              </div>
            </div>

            {/* Native camera capture - more reliable on mobile */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full py-4 px-6 bg-white/10 text-white rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-white/20 transition-colors border border-white/10"
            >
              <Camera className="w-5 h-5" />
              Take Photo (Native Camera)
            </button>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/20"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-black text-white/40">or</span>
              </div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 px-6 bg-white/10 text-white rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-white/20 transition-colors border border-white/10"
            >
              <Upload className="w-5 h-5" />
              Upload from Gallery
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Camera view */}
        {isCameraActive && !capturedImage && (
          <div className="w-full max-w-md">
            <div className="relative rounded-2xl overflow-hidden bg-gray-900 min-h-[300px]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                webkit-playsinline="true"
                className="w-full h-full object-cover"
                style={{ minHeight: '300px', transform: 'scaleX(1)' }}
              />
              
              {/* Loading overlay */}
              {!isVideoReady && (
                <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                  <div className="text-center text-white">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-white/60">Starting camera...</p>
                  </div>
                </div>
              )}
              
              {/* Capture guide */}
              {isVideoReady && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-4 border-2 border-dashed border-white/30 rounded-xl flex items-center justify-center">
                    <p className="text-white/50 text-sm bg-black/50 px-3 py-1 rounded-full">
                      Position ingredient list here
                    </p>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm whitespace-pre-line">
                {error}
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { stopCamera(); setError(null); }}
                className="flex-1 py-3 px-4 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                disabled={!isVideoReady}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVideoReady ? (
                  <>
                    <Camera className="w-5 h-5" />
                    Capture
                  </>
                ) : (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading...
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Captured image preview */}
        {capturedImage && (
          <div className="w-full max-w-md">
            <div className="relative rounded-2xl overflow-hidden bg-gray-900">
              <img 
                src={capturedImage} 
                alt="Captured ingredients" 
                className="w-full"
              />
              
              {isProcessing && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <div className="text-center text-white">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
                    <p className="font-medium">
                      {processingStage === 'preprocessing' 
                        ? 'Enhancing image...' 
                        : 'Reading ingredients...'}
                    </p>
                    <div className="flex items-center gap-2 justify-center mt-2 text-emerald-400 text-sm">
                      <Zap className="w-4 h-4" />
                      <span>
                        {processingStage === 'preprocessing' 
                          ? 'Optimizing for text detection' 
                          : 'Tesseract OCR processing'}
                      </span>
                    </div>
                    <div className="w-48 h-2 bg-white/20 rounded-full mt-3 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-white/60 text-sm mt-2">{progress}%</p>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={resetCapture}
                disabled={isProcessing}
                className="flex-1 py-3 px-4 bg-white/10 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-5 h-5" />
                Retake
              </button>
              <button
                onClick={processImage}
                disabled={isProcessing}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Analyze'
                )}
              </button>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Instructions */}
      <div className="p-4 text-center text-white/50 text-xs border-t border-white/10">
        <p>For best results, ensure good lighting and hold the camera steady</p>
      </div>
    </div>
  )
}
