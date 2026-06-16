import { useEffect, useRef, type RefObject } from 'react';

export function useClickAway(
  onClickAway: () => void,
  enabled: boolean,
  ...refs: Array<RefObject<HTMLElement | null>>
): void {
  const refsRef = useRef(refs);

  useEffect(() => {
    refsRef.current = refs;
  }, [refs]);

  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const clickedInside = refsRef.current.some((ref) => ref.current?.contains(target));
      if (!clickedInside) {
        onClickAway();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [enabled, onClickAway]);
}
