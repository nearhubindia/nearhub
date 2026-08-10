import { useEffect, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

type AdminDrawerProps = {
  onClose: () => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
  panelClassName?: string;
  ariaLabel?: string;
};

/**
 * Shared admin surface for create/edit flows.
 *
 * Keeping the drawer shell in one place makes every admin form behave the
 * same way: full-height on desktop, edge-to-edge on mobile, independently
 * scrollable content, and actions that stay visible at the bottom.
 */
export default function AdminDrawer({
  onClose,
  onSubmit,
  header,
  children,
  footer,
  bodyClassName = 'space-y-5 p-5 sm:space-y-6 sm:p-7',
  panelClassName = 'sm:w-[min(94vw,46rem)] lg:w-[min(76vw,60rem)]',
  ariaLabel = 'Admin form',
}: AdminDrawerProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const content = (
    <>
      <div className="shrink-0">{header}</div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={`admin-drawer-scroll min-h-0 min-w-0 flex-1 overflow-y-auto ${bodyClassName}`}
        >
          {children}
        </div>
        {footer ? <div className="admin-drawer-footer shrink-0">{footer}</div> : null}
      </div>
    </>
  );

  return (
    <div
      className="fixed inset-0 z-[80] h-[100dvh] min-h-0 w-full max-w-full overflow-hidden overscroll-none"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/45 backdrop-blur-[2px] transition-opacity"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`admin-drawer-panel absolute inset-y-0 right-0 flex h-full min-h-0 max-h-full w-full max-w-full flex-col overflow-hidden border-l border-slate-200 bg-slate-50 text-slate-900 shadow-[-24px_0_70px_-36px_rgba(15,23,42,0.7)] ${panelClassName}`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close drawer"
          className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 touch-manipulation items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-white shadow-sm transition hover:border-slate-600 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-4 focus:ring-slate-300"
        >
          <X size={18} />
        </button>

        {onSubmit ? (
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            {content}
          </form>
        ) : (
          content
        )}
      </aside>
    </div>
  );
}
