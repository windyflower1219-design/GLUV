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
  const onResultRef = useRef(onResult);
  const transcriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const isStoppedManuallyRef = useRef(false);

  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { interimTranscriptRef.current = interimTranscript; }, [interimTranscript]);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const stopListening = useCallback(() => {
    isStoppedManuallyRef.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    const finalFullText = (transcriptRef.current + ' ' + interimTranscriptRef.current).trim();
    if (finalFullText) {
      setState('processing');
      onResultRef.current?.(finalFullText);
    } else {
      setState('idle');
    }
    setInterimTranscript('');
  }, []);

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
      isStoppedManuallyRef.current = false;
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
      
      // 만약 사용자가 직접 중지(stopListening)한 게 아니라 브라우저/시스템에 의해 끝났다면
      if (!isStoppedManuallyRef.current) {
        const finalFullText = (transcriptRef.current + ' ' + interimTranscriptRef.current).trim();
        if (finalFullText) {
          setState('processing');
          onResultRef.current?.(finalFullText);
        } else {
          setState('idle');
        }
      }
    };

    return recognition;
  }, [isSupported]);

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
    transcriptRef.current = '';
    interimTranscriptRef.current = '';
    setError(null);
    isStoppedManuallyRef.current = false;

    try {
      recognition.start();
    } catch (err) {
      setError('음성 인식을 시작할 수 없습니다.');
      setState('error');
    }
  }, [isSupported, initRecognition]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    transcriptRef.current = '';
    interimTranscriptRef.current = '';
    setError(null);
    setState('idle');
  }, []);

  useEffect(() => {
    return () => {
      isStoppedManuallyRef.current = true;
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
