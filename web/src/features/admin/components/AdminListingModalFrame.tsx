import type { FormEvent, ReactNode } from 'react';
import { X } from 'lucide-react';

type AdminListingModalFrameProps = {
  onClose: () => void;
  onSubmit: (event: FormEvent) => void | Promise<void>;
  header: ReactNode;
  children: ReactNode;
  footer: ReactNode;
};

export function AdminListingModalFrame({
  onClose,
  onSubmit,
  header,
  children,
  footer,
}: AdminListingModalFrameProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:p-6">
      <div className="relative w-full max-w-[min(96vw,56rem)] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-[0_24px_80px_-24px_rgba(2,6,23,0.65)] sm:rounded-3xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-3 top-3 z-20 rounded-full bg-white/90 p-2 text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-900 sm:right-4 sm:top-4"
        >
          <X size={16} />
        </button>

        {header}

        <form onSubmit={onSubmit}>
          <div className="max-h-[80vh] space-y-5 overflow-y-auto p-4 sm:space-y-6 sm:p-8">
            {children}
          </div>
          {footer}
        </form>
      </div>
    </div>
  );
}
