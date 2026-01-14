'use client';

import { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/browser';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export default function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanningFeedback, setScanningFeedback] = useState<string | null>(null);
  const [isActivelyScanning, setIsActivelyScanning] = useState(false);
  const [manualRestartFeedback, setManualRestartFeedback] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<string>('');
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingScanRef = useRef<boolean>(false);
  const activeScanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recentErrorCountRef = useRef<number>(0);
  const errorCountWindowRef = useRef<number>(Date.now());
  const autoRestartIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const manualDecodeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopScanning();
      return;
    }

    startScanning();

    // Cleanup when component unmounts or modal closes
    return () => {
      // Clear auto-restart interval
      if (autoRestartIntervalRef.current) {
        clearInterval(autoRestartIntervalRef.current);
        autoRestartIntervalRef.current = null;
      }
      // Clear manual decode interval
      if (manualDecodeIntervalRef.current) {
        clearInterval(manualDecodeIntervalRef.current);
        manualDecodeIntervalRef.current = null;
      }
      stopScanning();
    };
  }, [isOpen]);

  const startScanning = async () => {
    setError(null);
    setIsScanning(true);

    try {
      // Check if we already have camera permission (helps reduce permission prompts on iOS)
      if (navigator.permissions) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          console.log('Camera permission status:', permissionStatus.state);
        } catch (e) {
          // Permissions API not fully supported, continue anyway
          console.log('Permissions API not supported, continuing...');
        }
      }

      // Request camera permission with optimal settings for barcode scanning
      // Higher frame rate helps compensate for hand jitter by taking more samples
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          aspectRatio: { ideal: 16/9 },
          frameRate: { ideal: 60, min: 30 } // Higher frame rate for jitter compensation
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
          videoRef.current!.onloadedmetadata = () => {
            videoRef.current!.play();
            resolve(true);
          };
        });
        
        // Enable continuous autofocus for better barcode scanning
        const videoTrack = stream.getVideoTracks()[0];
        const capabilities = videoTrack.getCapabilities() as any;
        const settings = videoTrack.getSettings();
        
        console.log(`📹 Camera settings: ${settings.width}x${settings.height} @ ${settings.frameRate || 'unknown'}fps`);
        
        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
          try {
            await videoTrack.applyConstraints({
              advanced: [{ focusMode: 'continuous' }] as any
            });
            console.log('✓ Continuous autofocus enabled');
          } catch (err) {
            console.warn('Could not enable continuous autofocus:', err);
          }
        } else {
          console.warn('Continuous autofocus not supported on this device');
        }
        
        console.log('✓ Camera ready with jitter compensation');
      }

      // Initialize the barcode reader with HYBRID scanning approach
      const hints = new Map();
      // TRY_HARDER = more thorough scanning (DecodeHintType.TRY_HARDER = 3)
      hints.set(3, true);
      // Configure formats: UPC-A primary with common fallbacks
      hints.set(2, [
        BarcodeFormat.UPC_A,     // Primary: 12-digit US retail barcodes
        BarcodeFormat.EAN_13,    // Fallback: UPC-A codes are also valid EAN-13
        BarcodeFormat.UPC_E,     // Shorter UPC format (some products use this)
        BarcodeFormat.CODE_128,  // Sometimes used on retail products
      ]);
      const reader = new BrowserMultiFormatReader(hints);
      readerRef.current = reader;
      console.log('✓ Scanner ready: HYBRID mode (continuous + forced manual decodes)');

      // Start scanning immediately - no delay
      console.log('Starting barcode detection...');

      // Use decodeFromVideoDevice with minimal delay between scans
      reader.decodeFromVideoDevice(
        undefined, // Use default video device
        videoRef.current!,
        (result, error) => {
          if (result) {
            const barcode = result.getText();
            
            // Prevent processing multiple scans simultaneously
            if (isProcessingScanRef.current) {
              return;
            }
            
            // Only debounce if it's the exact same code within 500ms (reduced for faster re-scanning)
            if (barcode === lastScanRef.current && scanTimeoutRef.current) {
              return;
            }
            
            console.log('✓ Barcode detected:', barcode);
            lastScanRef.current = barcode;
            isProcessingScanRef.current = true;
            
            // Clear auto-restart and manual decode since we found a barcode
            if (autoRestartIntervalRef.current) {
              clearInterval(autoRestartIntervalRef.current);
              autoRestartIntervalRef.current = null;
            }
            if (manualDecodeIntervalRef.current) {
              clearInterval(manualDecodeIntervalRef.current);
              manualDecodeIntervalRef.current = null;
            }
            
            // Hide "Scanning..." and show success
            setIsActivelyScanning(false);
            
            // Visual feedback
            setScanningFeedback('✓ Code detected!');
            
            // Provide haptic feedback if available
            if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100]);
            }
            
            // IMMEDIATELY stop camera - don't wait
            console.log('🎯 Barcode found! Stopping camera NOW...');
            stopScanning();
            
            // Small delay to show feedback, then close
            setTimeout(() => {
              console.log('📤 Sending barcode to form...');
              onScan(barcode);
              // Wait a bit for React to process, then close
              setTimeout(() => {
                // Triple-check camera is stopped
                stopScanning();
                console.log('🚪 Closing scanner modal...');
                onClose();
                isProcessingScanRef.current = false;
              }, 100);
            }, 300);
            
            // Reset debounce after 500ms (faster for jittery hands)
            if (scanTimeoutRef.current) {
              clearTimeout(scanTimeoutRef.current);
            }
            scanTimeoutRef.current = setTimeout(() => {
              lastScanRef.current = '';
              scanTimeoutRef.current = null;
            }, 500);
          }
          
          // Track error frequency to detect active scanning attempts
          if (error) {
            const now = Date.now();
            
            // Reset counter every 500ms
            if (now - errorCountWindowRef.current > 500) {
              recentErrorCountRef.current = 0;
              errorCountWindowRef.current = now;
            }
            
            recentErrorCountRef.current++;
            
            // If we're getting frequent errors (>3 per 500ms), actively scanning
            // Very low threshold for jitter compensation - shows "Scanning..." quickly
            if (recentErrorCountRef.current > 3) {
              setIsActivelyScanning(true);
              
              // Clear any existing timeout
              if (activeScanTimeoutRef.current) {
                clearTimeout(activeScanTimeoutRef.current);
              }
              
              // Hide "Scanning..." after 600ms of no activity (faster for jitter)
              activeScanTimeoutRef.current = setTimeout(() => {
                setIsActivelyScanning(false);
              }, 600);
            }
            
            // Log occasionally for debugging
            if (Math.random() < 0.005) { // 0.5% of frames
              console.log('🔍 Scanning... (TRY_HARDER mode active)');
            }
          }
        }
      );
      
      // Set up auto-restart every 2 seconds
      autoRestartIntervalRef.current = setInterval(() => {
        if (!isProcessingScanRef.current) {
          console.log('🔄 Auto-restarting scanner...');
          restartScannerOnly();
        }
      }, 2000);
      console.log('✓ Auto-restart enabled (every 2 seconds)');
      
      // ULTRA AGGRESSIVE: Manually decode frames every 250ms (4x per second!)
      manualDecodeIntervalRef.current = setInterval(() => {
        if (!isProcessingScanRef.current && videoRef.current && readerRef.current) {
          try {
            // Force a decode attempt on the current video frame
            readerRef.current.decodeFromVideoElement(
              videoRef.current,
              (result, error) => {
                if (error) {
                  // Silently ignore decode errors during manual attempts
                  return;
                }
                
                if (result) {
                  const barcode = result.getText();
                  
                  if (isProcessingScanRef.current) {
                    return;
                  }
                  
                  if (barcode === lastScanRef.current && scanTimeoutRef.current) {
                    return;
                  }
                  
                  console.log('🎯 MANUAL decode success:', barcode);
                  lastScanRef.current = barcode;
                  isProcessingScanRef.current = true;
                  
                  if (autoRestartIntervalRef.current) {
                    clearInterval(autoRestartIntervalRef.current);
                    autoRestartIntervalRef.current = null;
                  }
                  if (manualDecodeIntervalRef.current) {
                    clearInterval(manualDecodeIntervalRef.current);
                    manualDecodeIntervalRef.current = null;
                  }
                  
                  setIsActivelyScanning(false);
                  setScanningFeedback('✓ Code detected!');
                  
                  if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                  }
                  
                  console.log('🎯 Barcode found! Stopping camera NOW...');
                  stopScanning();
                  
                  setTimeout(() => {
                    console.log('📤 Sending barcode to form...');
                    onScan(barcode);
                    setTimeout(() => {
                      stopScanning();
                      console.log('🚪 Closing scanner modal...');
                      onClose();
                      isProcessingScanRef.current = false;
                    }, 100);
                  }, 300);
                  
                  if (scanTimeoutRef.current) {
                    clearTimeout(scanTimeoutRef.current);
                  }
                  scanTimeoutRef.current = setTimeout(() => {
                    lastScanRef.current = '';
                    scanTimeoutRef.current = null;
                  }, 500);
                }
              }
            );
          } catch (err) {
            // Silent fail
          }
        }
      }, 250);
      console.log('✓✓✓ ULTRA AGGRESSIVE manual decoding enabled (every 250ms = 4x/second)');
      
    } catch (err) {
      console.error('Camera error:', err);
      setError('Failed to access camera. Please ensure camera permissions are granted.');
      setIsScanning(false);
    }
  };

  // Restart just the scanner without requesting camera permission again
  const restartScannerOnly = async () => {
    // Don't restart if we're processing a scan or don't have a stream
    if (isProcessingScanRef.current || !streamRef.current || !videoRef.current) {
      console.log('⚠️ Cannot restart - missing requirements');
      return;
    }

    try {
      console.log('🔄 Restarting scanner (keeping camera active)...');
      
      // Stop the current reader only
      // Note: BrowserMultiFormatReader doesn't have a reset() method
      // Just set to null - the reader will be stopped when video tracks are stopped
      if (readerRef.current) {
        readerRef.current = null;
      }

      // Small delay before restarting
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Create a new reader with aggressive UPC detection
      const hints = new Map();
      hints.set(3, true); // TRY_HARDER mode
      hints.set(2, [
        BarcodeFormat.UPC_A,
        BarcodeFormat.EAN_13,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
      ]);
      const reader = new BrowserMultiFormatReader(hints);
      readerRef.current = reader;
      console.log('✓ New reader created for restart');

      // Restart scanning with existing video stream (no new camera permission needed)
      reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, error) => {
          if (result) {
            const barcode = result.getText();
            
            if (isProcessingScanRef.current) {
              return;
            }
            
            if (barcode === lastScanRef.current && scanTimeoutRef.current) {
              return;
            }
            
            console.log('✓ Barcode detected:', barcode);
            lastScanRef.current = barcode;
            isProcessingScanRef.current = true;
            
            // Clear auto-restart and manual decode since we found a barcode
            if (autoRestartIntervalRef.current) {
              clearInterval(autoRestartIntervalRef.current);
              autoRestartIntervalRef.current = null;
            }
            if (manualDecodeIntervalRef.current) {
              clearInterval(manualDecodeIntervalRef.current);
              manualDecodeIntervalRef.current = null;
            }
            
            setIsActivelyScanning(false);
            setScanningFeedback('✓ Code detected!');
            
            if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100]);
            }
            
            console.log('🎯 Barcode found! Stopping camera NOW...');
            stopScanning();
            
            setTimeout(() => {
              console.log('📤 Sending barcode to form...');
              onScan(barcode);
              setTimeout(() => {
                stopScanning();
                console.log('🚪 Closing scanner modal...');
                onClose();
                isProcessingScanRef.current = false;
              }, 100);
            }, 300);
            
            if (scanTimeoutRef.current) {
              clearTimeout(scanTimeoutRef.current);
            }
            scanTimeoutRef.current = setTimeout(() => {
              lastScanRef.current = '';
              scanTimeoutRef.current = null;
            }, 500);
          }
          
          if (error) {
            const now = Date.now();
            
            if (now - errorCountWindowRef.current > 500) {
              recentErrorCountRef.current = 0;
              errorCountWindowRef.current = now;
            }
            
            recentErrorCountRef.current++;
            
            if (recentErrorCountRef.current > 3) {
              setIsActivelyScanning(true);
              
              if (activeScanTimeoutRef.current) {
                clearTimeout(activeScanTimeoutRef.current);
              }
              
              activeScanTimeoutRef.current = setTimeout(() => {
                setIsActivelyScanning(false);
              }, 600);
            }
          }
        }
      );
    } catch (err) {
      console.warn('⚠️ Error restarting scanner:', err);
    }
  };

  const stopScanning = () => {
    console.log('🛑🛑🛑 STOPPING CAMERA AND SCANNER 🛑🛑🛑');
    
    // Step 1: IMMEDIATELY stop ALL intervals first (most critical!)
    if (manualDecodeIntervalRef.current) {
      clearInterval(manualDecodeIntervalRef.current);
      manualDecodeIntervalRef.current = null;
      console.log('  ✓✓✓ Manual decode interval STOPPED');
    }
    
    if (autoRestartIntervalRef.current) {
      clearInterval(autoRestartIntervalRef.current);
      autoRestartIntervalRef.current = null;
      console.log('  ✓✓✓ Auto-restart interval STOPPED');
    }
    
    // Step 2: Clear timeouts
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    
    if (activeScanTimeoutRef.current) {
      clearTimeout(activeScanTimeoutRef.current);
      activeScanTimeoutRef.current = null;
    }
    
    // Step 2: Clear ZXing reader reference
    // Note: BrowserMultiFormatReader doesn't have a reset() method
    // The reader will be stopped when video tracks are stopped
    if (readerRef.current) {
      console.log('  🔍 Clearing ZXing reader reference...');
      readerRef.current = null;
      console.log('  ✓ ZXing reader cleared');
    }
    
    // Step 3: Stop ALL video tracks (THIS IS CRITICAL)
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      console.log(`  🎥 Stopping ${tracks.length} media track(s)...`);
      tracks.forEach((track, index) => {
        if (track.readyState === 'live') {
          console.log(`    Stopping track ${index}: ${track.kind} - ${track.label}`);
          track.stop();
          console.log(`    ✅ Track ${index} stopped - readyState: ${track.readyState}`);
        } else {
          console.log(`    Track ${index} already stopped (${track.readyState})`);
        }
      });
      streamRef.current = null;
      console.log('  ✓ Stream reference cleared');
    } else {
      console.log('  ℹ️ No stream to stop');
    }
    
    // Step 4: Clear and pause video element
    if (videoRef.current) {
      console.log('  📺 Clearing video element...');
      const video = videoRef.current;
      video.pause();
      video.srcObject = null;
      video.load(); // Force clear buffer
      console.log('  ✓ Video element cleared');
    }

    // Step 5: Reset all state
    setIsScanning(false);
    setIsActivelyScanning(false);
    setTorchEnabled(false);
    setScanningFeedback(null);
    setManualRestartFeedback(false);
    lastScanRef.current = '';
    isProcessingScanRef.current = false;
    recentErrorCountRef.current = 0;
    
    // Step 6: Final verification
    setTimeout(() => {
      if (streamRef.current) {
        console.error('⚠️⚠️⚠️ STREAM STILL EXISTS! Forcing cleanup...');
        const tracks = streamRef.current.getTracks();
        tracks.forEach(track => {
          if (track.readyState === 'live') {
            console.error('  🚨 Found live track, stopping it NOW!');
            track.stop();
          }
        });
        streamRef.current = null;
      } else {
        console.log('✅✅✅ VERIFIED: Camera stream is NULL - GREEN LIGHT SHOULD BE OFF ✅✅✅');
      }
    }, 50);
    
    console.log('✅ Camera stop sequence completed');
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;

    const track = streamRef.current.getVideoTracks()[0];
    const capabilities = track.getCapabilities() as any;

    if (!capabilities.torch) {
      setError('Flashlight not available on this device');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchEnabled } as any]
      });
      setTorchEnabled(!torchEnabled);
    } catch (err) {
      console.error('Torch error:', err);
      setError('Failed to toggle flashlight');
      setTimeout(() => setError(null), 3000);
    }
  };


  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      console.log('⌨️ Manual barcode entry submitted');
      stopScanning();
      onScan(manualInput.trim());
      setManualInput('');
      setShowManualInput(false);
      setTimeout(() => {
        stopScanning(); // Verify cleanup
        onClose();
      }, 100);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="relative z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
        <button
          onClick={() => {
            console.log('❌ User clicked close button');
            stopScanning();
            setTimeout(() => {
              stopScanning();
              setTimeout(() => {
                stopScanning();
                onClose();
              }, 100);
            }, 100);
          }}
          className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-white">
          Scan Barcode
        </h2>
        <div className="w-10"></div> {/* Spacer for centering */}
      </div>

      {/* Camera view - full screen */}
      <div className="flex-1 relative">
        {error && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 max-w-sm mx-4">
            <div className="bg-red-500 text-white text-sm p-3 rounded-lg shadow-lg">
              {error}
            </div>
          </div>
        )}

        {!showManualInput ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => {
                // Tap to manually restart scanner for better detection
                console.log('👆 Screen tapped!');
                if (!isProcessingScanRef.current) {
                  console.log('✓ Not processing, triggering restart...');
                  setManualRestartFeedback(true);
                  restartScannerOnly();
                  setTimeout(() => setManualRestartFeedback(false), 600);
                } else {
                  console.log('⚠️ Already processing a scan, ignoring tap');
                }
              }}
            />
                
                {isScanning && (
                  <>
                    {/* Scanning frame to help center barcode */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="relative" style={{ width: '85%', maxWidth: '400px', height: '160px' }}>
                        {/* Red frame for aiming with subtle pulse */}
                        <div className={`absolute inset-0 border-2 border-red-500 rounded-lg ${isActivelyScanning ? 'opacity-80 animate-pulse' : 'opacity-60'}`}>
                          {/* Corner accents */}
                          <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
                          <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
                          <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
                          <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg"></div>
                        </div>
                        {/* Scanning line animation */}
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-400 animate-pulse" style={{ 
                          animation: 'scan-line 2s ease-in-out infinite',
                        }}></div>
                      </div>
                    </div>
                    
                    {/* Instruction text */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none pt-48">
                      {isActivelyScanning ? (
                        <div className="text-white text-center px-6">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-lg font-medium drop-shadow-lg">Scanning...</span>
                          </div>
                          <p className="text-xs opacity-80">Attempting 4x per second</p>
                        </div>
                      ) : (
                        <div className="text-white text-center px-6">
                          <p className="text-lg font-medium drop-shadow-lg mb-2">
                            📱 Position camera over barcode
                          </p>
                          <div className="text-xs opacity-90 space-y-0.5 bg-black/40 rounded-lg p-2 backdrop-blur-sm">
                            <p>✓ Hold 4-8 inches away</p>
                            <p>✓ Brace phone or use both hands</p>
                            <p>✓ Keep steady for 2-3 seconds</p>
                            <p>✓ Tap screen to rescan</p>
                            <p>✓ Use 💡 in low light</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Feedback messages */}
                    {scanningFeedback && (
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white px-6 py-3 rounded-lg font-semibold text-lg shadow-lg z-20">
                        {scanningFeedback}
                      </div>
                    )}
                    
                    {/* Manual restart feedback */}
                    {manualRestartFeedback && (
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-2xl z-30 animate-pulse border-2 border-white">
                        🔄 RESCANNING...
                      </div>
                    )}
                    
                    {/* Top-right control buttons */}
                    <div className="absolute top-4 right-4 flex gap-2 z-10">
                      {/* Flashlight toggle button */}
                      <button
                        onClick={toggleTorch}
                        className={`p-2.5 rounded-full ${
                          torchEnabled 
                            ? 'bg-yellow-400 text-white' 
                            : 'bg-black/30 text-white hover:bg-black/40'
                        } transition-colors backdrop-blur-sm`}
                        type="button"
                        title="Toggle flashlight"
                      >
                        {torchEnabled ? (
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </>
                )}
            
            {/* Bottom actions */}
            <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-12">
              <button
                onClick={() => {
                  console.log('⌨️ Switching to manual input - stopping camera');
                  stopScanning();
                  setShowManualInput(true);
                }}
                className="w-full text-white text-sm font-medium hover:text-gray-200 transition-colors"
                type="button"
              >
                Enter barcode manually
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-30 p-6">
            <div className="w-full max-w-sm space-y-4">
              <div>
                <label htmlFor="manualUpc" className="block text-sm font-medium text-white mb-3">
                  Enter UPC/Barcode Number
                </label>
                <input
                  type="text"
                  id="manualUpc"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
                  placeholder="e.g., 1025U224417F"
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800 text-white placeholder-gray-400"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowManualInput(false);
                    setManualInput('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualInput.trim()}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

