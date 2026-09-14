/**
 * Speech Service: Handles Speech-to-Text (Voice Input) and Text-to-Speech (Playback)
 * using the browser Web Speech API (NOT BHASHINI ASR).
 */

export type SpeechRecognitionErrorCode =
  | 'not-allowed'
  | 'service-not-allowed'
  | 'network'
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'unsupported'
  | 'unknown';

// Speech Recognition instance
let recognitionInstance: any = null;
let intentionalStop = false;

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function getSpeechRecognitionErrorMessage(
  code: SpeechRecognitionErrorCode,
  language: 'en' | 'hi' = 'en'
): string {
  const hi = language === 'hi';
  switch (code) {
    case 'not-allowed':
      return hi
        ? 'माइक्रोफ़ोन की अनुमति नहीं मिली। ब्राउज़र सेटिंग में माइक अनुमति दें।'
        : 'Microphone permission denied. Allow mic access in your browser settings.';
    case 'service-not-allowed':
      return hi
        ? 'इस ब्राउज़र/संदर्भ में वॉइस पहचान अवरुद्ध है। Chrome/Edge (HTTPS) आज़माएँ या टाइप करें।'
        : 'Speech recognition is blocked in this browser/context. Try Chrome/Edge over HTTPS, or type your query.';
    case 'network':
      return hi
        ? 'वॉइस पहचान नेटवर्क त्रुटि। इंटरनेट जांचें और फिर कोशिश करें।'
        : 'Speech recognition network error. Check your internet connection and try again.';
    case 'no-speech':
      return hi
        ? 'कोई आवाज़ नहीं सुनाई दी। माइक दबाकर फिर से बोलें।'
        : 'No speech detected. Click the mic and try speaking again.';
    case 'audio-capture':
      return hi
        ? 'माइक्रोफ़ोन नहीं मिला। डिवाइस कनेक्ट करके फिर कोशिश करें।'
        : 'No microphone found. Connect a mic and try again.';
    case 'language-not-supported':
      return hi
        ? 'यह भाषा वॉइस पहचान के लिए समर्थित नहीं है।'
        : 'This language is not supported for speech recognition.';
    case 'unsupported':
      return hi
        ? 'इस ब्राउज़र में वॉइस इनपुट समर्थित नहीं है। कृपया टाइप करें।'
        : 'Voice input is not supported in this browser. Please type your query.';
    case 'aborted':
      return hi ? 'वॉइस इनपुट रोक दिया गया।' : 'Voice input was stopped.';
    default:
      return hi
        ? 'वॉइस पहचान विफल रही। कृपया फिर कोशिश करें या टाइप करें।'
        : 'Speech recognition failed. Please try again or type your query.';
  }
}

function normalizeErrorCode(raw: unknown): SpeechRecognitionErrorCode {
  const code = String(raw || 'unknown');
  const allowed: SpeechRecognitionErrorCode[] = [
    'not-allowed',
    'service-not-allowed',
    'network',
    'no-speech',
    'aborted',
    'audio-capture',
    'bad-grammar',
    'language-not-supported',
    'unsupported',
    'unknown',
  ];
  return (allowed.includes(code as SpeechRecognitionErrorCode)
    ? code
    : 'unknown') as SpeechRecognitionErrorCode;
}

function forceStopRecognitionInstance(): void {
  if (!recognitionInstance) return;
  const active = recognitionInstance;
  try {
    active.onresult = null;
    active.onerror = null;
    active.onend = null;
    active.stop();
  } catch {
    // Ignored
  }
  try {
    active.abort?.();
  } catch {
    // Ignored
  }
  recognitionInstance = null;
}

