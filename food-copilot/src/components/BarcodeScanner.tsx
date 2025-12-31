'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Camera, RefreshCw } from 'lucide-react'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [hasScanned, setHasScanned] = useState(false)
  const html5QrCodeRef = useRef<any>(null)
  const mountedRef = useRef(true)

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState()
        // State 2 = SCANNING, State 3 = PAUSED
        if (state === 2 || state === 3) {
          await html5QrCodeRef.current.stop()
        }
      } catch (err) {
        console.log('Scanner stop error (non-critical):', err)
      }
      html5QrCodeRef.current = null
    }
  }, [])

  const handleClose = useCallback(async () => {
    await stopScanner()
    onClose()
  }, [stopScanner, onClose])

  useEffect(() => {
    mountedRef.current = true
    let scannerInitialized = false

    const initScanner = async () => {
      try {
        // Check if running in browser
        if (typeof window === 'undefined') {
          setError('Scanner only available in browser')
          setIsInitializing(false)
          return
        }

        // Check for secure context (HTTPS or localhost)
        if (!window.isSecureContext) {
          setError('Camera requires HTTPS. Please deploy to Vercel or use localhost.')
          setIsInitializing(false)
          return
        }

        // Check if mediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('Camera API not available. Please use a modern browser.')
          setIsInitializing(false)
          return
        }

        // Request camera permission first
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          // Stop the test stream immediately
          stream.getTracks().forEach(track => track.stop())
        } catch (permErr: any) {
          let errorMessage = 'Camera access denied. '
          if (permErr.name === 'NotAllowedError') {
            errorMessage = 'Camera permission denied. Please allow camera access in browser settings.'
          } else if (permErr.name === 'NotFoundError') {
            errorMessage = 'No camera found on this device.'
          } else if (permErr.name === 'NotReadableError') {
            errorMessage = 'Camera is being used by another application.'
          }
          setError(errorMessage)
          setIsInitializing(false)
          return
        }

        // Dynamic import to avoid SSR issues
        const { Html5Qrcode } = await import('html5-qrcode')
        
        if (!mountedRef.current || !scannerRef.current) return

        const scannerId = 'barcode-scanner-' + Date.now()
        
        // Create scanner element
        const scannerDiv = document.createElement('div')
        scannerDiv.id = scannerId
        scannerRef.current.innerHTML = '' // Clear any existing content
        scannerRef.current.appendChild(scannerDiv)

        const html5QrCode = new Html5Qrcode(scannerId)
        html5QrCodeRef.current = html5QrCode
        scannerInitialized = true

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.777778,
          disableFlip: false,
        }

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (hasScanned) return // Prevent multiple scans
            setHasScanned(true)
            
            // Vibrate on successful scan
            if (navigator.vibrate) {
              navigator.vibrate(200)
            }
            
            // Stop scanner and call callback
            stopScanner().then(() => {
              onScan(decodedText)
              onClose()
            })
          },
          () => {} // Ignore scan failures (normal during scanning)
        )

        if (mountedRef.current) {
          setIsInitializing(false)
        }
      } catch (err: any) {
        console.error('Scanner init error:', err)
        
        let errorMessage = 'Could not start scanner. '
        
        if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
          errorMessage = 'Camera permission denied. Please allow camera access and try again.'
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'No camera found on this device.'
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Camera is in use by another app. Please close other apps using the camera.'
        } else if (err.name === 'OverconstrainedError') {
          errorMessage = 'Camera does not meet requirements. Trying alternative...'
        } else if (err.message?.includes('No MultiFormat Readers')) {
          errorMessage = 'Scanner library failed to load. Please refresh the page.'
        } else {
          errorMessage += err.message || 'Please refresh and try again.'
        }
        
        if (mountedRef.current) {
          setError(errorMessage)
          setIsInitializing(false)
        }
      }
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initScanner, 100)

    return () => {
      mountedRef.current = false
      clearTimeout(timer)
      if (scannerInitialized) {
        stopScanner()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const retry = async () => {
    setError(null)
    setIsInitializing(true)
    setHasScanned(false)
    await stopScanner()
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5" />
          <span className="font-medium">Scan Barcode</span>
        </div>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Close scanner"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Scanner area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md">
          {isInitializing && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-2xl z-10">
              <div className="text-center text-white">
                <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-3"></div>
                <p>Starting camera...</p>
                <p className="text-sm text-gray-400 mt-1">Please allow camera access if prompted</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-2xl p-6 z-10">
              <div className="text-center text-white">
                <div className="text-4xl mb-3">📷</div>
                <p className="text-red-400 font-medium mb-2">Camera Error</p>
                <p className="text-gray-300 text-sm mb-4">{error}</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={retry}
                    className="px-4 py-2 bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          <div 
            ref={scannerRef} 
            className="rounded-2xl overflow-hidden bg-gray-900"
            style={{ minHeight: '300px' }}
          />

          {/* Scanning guide overlay */}
          {!error && !isInitializing && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="border-2 border-white/50 rounded-lg w-64 h-24 relative animate-pulse">
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400"></div>
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400"></div>
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400"></div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400"></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="p-6 text-center text-white/70 text-sm">
        <p>Position the barcode within the frame</p>
        <p className="text-white/40 mt-1">Supports EAN, UPC, QR codes and more</p>
      </div>
    </div>
  )
}
