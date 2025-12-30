'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Camera, SwitchCamera } from 'lucide-react'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const html5QrCodeRef = useRef<any>(null)

  useEffect(() => {
    let mounted = true

    const initScanner = async () => {
      try {
        // Check if running in browser
        if (typeof window === 'undefined') {
          setError('Scanner only available in browser')
          setIsInitializing(false)
          return
        }

        // Check if mediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('Camera not supported. Please use HTTPS or localhost.')
          setIsInitializing(false)
          return
        }

        // Dynamic import to avoid SSR issues
        const { Html5Qrcode } = await import('html5-qrcode')
        
        if (!mounted || !scannerRef.current) return

        const scannerId = 'barcode-scanner'
        
        // Create scanner element if it doesn't exist
        if (!document.getElementById(scannerId)) {
          const scannerDiv = document.createElement('div')
          scannerDiv.id = scannerId
          scannerRef.current.appendChild(scannerDiv)
        }

        const html5QrCode = new Html5Qrcode(scannerId)
        html5QrCodeRef.current = html5QrCode

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.0,
          formatsToSupport: [
            0, // QR_CODE
            1, // AZTEC
            2, // CODABAR
            3, // CODE_39
            4, // CODE_93
            5, // CODE_128
            6, // DATA_MATRIX
            7, // MAXICODE
            8, // ITF
            9, // EAN_13
            10, // EAN_8
            11, // PDF_417
            12, // RSS_14
            13, // RSS_EXPANDED
            14, // UPC_A
            15, // UPC_E
            16, // UPC_EAN_EXTENSION
          ]
        }

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            // Vibrate on successful scan
            if (navigator.vibrate) {
              navigator.vibrate(200)
            }
            onScan(decodedText)
            html5QrCode.stop().catch(console.error)
            onClose()
          },
          () => {} // Ignore scan failures
        )

        setIsInitializing(false)
      } catch (err: any) {
        console.error('Scanner error:', err)
        
        let errorMessage = 'Could not access camera. '
        
        if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
          errorMessage += 'Please allow camera permissions in your browser.'
        } else if (err.name === 'NotFoundError') {
          errorMessage += 'No camera found.'
        } else if (err.name === 'NotReadableError') {
          errorMessage += 'Camera is in use by another app.'
        } else if (err.name === 'SecurityError' || err.message?.includes('secure')) {
          errorMessage += 'Requires HTTPS or localhost.'
        } else {
          errorMessage += err.message || 'Please check camera permissions.'
        }
        
        setError(errorMessage)
        setIsInitializing(false)
      }
    }

    initScanner()

    return () => {
      mounted = false
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(console.error)
      }
    }
  }, [onScan, onClose])

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5" />
          <span className="font-medium">Scan Barcode</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Scanner area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md">
          {isInitializing && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-2xl">
              <div className="text-center text-white">
                <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-3"></div>
                <p>Starting camera...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-2xl p-6">
              <div className="text-center text-white">
                <div className="text-red-400 mb-3">📷</div>
                <p className="text-red-300 mb-2">Camera Error</p>
                <p className="text-gray-400 text-sm">{error}</p>
                <button
                  onClick={onClose}
                  className="mt-4 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                >
                  Close
                </button>
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
              <div className="border-2 border-white/50 rounded-lg w-64 h-24 relative">
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-green-400"></div>
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-green-400"></div>
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-green-400"></div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-green-400"></div>
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
