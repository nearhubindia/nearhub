import { type ReactElement } from 'react';
import { ArrowLeft, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LandingFooter, LandingHeader } from '@/shared/components';

export default function NotFound(): ReactElement {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#edf5ff_46%,#fff5ea_100%)] text-slate-900">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_10%,rgba(30,93,168,0.16),transparent_34%),radial-gradient(circle_at_92%_14%,rgba(255,153,51,0.18),transparent_32%),radial-gradient(circle_at_50%_92%,rgba(30,93,168,0.09),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(30,93,168,0.03)_1px,transparent_1px),linear-gradient(0deg,rgba(255,153,51,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <LandingHeader active="home" />

      <main className="pt-20">
        <section className="w-full px-4 pb-16 pt-10 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl rounded-[2rem] border border-[#1e5da8]/20 bg-white/92 px-6 py-10 text-center shadow-[0_26px_56px_-36px_rgba(30,93,168,0.68)] backdrop-blur-sm sm:px-10 sm:py-12">
            <div className="mx-auto inline-flex rounded-2xl bg-gradient-to-br from-[#1e5da8] to-[#ff9933] p-4 text-white shadow-[0_18px_36px_-22px_rgba(30,93,168,0.78)]">
              <SearchX size={28} />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#ff9933]">
              Error 404
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-[#113965] sm:text-5xl">
              Page Not Found
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              This URL is not available right now. Go back to NearHub to buy, sell, and discover
              local deals near you.
            </p>

            <div className="mt-7 flex justify-center">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl bg-[#1e5da8] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_-18px_rgba(30,93,168,0.95)] transition hover:bg-[#2b71c5]"
              >
                <ArrowLeft size={16} />
                Back To Home
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
