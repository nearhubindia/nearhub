import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { Logo } from '@/shared/components/Logo';

export function LandingFooter(): ReactElement {
  return (
    <footer className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 sm:pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div className="space-y-4">
            <div className="mb-4 bg-white/95 rounded-lg p-3 w-fit">
              <Logo size="md" />
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              The leading classifieds platform connecting buyers, sellers, and service providers
              across India.
            </p>
            <div className="flex gap-3 pt-2">
              <a
                href="#"
                className="w-10 h-10 bg-slate-700/50 hover:bg-[#1e5da8] rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
              >
                <span className="text-lg">𝕏</span>
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-slate-700/50 hover:bg-[#1e5da8] rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
              >
                <span className="text-lg">f</span>
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-slate-700/50 hover:bg-[#1e5da8] rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
              >
                <span className="text-lg">in</span>
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-slate-700/50 hover:bg-[#1e5da8] rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
              >
                <span className="text-lg">📷</span>
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4 text-white">Platform</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/footer/browse-listings"
                  className="text-slate-300 hover:text-[#ff9933] transition text-sm"
                >
                  Browse Listings
                </Link>
              </li>
              <li>
                <Link
                  to="/footer/post-an-ad"
                  className="text-slate-300 hover:text-[#ff9933] transition text-sm"
                >
                  Post an Ad
                </Link>
              </li>
              <li>
                <Link
                  to="/footer/categories"
                  className="text-slate-300 hover:text-[#ff9933] transition text-sm"
                >
                  Categories
                </Link>
              </li>
              <li>
                <Link
                  to="/footer/mobile-app"
                  className="text-slate-300 hover:text-[#ff9933] transition text-sm"
                >
                  Mobile App
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4 text-white">Company</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/footer/about-us"
                  className="text-slate-300 hover:text-[#ff9933] transition text-sm"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  to="/footer/careers"
                  className="text-slate-300 hover:text-[#ff9933] transition text-sm"
                >
                  Careers
                </Link>
              </li>
              <li>
                <Link
                  to="/footer/blog"
                  className="text-slate-300 hover:text-[#ff9933] transition text-sm"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  to="/footer/press-kit"
                  className="text-slate-300 hover:text-[#ff9933] transition text-sm"
                >
                  Press Kit
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-slate-300 hover:text-[#ff9933] transition text-sm"
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4 text-white">Support</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/footer/help-center"
                  className="text-slate-300 hover:text-[#ff9933] transition text-sm"
                >
                  Help Center
                </Link>
              </li>
              <li>
                <Link
                  to="/footer/safety-tips"
                  className="text-slate-300 hover:text-[#ff9933] transition text-sm"
                >
                  Safety Tips
                </Link>
              </li>
              <li>
                <Link
                  to="/footer/terms-of-service"
                  className="text-slate-300 hover:text-[#ff9933] transition text-sm"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  to="/footer/privacy-policy"
                  className="text-slate-300 hover:text-[#ff9933] transition text-sm"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/footer/report-issue"
                  className="text-slate-300 hover:text-[#ff9933] transition text-sm"
                >
                  Report Issue
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 rounded-xl border border-slate-600/70 bg-slate-950/85 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-200 text-sm">
              &copy; 2026 <span className="text-[#ff9933] font-semibold">NearHub</span>. All rights
              reserved.
            </p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm md:justify-end">
              <Link
                to="/footer/terms-of-service"
                className="text-slate-100 hover:text-[#ff9933] transition font-medium"
              >
                Terms
              </Link>
              <Link
                to="/footer/privacy-policy"
                className="text-slate-100 hover:text-[#ff9933] transition font-medium"
              >
                Privacy
              </Link>
              <Link
                to="/footer/cookies"
                className="text-slate-100 hover:text-[#ff9933] transition font-medium"
              >
                Cookies
              </Link>
              <Link
                to="/footer/sitemap"
                className="text-slate-100 hover:text-[#ff9933] transition font-medium"
              >
                Sitemap
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
