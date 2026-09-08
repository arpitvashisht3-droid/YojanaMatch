import React, { useMemo, useEffect, useRef } from 'react';
import { Volume2 } from 'lucide-react';

interface KaraokeExplanationProps {
  text: string;
  isPlaying: boolean;
  activeWordIndex: number | null;
  highlightMode?: 'word' | 'paragraph';
  className?: string;
  language?: 'en' | 'hi';
}

interface TextToken {
  text: string;
  isWord: boolean;
  wordIndex: number;
}

export const KaraokeExplanation: React.FC<KaraokeExplanationProps> = ({
  text,
  isPlaying,
  activeWordIndex,
  highlightMode = 'word',
  className = '',
  language = 'en',
}) => {
  const containerRef = useRef<HTMLParagraphElement>(null);

  // Parse text into whitespace-separated tokens preserving exact formatting and punctuation
  const tokens = useMemo<TextToken[]>(() => {
    const clean = text.replace(/[*_#`~]/g, '');
    const parts = clean.split(/(\s+)/);
    let wordCount = 0;

    return parts.map((part) => {
      const isWord = /\S/.test(part);
      const token: TextToken = {
        text: part,
        isWord,
        wordIndex: isWord ? wordCount++ : -1,
      };
      return token;
    });
  }, [text]);

  // Synchronized real-time DOM styling without re-rendering the whole paragraph on every word
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear any previously active word highlight
    const previousActive = container.querySelectorAll('[data-karaoke-active="true"]');
    previousActive.forEach((el) => {
      el.removeAttribute('data-karaoke-active');
      el.classList.remove(
        'bg-[#FF6B35]',
        'text-white',
        'font-bold',
        'shadow-xs',
        'rounded-xs',
        'px-1',
        'py-0.5',
        'scale-[1.04]'
      );
      el.classList.add('text-[#004D40]');
    });

    // If playback is inactive or finished, return to normal
    if (!isPlaying || highlightMode !== 'word' || activeWordIndex === null || activeWordIndex < 0) {
      return;
    }

    // Apply active highlight to target word span
    const targetSpan = container.querySelector<HTMLElement>(`[data-word-index="${activeWordIndex}"]`);
    if (targetSpan) {
      targetSpan.setAttribute('data-karaoke-active', 'true');
      targetSpan.classList.remove('text-[#004D40]');
      targetSpan.classList.add(
        'bg-[#FF6B35]',
        'text-white',
        'font-bold',
        'shadow-xs',
        'rounded-xs',
        'px-1',
        'py-0.5',
        'scale-[1.04]'
      );
    }
  }, [isPlaying, activeWordIndex, highlightMode]);

  const isParagraphActive = isPlaying && highlightMode === 'paragraph';

  return (
    <div className="space-y-2">
      {/* Visual Audio Progress Pulse Bar when audio is playing */}
      {isPlaying && (
        <div className="flex items-center gap-2 text-xs font-semibold text-[#FF6B35] animate-pulse">
          <Volume2 className="w-3.5 h-3.5 shrink-0" />
          <span>{language === 'hi' ? 'आवाज़ में पढ़ा जा रहा है...' : 'Reading aloud...'}</span>
        </div>
      )}

      <p
        ref={containerRef}
        className={`text-sm sm:text-base leading-relaxed transition-colors duration-200 ${
          isParagraphActive
            ? 'bg-[#FFF5F0] text-[#004D40] border-l-4 border-[#FF6B35] p-3 rounded-r-lg shadow-2xs'
            : 'text-[#004D40]'
        } ${className}`}
      >
        {tokens.map((token, idx) => {
          if (!token.isWord) {
            return <React.Fragment key={`space-${idx}`}>{token.text}</React.Fragment>;
          }

          const isActive = isPlaying && highlightMode === 'word' && activeWordIndex === token.wordIndex;

          return (
            <span
              key={`w-${token.wordIndex}`}
              data-word-index={token.wordIndex}
              data-karaoke-active={isActive ? 'true' : undefined}
              className={`inline-block transition-all duration-100 ease-out origin-center rounded-xs ${
                isActive
                  ? 'bg-[#FF6B35] text-white font-bold shadow-xs px-1 py-0.5 scale-[1.04]'
                  : 'text-[#004D40]'
              }`}
            >
              {token.text}
            </span>
          );
        })}
      </p>
    </div>
  );
};