export function startSpeechRecognition(
  language: 'en' | 'hi',
  onResult: (transcript: string, isFinal: boolean) => void,
  onError?: (code?: SpeechRecognitionErrorCode, message?: string) => void,
  onEnd?: () => void
): () => void {
  if (!isSpeechRecognitionSupported()) {
    const code: SpeechRecognitionErrorCode = 'unsupported';
    if (onError) onError(code, getSpeechRecognitionErrorMessage(code, language));
    return () => {};
  }

  // Ensure any previous session is fully cleared before starting a new one.
  intentionalStop = true;
  forceStopRecognitionInstance();
  intentionalStop = false;

  try {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognitionInstance = recognition;

    recognition.continuous = true;
    // For Hindi speech mode, prefer final results: Chrome often emits Romanized interim
    // and (when available) Devanagari finals. English keeps live interim feedback.
    recognition.interimResults = language !== 'hi';
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.maxAlternatives = 1;

    console.log('[VOICE] recognition.lang:', recognition.lang);

    let finalTranscript = '';
    let endedCleanly = false;

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result?.[0]?.transcript || '';
        if (result.isFinal) {
          finalTranscript += piece;
        } else {
          interimTranscript += piece;
        }
      }

      const combined = `${finalTranscript}${interimTranscript}`.replace(/\s+/g, ' ').trim();
      if (combined) {
        console.log('[VOICE] raw transcript:', combined);
        onResult(combined, interimTranscript.length === 0);
      }
    };

    recognition.onerror = (e: any) => {
      const code = normalizeErrorCode(e?.error);
      // User/manual stop should not surface as a failure.
      if (code === 'aborted' && intentionalStop) {
        return;
      }
      console.warn('Speech recognition error:', code, e);
      if (onError) onError(code, getSpeechRecognitionErrorMessage(code, language));
    };

    recognition.onend = () => {
      if (recognitionInstance === recognition) {
        recognitionInstance = null;
      }
      if (endedCleanly) return;
      endedCleanly = true;
      if (onEnd) onEnd();
    };

    recognition.start();

    return () => {
      intentionalStop = true;
      endedCleanly = false;
      try {
        recognition.stop();
      } catch {
        // Ignored
      }
      if (recognitionInstance === recognition) {
        recognitionInstance = null;
      }
    };
  } catch (err) {
    console.warn('Speech recognition initiation failed:', err);
    const code: SpeechRecognitionErrorCode = 'unknown';
    if (onError) onError(code, getSpeechRecognitionErrorMessage(code, language));
    return () => {};
  }
}

export function stopSpeechRecognition(): void {
  intentionalStop = true;
  forceStopRecognitionInstance();
}

// Text-to-Speech (TTS)
export interface SpokenWordItem {
  index: number;
  word: string;
  charStart: number;
  charEnd: number;
  weight: number;
  estimatedStartTimeMs: number;
  estimatedEndTimeMs: number;
}

export interface WordBoundaryEvent {
  wordIndex: number;
  charIndex: number;
  word: string;
}

export interface SpeakTextOptions {
  text?: string;
  language: 'en' | 'hi';
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
  onWord?: (info: WordBoundaryEvent) => void;
  onDegradeToParagraph?: () => void;
}

let activeBoundaryTimer: any = null;
let activeWordCallback: ((info: WordBoundaryEvent) => void) | null = null;
let activeEndCallback: (() => void) | null = null;

/**
 * Parses plain text into word tokens with exact character boundaries and duration weights.
 */
