import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

export interface AdminActionMenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

interface AdminActionMenuProps {
  items: AdminActionMenuItem[];
  label?: string;
}

export default function AdminActionMenu({ items, label = 'Row actions' }: AdminActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const closeOnViewportChange = (): void => setIsOpen(false);

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [isOpen]);

  const toggleMenu = (): void => {
    if (!buttonRef.current) return;

    if (!isOpen) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 176;
      const menuHeight = Math.max(88, items.length * 40 + 12);
      const gap = 8;
      const top =
        rect.bottom + gap + menuHeight > window.innerHeight
          ? Math.max(8, rect.top - gap - menuHeight)
          : rect.bottom + gap;
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        Math.max(8, window.innerWidth - menuWidth - 8)
      );
      setPosition({ top, left });
    }

    setIsOpen((current) => !current);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggleMenu}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-cyan-100"
      >
        <MoreVertical size={18} />
      </button>

      {isOpen
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={label}
              className="fixed z-[100] w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
              style={{ top: position.top, left: position.left }}
            >
              {items.map((item) => {
                const isDanger = item.tone === 'danger';
                return (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      if (item.disabled) return;
                      setIsOpen(false);
                      item.onSelect();
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      isDanger
                        ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                        : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
