import type { ReactNode } from "react";
import { CurrencyDollarIcon, UserIcon, ClockIcon, EyeIcon, ShareIcon, StarIcon } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ReferralLink } from "@/components/earnings/referral-link";

function AnalyticsCard({ icon, value, label, detail, action }: {
  icon?: ReactNode;
  value: ReactNode;
  label: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <Card>
      {icon ? <CardHeader><span className="text-muted-foreground" aria-hidden="true">{icon}</span></CardHeader> : null}
      <CardContent className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="flex items-center gap-1 font-heading text-[32px] leading-tight font-medium tracking-[-1px] tabular-nums">{value}</p>
          {detail ? <span className="text-sm text-muted-foreground tabular-nums">{detail}</span> : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardDescription>{label}</CardDescription>
          {action}
        </div>
      </CardContent>
    </Card>
  );
}

const activity = [
  { label: "Total trading volume (24h)", value: "$0.00" },
  { label: "Total minute volume (24h)", value: "0 min" },
  { label: "DMs", value: "0" },
];

export function EarningsAnalytics() {
  return (
    <section aria-labelledby="analytics-heading" className="space-y-6">
      <h2 id="analytics-heading" className="font-heading text-[32px] font-medium tracking-[-1px]">Analytics</h2>
      <section aria-labelledby="time-market-heading" className="space-y-3">
        <h3 id="time-market-heading" className="text-base font-medium">Your time market</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <AnalyticsCard icon={<CurrencyDollarIcon size={24} />} value="$0.17" detail="0.00%" label="Your minute price" />
          <AnalyticsCard icon={<UserIcon size={24} />} value="0" label="Total holders" />
          <AnalyticsCard icon={<ClockIcon size={24} />} value="$0.00" label="Market cap" />
        </div>
      </section>
      <section aria-labelledby="profile-analytics-heading" className="space-y-3">
        <h3 id="profile-analytics-heading" className="text-base font-medium">Your profile</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <AnalyticsCard icon={<EyeIcon size={24} />} value="0" label="Profile views" />
          <AnalyticsCard icon={<ShareIcon size={24} />} value="0" label="Referrals" action={<ReferralLink />} />
          <AnalyticsCard icon={<StarIcon size={24} />} value={<><StarIcon size={20} weight="fill" aria-hidden="true" />5</>} label="Rating · 0 reviews" />
        </div>
      </section>
      <section aria-labelledby="activity-heading" className="space-y-3">
        <h3 id="activity-heading" className="text-base font-medium">Activity</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {activity.map((metric) => <AnalyticsCard key={metric.label} value={metric.value} label={metric.label} />)}
        </div>
      </section>
    </section>
  );
}
