import type { ReactElement } from 'react';

import { Logo } from '@/shared/components/Logo';

export function LandingFooter(): ReactElement {
  return (
    <footer className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div className="space-y-4">
            <div className="mb-4 bg-white/95 rounded-lg p-3 w-fit">
              <Logo size="md" />
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              The leading classifieds platform connecting buyers, sellers, and service providers across India.
            </p>
            <div className="flex gap-3 pt-2">
              <a href="#" className="w-10 h-10 bg-slate-700/50 hover:bg-[#1e5da8] rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110">
                <span className="text-lg">𝕏</span>
              </a>
              <a href="#" className="w-10 h-10 bg-slate-700/50 hover:bg-[#1e5da8] rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110">
                <span className="text-lg">f</span>
              </a>
              <a href="#" className="w-10 h-10 bg-slate-700/50 hover:bg-[#1e5da8] rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110">
                <span className="text-lg">in</span>
              </a>
              <a href="#" className="w-10 h-10 bg-slate-700/50 hover:bg-[#1e5da8] rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110">
                <span className="text-lg">📷</span>
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4 text-white">Platform</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-slate-300 hover:text-[#ff9933] transition text-sm">Browse Listings</a></li>
              <li><a href="#" className="text-slate-300 hover:text-[#ff9933] transition text-sm">Post an Ad</a></li>
              <li><a href="#" className="text-slate-300 hover:text-[#ff9933] transition text-sm">Categories</a></li>
              <li><a href="#" className="text-slate-300 hover:text-[#ff9933] transition text-sm">Mobile App</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4 text-white">Company</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-slate-300 hover:text-[#ff9933] transition text-sm">About Us</a></li>
              <li><a href="#" className="text-slate-300 hover:text-[#ff9933] transition text-sm">Careers</a></li>
              <li><a href="#" className="text-slate-300 hover:text-[#ff9933] transition text-sm">Blog</a></li>
              <li><a href="#" className="text-slate-300 hover:text-[#ff9933] transition text-sm">Press Kit</a></li>
              <li><a href="#" className="text-slate-300 hover:text-[#ff9933] transition text-sm">Contact Us</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4 text-white">Support</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-slate-300 hover:text-[#ff9933] transition text-sm">Help Center</a></li>
              <li><a href="#" className="text-slate-300 hover:text-[#ff9933] transition text-sm">Safety Tips</a></li>
              <li><a href="#" className="text-slate-300 hover:text-[#ff9933] transition text-sm">Terms of Service</a></li>
              <li><a href="#" className="text-slate-300 hover:text-[#ff9933] transition text-sm">Privacy Policy</a></li>
              <li><a href="#" className="text-slate-300 hover:text-[#ff9933] transition text-sm">Report Issue</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">
              &copy; 2026 <span className="text-[#ff9933] font-semibold">NearHub</span>. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm">
              <a href="#" className="text-slate-400 hover:text-[#ff9933] transition">Terms</a>
              <a href="#" className="text-slate-400 hover:text-[#ff9933] transition">Privacy</a>
              <a href="#" className="text-slate-400 hover:text-[#ff9933] transition">Cookies</a>
              <a href="#" className="text-slate-400 hover:text-[#ff9933] transition">Sitemap</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}