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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-[0_24px_80px_-24px_rgba(2,6,23,0.65)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-4 top-4 z-20 rounded-full bg-white/90 p-2 text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-900"
        >
          <X size={16} />
        </button>

        {header}

        <form onSubmit={onSubmit}>
          <div className="max-h-[72vh] space-y-6 overflow-y-auto p-6 sm:p-8">{children}</div>
          {footer}
        </form>
      </div>
    </div>
  );
}
