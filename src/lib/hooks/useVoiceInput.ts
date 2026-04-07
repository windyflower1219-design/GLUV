'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { VoiceInputState } from '@/types';

interface UseVoiceInputReturn {
  state: VoiceInputState;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useVoiceInput(
  onResult?: (transcript: string) => void
): UseVoiceInputReturn {
  const [state, setState] = useState<VoiceInputState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const initRecognition = useCallback(() => {
    if (!isSupported) return null;

    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) return null;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState('listening');
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let currentFinal = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          currentFinal += text + ' ';
        } else {
          interim += text;
        }
      }

      setInterimTranscript(interim);
      if (currentFinal) {
        setTranscript(prev => prev + currentFinal);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') return; // 무응답은 무시 (연속 인식 중일 수 있음)
      
      const errorMessages: Record<string, string> = {
        'not-allowed': '마이크 권한이 필요합니다. 설정에서 허용해주세요.',
        'network': '네트워크 오류가 발생했습니다.',
        'audio-capture': '마이크를 사용할 수 없습니다.',
        'aborted': '음성 인식이 중단되었습니다.',
      };
      
      setError(errorMessages[event.error] || `오류: ${event.error}`);
      setState('error');
    };

    recognition.onend = () => {
      setInterimTranscript('');
      // 연속 인식이지만 브라우저가 끊었을 경우를 대비해 상태만 체크
      if (state === 'listening') {
        // 이미 결과는 transcript에 쌓여있음
      }
    };

    return recognition;
  }, [isSupported, onResult, state]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome을 사용해주세요.');
      setState('error');
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = initRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    setTranscript('');
    setInterimTranscript('');
    setError(null);

    try {
      recognition.start();
    } catch (err) {
      setError('음성 인식을 시작할 수 없습니다.');
      setState('error');
    }
  }, [isSupported, initRecognition]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    if (transcript.trim() || interimTranscript.trim()) {
      const finalFullText = (transcript + ' ' + interimTranscript).trim();
      setState('processing');
      onResult?.(finalFullText);
    } else {
      setState('idle');
    }
    setInterimTranscript('');
  }, [transcript, interimTranscript, onResult]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    setState('idle');
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  return {
    state,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
