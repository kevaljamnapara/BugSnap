import bugsnapMarkUrl from '../assets/brand/bugsnap-mark.png';

export interface BrandMarkProps {
  size?: number;
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
}

export function BrandMark({
  size = 24,
  width,
  height,
  className = 'brand-mark-img',
  alt = '',
}: BrandMarkProps) {
  const finalWidth = width ?? size;
  const finalHeight = height ?? size;

  return (
    <img
      src={bugsnapMarkUrl}
      width={finalWidth}
      height={finalHeight}
      alt={alt}
      draggable={false}
      decoding="async"
      className={className}
      data-testid="brand-mark-img"
    />
  );
}
