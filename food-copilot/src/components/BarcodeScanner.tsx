'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Camera, RefreshCw, Keyboard, AlertTriangle } from 'lucide-react'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [hasScanned, setHasScanned] = useState(false)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')
  const html5QrCodeRef = useRef<any>(null)
  const mountedRef = useRef(true)

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState?.()
        if (state === 2 || state === 3) {
          await html5QrCodeRef.current.stop()
        }
      } catch (err) {
        // Ignore stop errors
      }
      html5QrCodeRef.current = null
    }
  }, [])

  const handleClose = useCallback(async () => {
    await stopScanner()
    onClose()
  }, [stopScanner, onClose])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const barcode = manualBarcode.trim()
    if (barcode && /^\d{8,14}$/.test(barcode)) {
      onScan(barcode)
      onClose()
    }
  }

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
  }, [])  

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
                <div className="space-y-3">
                  <button
                    onClick={retry}
                    className="w-full px-4 py-3 bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                  </button>
                  <button
                    onClick={() => setShowManualInput(true)}
                    className="w-full px-4 py-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <Keyboard className="w-4 h-4" />
                    Enter Barcode Manually
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Manual input modal */}
          {showManualInput && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-2xl p-6 z-20">
              <form onSubmit={handleManualSubmit} className="w-full">
                <h3 className="text-white font-medium text-lg mb-4 text-center">Enter Barcode</h3>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 8-14 digit barcode"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-center text-xl tracking-widest placeholder:text-gray-500 focus:outline-none focus:border-emerald-500"
                  autoFocus
                  maxLength={14}
                />
                <p className="text-gray-400 text-xs text-center mt-2 mb-4">
                  Find the barcode number below the lines
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowManualInput(false)}
                    className="flex-1 px-4 py-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-white"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={!/^\d{8,14}$/.test(manualBarcode)}
                    className="flex-1 px-4 py-3 bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit
                  </button>
                </div>
              </form>
            </div>
          )}

          <div 
            ref={scannerRef} 
            className="rounded-2xl overflow-hidden bg-gray-900"
            style={{ minHeight: '300px' }}
          />

          {/* Scanning guide overlay */}
          {!error && !isInitializing && !showManualInput && (
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
        {!error && !isInitializing && (
          <button
            onClick={() => setShowManualInput(true)}
            className="mt-3 py-2 text-emerald-400 text-sm flex items-center justify-center gap-2 w-full"
          >
            <Keyboard className="w-4 h-4" />
            Can't scan? Enter manually
          </button>
        )}
      </div>
    </div>
  )
}
