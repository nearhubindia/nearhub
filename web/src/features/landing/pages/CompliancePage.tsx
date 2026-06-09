import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { LandingFooter, LandingHeader } from '@/shared/components';
import { BRAND_SIGNATURE } from '@/shared/brand';

type CompliancePageKey =
  | 'privacy-policy'
  | 'terms'
  | 'refund-policy'
  | 'about'
  | 'payment-security'
  | 'delete-account';

interface ComplianceSection {
  heading: string;
  points: string[];
}

interface CompliancePageConfig {
  tag: string;
  title: string;
  subtitle: string;
  effectiveDate: string;
  sections: ComplianceSection[];
}

const compliancePages: Record<CompliancePageKey, CompliancePageConfig> = {
  'privacy-policy': {
    tag: 'Legal',
    title: 'Privacy Policy',
    subtitle:
      'This Privacy Policy explains what data we collect, how we use it, and how we protect it.',
    effectiveDate: 'Effective date: March 12, 2026',
    sections: [
      {
        heading: 'Information We Collect',
        points: [
          'Account details such as name, phone number, email address, and profile details.',
          'Listing and communication data including ad content, chat messages, and support requests.',
          'Device and usage data such as IP address, app version, browser details, and event logs.',
          'Payment metadata from Razorpay such as order ID, payment ID, and transaction status.',
        ],
      },
      {
        heading: 'How We Use Your Data',
        points: [
          'To provide core marketplace services such as account access, ad publishing, and messaging.',
          'To process payments, generate invoices, and manage subscriptions and refunds.',
          'To prevent fraud, enforce platform safety rules, and improve reliability.',
          'To communicate service updates, support responses, and important policy changes.',
        ],
      },
      {
        heading: 'Data Sharing And Third-Party Services',
        points: [
          'We share data only with required service providers for operations, security, and payments.',
          'Payments are processed through Razorpay; NearHub does not store full card credentials.',
          'We may disclose information when legally required or to protect platform integrity.',
          'We do not sell personal information to third parties.',
        ],
      },
      {
        heading: 'Data Security And Retention',
        points: [
          'We use access controls, logging, and secure transport mechanisms to protect user data.',
          'Sensitive payment operations are handled by PCI-compliant partners such as Razorpay.',
          'Data is retained only for operational, legal, and compliance requirements.',
          'Users may request account and data support through the contact channels below.',
        ],
      },
      {
        heading: 'Contact',
        points: [
          'Email: support@nearhub.com',
          'Phone: +91 1800-123-4567',
          'Business address: Bangalore, Karnataka, India',
        ],
      },
    ],
  },
  terms: {
    tag: 'Legal',
    title: 'Terms And Conditions',
    subtitle: 'These Terms govern access to and use of NearHub services.',
    effectiveDate: 'Effective date: March 12, 2026',
    sections: [
      {
        heading: 'User Responsibilities',
        points: [
          'Users must provide accurate account and listing information.',
          'Users must not post unlawful, misleading, abusive, or prohibited content.',
          'Users are responsible for activity performed through their account credentials.',
          'Users must follow local laws and platform safety guidelines when transacting.',
        ],
      },
      {
        heading: 'Payments And Billing',
        points: [
          'Paid features are billed using pricing displayed at checkout.',
          'Payment processing is handled by Razorpay and subject to payment-network rules.',
          'Invoices are generated for successful paid transactions where applicable.',
          'NearHub may reject or cancel suspicious or non-compliant transactions.',
        ],
      },
      {
        heading: 'Refunds, Cancellations, And Disputes',
        points: [
          'Refund and cancellation handling follows the Refund Policy.',
          'Disputed transactions may be paused during verification and risk review.',
          'Approved refunds are processed to the original payment method.',
        ],
      },
      {
        heading: 'Account Suspension And Service Limitations',
        points: [
          'NearHub may suspend, limit, or remove accounts violating policy or law.',
          'Feature availability may vary by plan, region, verification status, or risk checks.',
          'NearHub is provided on an as-available basis without uninterrupted uptime guarantees.',
        ],
      },
      {
        heading: 'Contact',
        points: [
          'Email: support@nearhub.com',
          'For legal and policy enquiries: business@nearhub.com',
        ],
      },
    ],
  },
  'refund-policy': {
    tag: 'Payments',
    title: 'Refund And Cancellation Policy',
    subtitle: 'This policy explains when refunds apply and how cancellations are handled.',
    effectiveDate: 'Effective date: March 12, 2026',
    sections: [
      {
        heading: 'Refund Eligibility',
        points: [
          'Refunds are considered for duplicate charges, failed service delivery, or valid technical failures.',
          'Refund requests may be declined where services were fully consumed or policy was violated.',
          'Any promotional discounts used in the original transaction may affect refundable amounts.',
        ],
      },
      {
        heading: 'Processing Time',
        points: [
          'Approved refunds are initiated to the original payment method.',
          'Refunds are typically processed within 5-7 business days.',
          'Actual credit timelines may vary by bank, card issuer, or payment partner.',
        ],
      },
      {
        heading: 'Cancellations',
        points: [
          'Subscription cancellation requests apply to future billing cycles unless otherwise specified.',
          'Current cycle benefits may remain available until expiry where policy permits.',
          'NearHub may cancel transactions flagged for fraud or compliance risk.',
        ],
      },
      {
        heading: 'Payment Disputes',
        points: [
          'Users should first contact NearHub support with order and payment details.',
          'Chargebacks and gateway disputes are handled with Razorpay and banking partners.',
          'Dispute resolution may require supporting logs, invoices, and identity verification.',
        ],
      },
      {
        heading: 'Support Contact',
        points: ['Email: support@nearhub.com', 'Phone: +91 1800-123-4567'],
      },
    ],
  },
  about: {
    tag: 'Company',
    title: 'About NearHub',
    subtitle: 'NearHub helps people buy, sell, and discover trusted local opportunities.',
    effectiveDate: 'Updated: March 12, 2026',
    sections: [
      {
        heading: 'What We Do',
        points: [
          'NearHub is a hyperlocal classifieds platform for products and services.',
          'We combine listings, chat, and trust workflows to improve local transactions.',
          'Our focus is fast discovery, higher-quality leads, and safer interactions.',
        ],
      },
      {
        heading: 'Our Mission',
        points: [
          'Enable reliable local commerce for individuals and businesses.',
          'Reduce friction between discovery, communication, and conversion.',
          'Build a transparent marketplace that prioritizes trust and accountability.',
        ],
      },
      {
        heading: 'Company Information',
        points: [
          'NearHub Operations: Bangalore, Karnataka, India',
          'Support: support@nearhub.com',
          'Partnerships: business@nearhub.com',
        ],
      },
    ],
  },
  'payment-security': {
    tag: 'Payments',
    title: 'Payment Security',
    subtitle: 'NearHub follows secure payment handling practices with Razorpay.',
    effectiveDate: 'Updated: March 12, 2026',
    sections: [
      {
        heading: 'Secure Processing',
        points: [
          'All online payments are processed securely through Razorpay.',
          'NearHub does not store full card numbers, CVV, or internet banking credentials.',
          'Payment requests are validated server-side before service activation.',
        ],
      },
      {
        heading: 'Fraud Prevention',
        points: [
          'Payment signatures and order references are verified before confirming transactions.',
          'Suspicious activity can be blocked, reversed, or escalated for manual review.',
          'Users may be asked for additional verification in high-risk payment scenarios.',
        ],
      },
      {
        heading: 'Support',
        points: [
          'For payment issues, contact support@nearhub.com with order ID and payment ID.',
          'For unresolved disputes, users can also raise tickets through Razorpay channels.',
        ],
      },
    ],
  },
  'delete-account': {
    tag: 'Account',
    title: 'Delete Account',
    subtitle: 'Request permanent deletion of your NearHub account and associated personal data.',
    effectiveDate: 'Updated: March 16, 2026',
    sections: [
      {
        heading: 'How To Request Deletion',
        points: [
          'Open the NearHub app and go to Settings -> Delete Account.',
          'Tap Request Account Deletion and confirm the request.',
          'If you cannot access the app, email support@nearhub.com from your registered account email/phone.',
        ],
      },
      {
        heading: 'What Is Deleted',
        points: [
          'Your profile information and account access credentials.',
          'Your active listings and associated public profile visibility.',
          'Your app session tokens and notification registrations.',
        ],
      },
      {
        heading: 'What May Be Retained',
        points: [
          'Transaction/invoice records retained for legal, tax, fraud, and compliance obligations.',
          'Minimal audit logs required for security and dispute resolution.',
        ],
      },
      {
        heading: 'Deletion Timeline',
        points: [
          'Most account data is removed within 7 business days after verification.',
          'Compliance-related records are retained only for the legally required duration.',
        ],
      },
      {
        heading: 'Support Contact',
        points: ['Email: support@nearhub.com'],
      },
    ],
  },
};

