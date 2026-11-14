"use client";

import { useEffect, useState } from "react";
import { ChatCircleDotsIcon, ChatsTeardropIcon, CheckIcon, TrashIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { ServicePricingDialog, type ServicePricing } from "@/components/dialogs/service-pricing-dialog";

type ServiceCardProps = {
  type: "dms" | "group";
  active: boolean;
  onActivate: (pricing: ServicePricing) => void;
  isActivating?: boolean;
  initialPricing?: ServicePricing;
  onDeactivate?: () => void;
};

export function ServiceCard({ type, active, onActivate, isActivating, initialPricing, onDeactivate }: ServiceCardProps) {
  const isDms = type === "dms";
  const [pricing, setPricing] = useState<ServicePricing>(initialPricing ?? { unit: "minutes", amount: isDms ? 1 : 25 });
  useEffect(() => {
    if (initialPricing) setPricing(initialPricing);
  }, [initialPricing]);
  const priceLabel = `${pricing.amount} ${pricing.unit === "usdc" ? "USDC" : pricing.amount === 1 ? "minute" : "minutes"}`;
  const actionClass = "h-10 w-full rounded-lg border-border bg-transparent bg-none shadow-none dark:border-border dark:bg-transparent";
  const Icon = isDms ? ChatCircleDotsIcon : ChatsTeardropIcon;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="relative flex size-14 items-center justify-center rounded-lg bg-muted text-primary">
            <Icon size={28} aria-hidden="true" />
          </div>
          <Badge variant="secondary" className="h-auto rounded-full px-3 py-2 whitespace-normal">{isDms ? `${priceLabel} per message` : (pricing.unit === "minutes" || pricing.unit === "holders") ? `Must hold at least ${priceLabel}` : `${priceLabel} for access`}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-3">
        <div className="space-y-2">
          <CardTitle>{isDms ? "Direct Message" : "Group Chat"}</CardTitle>
          <CardDescription className="text-base">{isDms ? "Get paid every time you answer a direct message." : "Create a group chat to connect with many users at once."}</CardDescription>
        </div>
        <div className={active ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
          <ServicePricingDialog
            type={type}
            value={pricing}
            onSave={(value) => {
              setPricing(value);
              onActivate(value);
            }}
            triggerClassName={actionClass}
            triggerLabel={active ? "Edit" : "Activate"}
            title={active ? undefined : `Create ${isDms ? "direct message" : "group chat"} market`}
          />
          {active && <Button type="button" variant="outline" className={actionClass} onClick={() => {
            onDeactivate?.();
          }} disabled={isActivating}><TrashIcon aria-hidden="true" />Deactivate</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
