import { useState, useRef, useCallback } from "react";
import { Product, VoiceParseResult } from "@/types";

export type VoiceState = "idle" | "listening" | "processing" | "success" | "error" | "fallback";

interface UseVoiceOrderProps {
  products: Product[];
}

// Get backend URL from environment
const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL || '';

export const useVoiceOrder = ({ products }: UseVoiceOrderProps) => {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [rawTranscript, setRawTranscript] = useState("");
  const [parseResult, setParseResult] = useState<VoiceParseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const [micVolume, setMicVolume] = useState(0);

  const SILENCE_RMS_THRESHOLD = 0.02; // Higher threshold to ignore background noise
  const SILENCE_DURATION = 4000;
  const MAX_RECORDING_TIME = 30000;
  const MIN_SPEECH_DURATION = 500; // Ignore bursts shorter than 500ms

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  const parseWithAI = useCallback(async (transcript: string): Promise<VoiceParseResult> => {
    try {
      // Prepare product data for the API including variant information
      const productData = products.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand || null,
        model: p.model || null,
        price: p.price,
        stock: p.stock,
        color: p.color || null,
        attributes: p.attributes || null,
        variants: p.variants?.map((v) => ({
          id: v.id,
          size: v.size || null,
          color: v.color || null,
          qty: v.qty,
          mrp: v.mrp,
          rate: v.rate,
          rack: v.rack || null,
        })) || null,
      }));

      // Call our new intelligent backend API
      const response = await fetch(`${BACKEND_URL}/api/parse-voice-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript,
          products: productData,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend API error:", errorText);
        return {
          success: false,
          error: "network_error",
          message: "Network issue while processing voice. Please try again.",
          parsed: [],
          rawTranscript: transcript,
        };
      }

      const data = await response.json();
      return data as VoiceParseResult;
    } catch (err) {
      console.error("AI parse error:", err);
      return {
        success: false,
        error: "parse_failed",
        message: "Could not process voice input. Please try again.",
        parsed: [],
        rawTranscript: transcript,
      };
    }
  }, [products]);

  const startListening = useCallback(async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      setVoiceState("error");
      return;
    }

    try {
      setVoiceState("listening");
      setErrorMessage("");
      setParseResult(null);
      setRawTranscript("");

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "hi-IN"; // Hindi primary for Indian retail
      // Add English as alternative via continuous recognition
      recognition.maxAlternatives = 3;

      // Request microphone with noise suppression for retail environments
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            // Prefer high-quality capture to help speech recognition
            sampleRate: { ideal: 16000 },
            channelCount: 1,
          },
        });
        micStreamRef.current = stream;
      } catch (micErr) {
        console.warn("Could not get enhanced mic stream, falling back to default:", micErr);
      }

      let finalTranscript = "";
      let silenceTimer: ReturnType<typeof setTimeout> | null = null;

      const resetSilenceTimer = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          recognition.stop();
        }, 4000);
      };

      recognition.onresult = (event: any) => {
        resetSilenceTimer();
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + " ";
          } else {
            interim += result[0].transcript;
          }
        }
        setRawTranscript(finalTranscript + interim);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        cleanup();
        
        const errorMessages: Record<string, string> = {
          "no-speech": "Could not hear anything. Please speak louder and try again.",
          "audio-capture": "Microphone access failed. Please check your microphone.",
          "not-allowed": "Microphone permission denied. Please allow microphone access.",
          "network": "Network issue during speech recognition. Please check your connection.",
          "aborted": "Speech recognition was cancelled.",
        };

        setErrorMessage(errorMessages[event.error] || `Speech recognition error: ${event.error}`);
        setVoiceState("error");
      };

      recognition.onend = async () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        
        const transcript = finalTranscript.trim();
        // Filter out noise-only captures (very short or just filler words)
        const meaningfulWords = transcript.split(/\s+/).filter(w => w.length > 1);
        if (!transcript || meaningfulWords.length < 2) {
          setErrorMessage("Could not hear clearly. Please speak louder and closer to the mic, and try again.");
          setVoiceState("error");
          return;
        }

        setRawTranscript(transcript);
        setVoiceState("processing");

        console.log("🎤 Raw transcript:", transcript);
        const result = await parseWithAI(transcript);
        console.log("🧠 Parse result:", result);

        setParseResult(result);

        if (result.success && result.parsed.length > 0) {
          const highConfidence = result.parsed.filter((p) => p.confidence >= 0.7);
          const lowConfidence = result.parsed.filter((p) => p.confidence < 0.7);
          const hasUnmatched = (result.unmatchedSegments?.length ?? 0) > 0;

          if (lowConfidence.length > 0 || hasUnmatched) {
            setVoiceState("fallback");
          } else if (highConfidence.length > 0) {
            setVoiceState("success");
          } else {
            setVoiceState("fallback");
          }
        } else {
          setVoiceState("fallback");
        }
      };

      recognition.start();
      resetSilenceTimer();

      // Hard stop after max time
      setTimeout(() => {
        if (recognition) {
          try { recognition.stop(); } catch {}
        }
      }, MAX_RECORDING_TIME);

      mediaRecorderRef.current = recognition as any; // Store for stop
    } catch (err) {
      console.error("Voice start error:", err);
      setErrorMessage("Microphone access failed. Please check permissions.");
      setVoiceState("error");
      cleanup();
    }
  }, [cleanup, parseWithAI]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current) {
      try {
        (mediaRecorderRef.current as any).stop?.();
      } catch {}
    }
    // Stop the enhanced mic stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    cleanup();
  }, [cleanup]);

  const reprocessTranscript = useCallback(async (editedTranscript: string) => {
    setRawTranscript(editedTranscript);
    setVoiceState("processing");
    const result = await parseWithAI(editedTranscript);
    setParseResult(result);
    
    if (result.success && result.parsed.length > 0) {
      const highConfidence = result.parsed.filter((p) => p.confidence >= 0.7);
      if (highConfidence.length === result.parsed.length && (!result.unmatchedSegments || result.unmatchedSegments.length === 0)) {
        setVoiceState("success");
      } else {
        setVoiceState("fallback");
      }
    } else {
      setVoiceState("fallback");
    }
  }, [parseWithAI]);

  const reset = useCallback(() => {
    setVoiceState("idle");
    setRawTranscript("");
    setParseResult(null);
    setErrorMessage("");
    cleanup();
  }, [cleanup]);

  return {
    voiceState,
    rawTranscript,
    parseResult,
    errorMessage,
    startListening,
    stopListening,
    reprocessTranscript,
    reset,
    micVolume,
  };
};