export default function CompliancePage({ pageKey }: { pageKey: CompliancePageKey }): ReactElement {
  const config = compliancePages[pageKey];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#edf5ff_46%,#fff5ea_100%)] text-slate-900">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_10%,rgba(30,93,168,0.16),transparent_34%),radial-gradient(circle_at_92%_14%,rgba(255,153,51,0.18),transparent_32%),radial-gradient(circle_at_50%_92%,rgba(30,93,168,0.09),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(30,93,168,0.03)_1px,transparent_1px),linear-gradient(0deg,rgba(255,153,51,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <LandingHeader active="home" />

      <main className="pt-20">
        <div className="w-full px-4 pb-16 pt-8 sm:px-8 lg:px-12">
          <section className="rounded-[2rem] border border-[#1e5da8]/20 bg-[linear-gradient(125deg,#0f4684_0%,#1e5da8_42%,#ff9933_165%)] px-6 py-8 text-white shadow-[0_34px_72px_-40px_rgba(14,63,120,0.78)] sm:px-9 sm:py-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]">
              {config.tag}
            </p>
            <h1 className="mt-4 max-w-5xl text-3xl font-bold leading-tight sm:text-5xl">
              {config.title}
            </h1>
            <p className="mt-4 max-w-4xl text-sm leading-relaxed text-blue-50/95 sm:text-base">
              {config.subtitle}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#ffe5c8]">
              {BRAND_SIGNATURE}
            </p>
            <p className="mt-3 text-sm font-semibold text-[#ffe5c8]">{config.effectiveDate}</p>
          </section>

          <section className="mt-8 grid gap-5 md:grid-cols-2">
            {config.sections.map((section) => (
              <article
                key={section.heading}
                className="group relative overflow-hidden rounded-xl border border-[#1e5da8]/14 bg-[linear-gradient(180deg,#ffffff_0%,#f3f8ff_100%)] p-6 shadow-[0_16px_34px_-26px_rgba(14,63,120,0.52)] transition duration-300 hover:-translate-y-1 hover:border-[#1e5da8]/30 hover:shadow-[0_24px_42px_-24px_rgba(30,93,168,0.66)]"
              >
                <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-[#ff9933]/12 blur-2xl transition group-hover:bg-[#ff9933]/18" />
                <h2 className="text-2xl font-bold text-[#113965]">{section.heading}</h2>
                <ul className="mt-4 space-y-2">
                  {section.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-slate-600">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#ff9933]" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          <section className="mt-9 overflow-hidden rounded-[2rem] border border-[#1e5da8]/18 bg-[linear-gradient(120deg,#0f3f78_0%,#1e5da8_58%,#ff9933_165%)] px-6 py-8 text-white shadow-[0_30px_62px_-38px_rgba(15,63,120,0.8)] sm:px-9 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div>
              <h3 className="text-3xl font-bold leading-tight sm:text-4xl">Need Help?</h3>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-blue-50/95 sm:text-base">
                Contact support for policy questions, billing issues, or compliance requests.
              </p>
            </div>
            <div className="mt-5 lg:mt-0">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-lg bg-[#ff9933] px-4 py-2 text-xs font-bold text-slate-900 shadow-[0_14px_34px_-18px_rgba(255,153,51,0.95)] transition hover:bg-[#ffad57]"
              >
                Contact Support
                <ArrowRight size={18} />
              </Link>
            </div>
          </section>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
