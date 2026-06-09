import type { LucideIcon } from 'lucide-react';
import { statIconClass, type DealStatTone } from '../lib/deal-bookings';

export type DealStatCard = {
  label: string;
  value: number;
  caption: string;
  icon: LucideIcon;
  tone: DealStatTone;
};

export function DealStatsGrid({
  cards,
  emphasis = 'normal',
}: {
  cards: DealStatCard[];
  emphasis?: 'normal' | 'strong';
}) {
  const labelWeight = emphasis === 'strong' ? 'font-semibold' : 'font-normal';
  const valueWeight = emphasis === 'strong' ? 'font-medium' : 'font-normal';
  const captionWeight = emphasis === 'strong' ? 'font-medium' : 'font-normal';

  return (
    <section className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.label}
            className="rounded-2xl border border-[#d2e2f7] bg-white p-6 shadow-[0_20px_50px_-40px_rgba(30,93,168,0.82)]"
          >
            <div className="flex items-center gap-5">
              <span
                className={`grid h-16 w-16 shrink-0 place-items-center rounded-full ${statIconClass(card.tone)}`}
              >
                <Icon size={31} />
              </span>
              <div>
                <p className={`text-sm ${labelWeight} text-[#1e3d67]`}>{card.label}</p>
                <p className={`mt-2 text-3xl ${valueWeight} text-[#061b44]`}>{card.value}</p>
                <p className={`mt-4 text-sm ${captionWeight} text-[#5d718f]`}>{card.caption}</p>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
