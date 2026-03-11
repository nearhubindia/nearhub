import { useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';

type NavKey = 'home' | 'features' | 'contact';

interface LandingHeaderProps {
  active: NavKey;
}

function navLinkClass(isActive: boolean): string {
  return isActive ? 'text-[#1e5da8]' : 'text-slate-600 transition hover:text-[#ff9933]';
}

export function LandingHeader({ active }: LandingHeaderProps): ReactElement {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <Link to="/" onClick={() => setIsMenuOpen(false)} className="shrink-0">
            <Logo size="md" showText={true} className="md:hidden" />
            <Logo size="lg" showText={true} className="hidden md:flex" />
          </Link>

          <div className="hidden items-center gap-6 text-sm font-semibold sm:text-base md:flex">
            <Link to="/" className={navLinkClass(active === 'home')}>
              Home
            </Link>
            <Link to="/features" className={navLinkClass(active === 'features')}>
              Features
            </Link>
            <Link to="/contact" className={navLinkClass(active === 'contact')}>
              Contact
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700 md:hidden"
            aria-label="Toggle navigation menu"
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="border-t border-slate-200 py-3 md:hidden">
            <div className="flex flex-col gap-2 text-sm font-semibold">
              <Link
                to="/"
                className={`rounded-lg px-3 py-2 ${navLinkClass(active === 'home')}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/features"
                className={`rounded-lg px-3 py-2 ${navLinkClass(active === 'features')}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Features
              </Link>
              <Link
                to="/contact"
                className={`rounded-lg px-3 py-2 ${navLinkClass(active === 'contact')}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Contact
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
