import { useRef, useCallback, useEffect, RefObject } from 'react';
import { type DetectedBarcode, type BarcodeFormat, BarcodeDetector } from 'barcode-detector';
import { base64Beep } from '../assets/base64Beep';

interface IUseScannerProps {
    videoElementRef: RefObject<HTMLVideoElement | null>;
    onScan: (results: DetectedBarcode[]) => void;
    onFound: (results: DetectedBarcode[]) => void;
    formats?: BarcodeFormat[];
    audio?: boolean;
    retryDelay?: number;
}

export default function useScanner(props: IUseScannerProps) {
    const { videoElementRef, onScan, onFound, retryDelay = 100, formats = [], audio = true } = props;

    const barcodeDetectorRef = useRef(new BarcodeDetector({ formats }));
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const animationFrameIdRef = useRef<number | null>(null);
    const detectedCodesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        barcodeDetectorRef.current = new BarcodeDetector({ formats });
    }, [formats]);

    useEffect(() => {
        if (typeof window !== 'undefined' && audio) {
            audioRef.current = new Audio(base64Beep);
        }
    }, [audio]);

    const processFrame = useCallback(
        (state: any) => async (timeNow: number) => {
            if (videoElementRef.current !== null && videoElementRef.current.readyState > 1) {
                const { lastScan } = state;
                const count =3

                if (timeNow - lastScan < retryDelay) {
                    animationFrameIdRef.current = window.requestAnimationFrame(processFrame(state));
                } else {
                    const detectedCodes = await barcodeDetectorRef.current.detect(videoElementRef.current);
                    const detectedValues = new Set(detectedCodes.map((code) => code.rawValue));

                    let newScanned = false;
                    detectedValues.forEach((value) => {
                        if (!detectedCodesRef.current.has(value)) {
                            detectedCodesRef.current.add(value);
                            newScanned = true;
                        }
                    });

                    if (newScanned) {
                        if (audio && audioRef.current && audioRef.current.paused) {
                            audioRef.current.play().catch((error) => console.error('Error playing the sound', error));
                        }
                        onScan(detectedCodes);
                        onFound(detectedCodes);
                    }

                    // Stop scanning if all codes in the frame are already detected
                    if (detectedValues.size > 0 && Array.from(detectedCodesRef.current).length>=count && !newScanned) {
                        onScan(Array.from(detectedCodesRef.current) as any);
                        audioRef.current?.play();
                        console.log('stopping the scan');
                        stopScanning();
                    } else {
                        const newState = {
                            lastScan: timeNow
                        };
                        animationFrameIdRef.current = window.requestAnimationFrame(processFrame(newState));
                    }
                }
            }
        },
        [videoElementRef, onScan, onFound, retryDelay]
    );

    const startScanning = useCallback(() => {
        detectedCodesRef.current.clear();
        const current = performance.now();
        const initialState = {
            lastScan: current
        };
        animationFrameIdRef.current = window.requestAnimationFrame(processFrame(initialState));
    }, [processFrame]);

    const stopScanning = useCallback(() => {
        if (animationFrameIdRef.current !== null) {
            window.cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
    }, []);

    return {
        startScanning,
        stopScanning
    };
}
