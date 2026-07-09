import type { ReactElement } from 'react';

const WHATSAPP_NUMBER = '919704569280';
const WHATSAPP_MESSAGE = 'Hi NearHub, I want to post a deal.';
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

function WhatsAppIcon(): ReactElement {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-6 w-6 fill-current">
      <path d="M19.11 17.21c-.27-.14-1.58-.78-1.82-.87-.24-.09-.42-.14-.59.14-.17.27-.68.87-.83 1.05-.15.18-.3.2-.56.07-.27-.14-1.11-.41-2.11-1.31-.78-.69-1.31-1.54-1.46-1.8-.15-.27-.02-.41.11-.55.12-.12.27-.3.41-.45.13-.15.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.59-1.43-.81-1.96-.21-.5-.43-.43-.59-.44h-.5c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.29 0 1.35.98 2.65 1.12 2.83.14.18 1.92 2.94 4.66 4.12.65.28 1.16.45 1.56.57.66.21 1.27.18 1.75.11.53-.08 1.58-.64 1.8-1.27.22-.62.22-1.16.15-1.27-.06-.12-.24-.18-.5-.31Z" />
      <path d="M16.02 3.2c-7.05 0-12.77 5.72-12.77 12.77 0 2.25.59 4.46 1.72 6.4L3.2 28.8l6.57-1.72a12.78 12.78 0 0 0 6.25 1.61h.01c7.05 0 12.77-5.72 12.77-12.77S23.07 3.2 16.02 3.2Zm0 23.34h-.01a10.6 10.6 0 0 1-5.41-1.49l-.39-.23-3.9 1.02 1.04-3.8-.25-.39a10.6 10.6 0 0 1-1.63-5.65c0-5.86 4.77-10.63 10.64-10.63 2.84 0 5.51 1.11 7.51 3.11a10.56 10.56 0 0 1 3.12 7.51c0 5.87-4.77 10.64-10.64 10.64Z" />
    </svg>
  );
}

export function WhatsAppFloatingButton(): ReactElement {
  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noreferrer"
      aria-label="Message NearHub on WhatsApp at +91 97045 69280"
      title="Message +91 97045 69280 on WhatsApp"
      className="fixed bottom-5 right-4 z-[90] flex items-center gap-2 sm:bottom-6 sm:right-6"
    >
      <span className="rounded-full bg-[#0f172a] px-3 py-1.5 text-xs font-medium text-white shadow-[0_14px_30px_rgba(15,23,42,0.22)]">
        Post a Deal
      </span>
      <span className="grid h-16 w-16 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_18px_40px_rgba(9,77,40,0.35)] transition hover:-translate-y-0.5 hover:scale-[1.03] hover:bg-[#1fb857] sm:h-[4.5rem] sm:w-[4.5rem]">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-white/18 sm:h-14 sm:w-14">
          <span className="scale-150 sm:scale-[1.6]">
            <WhatsAppIcon />
          </span>
        </span>
      </span>
    </a>
  );
}
