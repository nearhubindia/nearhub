import type { ReactElement } from 'react';
import { BRAND_SIGNATURE } from '@/shared/brand';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showTagline?: boolean;
  monochrome?: boolean;
  className?: string;
}

export function Logo({ size = 'md', monochrome = false, className = '' }: LogoProps): ReactElement {
  const sizes = {
    sm: { height: 40 },
    md: { height: 56 },
    lg: { height: 80 },
    xl: { height: 100 },
  };

  const { height } = sizes[size];

  return (
    <div className={`flex items-center ${className}`}>
      {/* NearHub Full Logo (includes text and tagline) */}
      <img
        src="/nearhub.png"
        alt={BRAND_SIGNATURE}
        className={`object-contain${monochrome ? ' grayscale' : ''}`}
        style={{ height: `${height}px`, width: 'auto' }}
      />
    </div>
  );
}
