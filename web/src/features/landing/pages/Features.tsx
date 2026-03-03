import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  Users,
  TrendingUp,
  Shield,
} from 'lucide-react';
import { LandingFooter, Logo } from '@/shared/components';

export default function Features(): ReactElement {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-20 gap-8 sm:gap-10">
            <Link to="/">
              <Logo size="lg" showText={true} />
            </Link>
            <div className="flex items-center gap-4 sm:gap-8">
              <Link to="/" className="text-slate-600 hover:text-[#1e5da8] transition font-medium">
                Home
              </Link>
              <Link
                to="/features"
                className="text-[#1e5da8] font-semibold border-b-2 border-[#1e5da8]"
              >
                Features
              </Link>
              <Link
                to="/contact"
                className="text-slate-600 hover:text-[#1e5da8] transition font-medium"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Features Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl sm:text-6xl font-black mb-6">
              <span className="bg-gradient-to-r from-[#1e5da8] to-[#ff9933] bg-clip-text text-transparent">
                Why Choose NearHub?
              </span>
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Everything you need for successful buying, selling, and connecting. Built with modern technology
              and designed for the Indian market.
            </p>
          </div>

          {/* Main Features Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            {[
              {
                Icon: Zap,
                title: 'Lightning Fast',
                desc: 'Optimized for speed with instant search and real-time notifications for your listings.',
              },
              {
                Icon: Users,
                title: 'Large Community',
                desc: 'Connect with thousands of buyers, sellers, and service providers worldwide.',
              },
              {
                Icon: TrendingUp,
                title: 'Grow Your Business',
                desc: 'Advanced analytics and promotion tools to boost your sales and reach.',
              },
              {
                Icon: Shield,
                title: 'Secure & Safe',
                desc: 'Your privacy matters. All transactions are secure with verified user profiles.',
              },
            ].map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="group bg-white/80 border border-blue-100 hover:border-[#1e5da8]/30 rounded-xl p-8 backdrop-blur transition hover:shadow-xl hover:translate-y-[-4px]"
              >
                <Icon className="text-[#1e5da8] mb-4 group-hover:text-[#ff9933] transition" size={40} />
                <h3 className="text-2xl font-bold text-slate-900 mb-3">{title}</h3>
                <p className="text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Additional Features */}
          <div className="bg-gradient-to-br from-[#1e5da8]/5 via-white to-[#ff9933]/5 rounded-2xl p-8 md:p-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">More Features You'll Love</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { title: 'Video Listings', desc: 'Upload short-form and long-form videos to showcase products' },
                { title: 'AI Moderation', desc: 'Automatic content validation for safety and quality' },
                { title: 'Geo-Location', desc: 'Find listings near you with smart location search' },
                { title: 'Multi-Language', desc: 'Support for multiple Indian languages' },
                { title: 'Payment Integration', desc: 'Built-in payment processing with Razorpay' },
                { title: 'Analytics Dashboard', desc: 'Track views, engagement, and performance' },
              ].map(({ title, desc }) => (
                <div key={title} className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition">
                  <h4 className="font-bold text-slate-900 mb-2">{title}</h4>
                  <p className="text-sm text-slate-600">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center mt-16">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Ready to Experience NearHub?</h3>
            <Link
              to="/contact"
              className="inline-block bg-gradient-to-r from-[#1e5da8] to-[#ff9933] hover:from-[#1a4d8f] hover:to-[#ff8820] text-white px-10 py-4 rounded-lg font-bold transition transform hover:scale-105 shadow-xl shadow-[#1e5da8]/30"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