export function parseSpokenWords(text: string, language: 'en' | 'hi' = 'en'): SpokenWordItem[] {
  const clean = text.replace(/[*_#`~]/g, '');
  const words: SpokenWordItem[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  let index = 0;
  let currentMs = 0;
  const msPerUnit = language === 'hi' ? 62 : 54;

  while ((match = regex.exec(clean)) !== null) {
    const word = match[0];
    const charStart = match.index;
    const charEnd = charStart + word.length;
    let weight = Math.max(2, word.length);
    // Extra weight for punctuation pauses
    if (/[.,!?।;:]$/.test(word)) {
      weight += 4;
    }

    const durationMs = weight * msPerUnit;
    words.push({
      index,
      word,
      charStart,
      charEnd,
      weight,
      estimatedStartTimeMs: currentMs,
      estimatedEndTimeMs: currentMs + durationMs,
    });
    currentMs += durationMs;
    index++;
  }

  return words;
}

export function speakText(
  textOrOptions: string | (SpeakTextOptions & { text: string }),
  languageOrOptions?: 'en' | 'hi' | SpeakTextOptions,
  legacyOnStart?: () => void,
  legacyOnEnd?: () => void,
  legacyOnError?: () => void,
  legacyOnWord?: (info: WordBoundaryEvent) => void,
  legacyOnDegrade?: () => void
): void {
  // Normalize options
  let options: SpeakTextOptions;
  let textToSpeak: string;

  if (typeof textOrOptions === 'object') {
    options = textOrOptions;
    textToSpeak = textOrOptions.text || '';
  } else {
    textToSpeak = textOrOptions;
    if (typeof languageOrOptions === 'object') {
      options = languageOrOptions;
    } else {
      options = {
        language: languageOrOptions || 'en',
        onStart: legacyOnStart,
        onEnd: legacyOnEnd,
        onError: legacyOnError,
        onWord: legacyOnWord,
        onDegradeToParagraph: legacyOnDegrade,
      };
    }
  }

  const { language, onStart, onEnd, onError, onWord, onDegradeToParagraph } = options;

  // Clear any existing timer or playback
  stopSpeaking();

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onError) onError();
    return;
  }

  try {
    const cleanText = textToSpeak.replace(/[*_#`~]/g, '').trim();
    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    const words = parseSpokenWords(cleanText, language);
    const totalWeight = words.reduce((acc, w) => acc + w.weight, 0);
    const msPerUnit = language === 'hi' ? 62 : 54;
    const totalEstimatedDurationMs = Math.max(800, totalWeight * msPerUnit);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.95; // Steady, intelligible rate
    utterance.pitch = 1.0;

    // Select matched voice if available
    const voices = window.speechSynthesis.getVoices();
    const targetLangCode = language === 'hi' ? 'hi' : 'en';
    const matchedVoice = voices.find((v) => v.lang.toLowerCase().startsWith(targetLangCode));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    let hasReceivedBoundary = false;
    let lastSpokenWordIndex = -1;
    let startTime = 0;

    activeWordCallback = onWord || null;
    activeEndCallback = onEnd || null;

    utterance.onstart = () => {
      startTime = performance.now();
      hasReceivedBoundary = false;
      lastSpokenWordIndex = 0;

      if (onStart) onStart();

      // Immediately highlight the first word
      if (words.length > 0 && onWord) {
        onWord({
          wordIndex: 0,
          charIndex: words[0].charStart,
          word: words[0].word,
        });
      }

      // If text is very short (1-2 words), degrade gracefully to paragraph block
      if (words.length <= 2 && onDegradeToParagraph) {
        onDegradeToParagraph();
      }

      // Fallback timer: advances word-by-word if Web Speech API boundary doesn't fire
      activeBoundaryTimer = setInterval(() => {
        if (hasReceivedBoundary) return; // Native Web Speech boundary is active

        const elapsed = performance.now() - startTime;

        // If time has stretched beyond 1.6x estimated duration, fallback to paragraph highlight
        if (elapsed > totalEstimatedDurationMs * 1.6) {
          if (onDegradeToParagraph) {
            onDegradeToParagraph();
          }
          return;
        }

        const currentWord = words.find(
          (w) => elapsed >= w.estimatedStartTimeMs && elapsed < w.estimatedEndTimeMs
        );

        if (currentWord && currentWord.index !== lastSpokenWordIndex) {
          lastSpokenWordIndex = currentWord.index;
          if (onWord) {
            onWord({
              wordIndex: currentWord.index,
              charIndex: currentWord.charStart,
              word: currentWord.word,
            });
          }
        }
      }, 40);
    };

    // Native Web Speech boundary event (primary sync)
    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      hasReceivedBoundary = true;
      const charIdx = event.charIndex;

      let matched = words.find((w) => charIdx >= w.charStart && charIdx < w.charEnd);
      if (!matched) {
        // Approximate to nearest word boundary
        matched = words.find((w) => Math.abs(w.charStart - charIdx) <= 3);
      }

      if (matched && matched.index !== lastSpokenWordIndex) {
        lastSpokenWordIndex = matched.index;
        if (onWord) {
          onWord({
            wordIndex: matched.index,
            charIndex: matched.charStart,
            word: matched.word,
          });
        }
      }
    };

    utterance.onend = () => {
      if (activeBoundaryTimer) {
        clearInterval(activeBoundaryTimer);
        activeBoundaryTimer = null;
      }
      activeWordCallback = null;
      activeEndCallback = null;

      if (onWord) {
        onWord({ wordIndex: -1, charIndex: -1, word: '' });
      }
      if (onEnd) onEnd();
    };

    utterance.onerror = (err) => {
      console.warn('Speech synthesis silent fallback:', err);
      if (activeBoundaryTimer) {
        clearInterval(activeBoundaryTimer);
        activeBoundaryTimer = null;
      }
      activeWordCallback = null;
      activeEndCallback = null;

      if (onWord) {
        onWord({ wordIndex: -1, charIndex: -1, word: '' });
      }
      if (onEnd) onEnd();
      if (onError) onError();
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('TTS playback error, silent fallback:', err);
    if (activeBoundaryTimer) {
      clearInterval(activeBoundaryTimer);
      activeBoundaryTimer = null;
    }
    if (onWord) {
      onWord({ wordIndex: -1, charIndex: -1, word: '' });
    }
    if (onEnd) onEnd();
    if (onError) onError();
  }
}

export function stopSpeaking(): void {
  if (activeBoundaryTimer) {
    clearInterval(activeBoundaryTimer);
    activeBoundaryTimer = null;
  }

  if (activeWordCallback) {
    try {
      activeWordCallback({ wordIndex: -1, charIndex: -1, word: '' });
    } catch (e) {
      // Ignored
    }
    activeWordCallback = null;
  }

  if (activeEndCallback) {
    try {
      activeEndCallback();
    } catch (e) {
      // Ignored
    }
    activeEndCallback = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      // Ignored
    }
  }
}
