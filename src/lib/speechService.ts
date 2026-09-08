/**
 * Speech Service: Handles Speech-to-Text (Voice Input) and Text-to-Speech (Playback)
 * with robust silent fallbacks and full Hindi / English support.
 */

// Speech Recognition instance
let recognitionInstance: any = null;

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function startSpeechRecognition(
  language: 'en' | 'hi',
  onResult: (transcript: string, isFinal: boolean) => void,
  onError?: () => void,
  onEnd?: () => void
): () => void {
  if (!isSpeechRecognitionSupported()) {
    if (onError) onError();
    return () => {};
  }

  try {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionInstance = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';

    recognition.onresult = (event: any) => {
      let fullTranscript = '';
      let isFinal = false;

      for (let i = 0; i < event.results.length; ++i) {
        const item = event.results[i];
        fullTranscript += item[0].transcript;
        if (item.isFinal) {
          isFinal = true;
        }
      }

      onResult(fullTranscript, isFinal);
    };

    recognition.onerror = (e: any) => {
      console.warn('Speech recognition silent error handled:', e);
      if (onError) onError();
    };

    recognition.onend = () => {
      if (onEnd) onEnd();
    };

    recognition.start();

    return () => {
      try {
        recognition.stop();
      } catch (e) {
        // Ignored
      }
    };
  } catch (err) {
    console.warn('Speech recognition initiation failed, silently falling back to text:', err);
    if (onError) onError();
    return () => {};
  }
}

export function stopSpeechRecognition(): void {
  if (recognitionInstance) {
    try {
      recognitionInstance.stop();
    } catch (e) {
      // Ignored
    }
    recognitionInstance = null;
  }
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
