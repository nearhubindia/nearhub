import type { ReactElement, PropsWithChildren } from 'react';

export function Container({
  children,
  className = '',
}: PropsWithChildren<{ className?: string }>): ReactElement {
  return (
    <div className={['w-full px-3 sm:px-4 lg:px-5', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export default Container;
