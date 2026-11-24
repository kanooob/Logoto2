import { useState } from 'react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel: string;
}

export function ResilientImage({
  src,
  alt,
  className = '',
  fallbackLabel,
}: ResilientImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#2f3136] via-[#36393f] to-[#292b2f] border border-white/10 text-center p-4 ${className}`}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="text-[#a3ab72] mb-2"
        >
          <rect
            x="3"
            y="4"
            width="18"
            height="17"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path d="M3 9h18" stroke="currentColor" strokeWidth="1.75" />
          <path d="M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
        <span className="text-xs font-medium text-[#b9bbbe]">{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
