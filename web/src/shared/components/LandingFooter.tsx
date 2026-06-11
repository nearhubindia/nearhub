import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";
import { Logo } from "@/shared/components/Logo";
import { Container } from "./Container";

const platformLinks = [
  ["Browse Listings", "/footer/browse-listings"],
  ["Post an Ad", "/footer/post-an-ad"],
  ["Categories", "/footer/categories"],
  ["Mobile App", "/footer/mobile-app"],
];

const companyLinks = [
  ["About Us", "/about"],
  ["Careers", "/footer/careers"],
  ["Blog", "/footer/blog"],
  ["Press Kit", "/footer/press-kit"],
  ["Contact Us", "/contact"],
];

const supportLinks = [
  ["Help Center", "/footer/help-center"],
  ["Safety Tips", "/footer/safety-tips"],
  ["Terms of Service", "/terms"],
  ["Privacy Policy", "/privacy-policy"],
  ["Refund Policy", "/refund-policy"],
  ["Payment Security", "/payment-security"],
  ["Report Issue", "/footer/report-issue"],
];

function FooterColumn({
  title,
  links,
  className = "",
  mobileHiddenLinks = [],
}: {
  title: string;
  links: string[][];
  className?: string;
  mobileHiddenLinks?: string[];
}): ReactElement {
  return (
    <div className={className}>
      <h3 className="text-base font-black text-white md:text-lg">{title}</h3>
      <ul className="mt-4 space-y-3 md:space-y-2.5">
        {links.map(([label, to]) => (
          <li
            key={label}
            className={
              mobileHiddenLinks.includes(label) ? "hidden md:list-item" : ""
            }
          >
            <Link
              to={to}
              className="text-sm font-medium leading-6 text-blue-100/85 transition hover:text-[#ffb04a]"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingFooter(): ReactElement {
  return (
    <footer className="bg-[linear-gradient(135deg,#00234b_0%,#00152f_52%,#00305f_100%)] text-white">
      <Container className="py-10">
        <div className="max-md:px-3">
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-2 md:gap-10 lg:grid-cols-[1.35fr_0.75fr_0.75fr_0.9fr]">
            <div className="col-span-2 md:col-span-1">
              <Logo size="md" />
              <p className="mt-4 max-w-sm text-sm leading-6 text-blue-100/85">
                NearHub - Buy, Sell & Discover Local Deals Near You. Buy, sell
                and connect with trusted local listings, deals, and services
                across India.
              </p>
              <div className="mt-5 flex gap-3">
                {[
                  [Facebook, "https://www.facebook.com"],
                  [Instagram, "https://www.instagram.com"],
                  [Twitter, "https://x.com"],
                  [Youtube, "https://www.youtube.com"],
                ].map(([Icon, href]) => (
                  <a
                    key={href as string}
                    href={href as string}
                    target="_blank"
                    rel="noreferrer"
                    className="grid h-10 w-10 place-items-center rounded-full bg-white/12 text-white transition hover:bg-[#0759e6]"
                  >
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            </div>

            <FooterColumn title="Platform" links={platformLinks} />
            <FooterColumn title="Company" links={companyLinks} />
            <FooterColumn
              title="Support"
              links={supportLinks}
              className="col-span-2 md:col-span-1"
              mobileHiddenLinks={[
                "Terms of Service",
                "Privacy Policy",
                "Refund Policy",
              ]}
            />
          </div>

          <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-blue-100/80 md:mt-10 md:flex-row md:items-center md:justify-between">
            <p>
              © 2026 <span className="font-black text-[#ffb04a]">NearHub</span>.
              All rights reserved.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Link to="/terms" className="hover:text-[#ffb04a]">
                Terms
              </Link>
              <Link to="/privacy-policy" className="hover:text-[#ffb04a]">
                Privacy
              </Link>
              <Link to="/refund-policy" className="hover:text-[#ffb04a]">
                Refunds
              </Link>
              <Link to="/footer/cookies" className="hover:text-[#ffb04a]">
                Cookies
              </Link>
              <Link to="/footer/sitemap" className="hover:text-[#ffb04a]">
                Sitemap
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}
