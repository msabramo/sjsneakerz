import { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  BarcodeFormat,
} from "@zxing/browser";

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onCancel?: () => void;
}

export default function BarcodeScanner({
  onDetected,
  onCancel
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const [isScanning, setIsScanning] = useState(false);

  // ---------------------------------------------------------------------------
  // Start scanning
  // ---------------------------------------------------------------------------
  const startScanning = async () => {
    if (isScanning) return;
    setIsScanning(true);

    // 1. Create ZXing reader configured for EAN_13 (best for UPC-A)
    const hints = new Map();
    hints.set(2, [BarcodeFormat.EAN_13]); // POSSIBLE_FORMATS = 2
    readerRef.current = new BrowserMultiFormatReader(hints);

    // 2. Request high‑resolution camera stream
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // 3. Kick off manual decode loop
      requestAnimationFrame(scanLoop);
    } catch (err) {
      console.error("Camera error:", err);
      stopScanning();
      onCancel?.();
    }
  };

  // ---------------------------------------------------------------------------
  // Decode loop
  // ---------------------------------------------------------------------------
  const scanLoop = async () => {
    if (!isScanning || !videoRef.current || !readerRef.current) return;

    try {
      const result =
        await readerRef.current.decodeOnceFromVideoElement(videoRef.current);

      if (result) {
        const raw = result.getText();
        const normalized = raw.startsWith("0") ? raw.slice(1) : raw;
        onDetected(normalized);
        stopScanning();
        return;
      }
    } catch {
      // Decode errors are expected during scanning — ignore
    }

    requestAnimationFrame(scanLoop);
  };

  // ---------------------------------------------------------------------------
  // Stop scanning + full teardown (Safari‑safe)
  // ---------------------------------------------------------------------------
  const stopScanning = () => {
    setIsScanning(false);

    // 1. Clear ZXing reader reference
    // Note: BrowserMultiFormatReader doesn't have a reset() method
    // The reader will be stopped when video tracks are stopped
    if (readerRef.current) {
      readerRef.current = null;
    }

    // 2. Stop camera tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // 3. Clear video element + force Safari to release camera
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.load();
    }
  };

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  useEffect(() => {
    startScanning();
    return () => stopScanning();
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={styles.container}>
      <video ref={videoRef} style={styles.video} playsInline />

      {/* Bounding box overlay */}
      <div style={styles.scanBox} />

      {/* User hint */}
      <div style={styles.hint}>
        Tilt phone slightly to reduce glare  
        <br />
        Fit barcode inside the box
      </div>

      <button style={styles.cancelButton} onClick={stopScanning}>
        Cancel
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------
const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    width: "100%",
    height: "100%",
    background: "black",
    overflow: "hidden"
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover"
  },
  scanBox: {
    position: "absolute",
    top: "40%",
    left: "10%",
    width: "80%",
    height: "120px",
    border: "3px solid rgba(255,255,255,0.9)",
    borderRadius: "8px",
    boxSizing: "border-box"
  },
  hint: {
    position: "absolute",
    bottom: "80px",
    width: "100%",
    textAlign: "center",
    color: "white",
    fontSize: "16px",
    opacity: 0.9
  },
  cancelButton: {
    position: "absolute",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "12px 24px",
    fontSize: "16px",
    borderRadius: "8px",
    border: "none",
    background: "rgba(255,255,255,0.2)",
    color: "white"
  }
};
