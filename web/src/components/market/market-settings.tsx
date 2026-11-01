"use client";

import { ServiceCard } from "@/components/market/service-card";
import { useCreateMarkets, useLaunchMarkets, useMyMarkets, useUpdateMarkets } from "@/hooks/use-markets";
import { useConnectTwitter, useMySocials } from "@/hooks/use-profile";
import type { MarketInput, MarketType } from "@/utils/api/markets";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { XLogoIcon } from "@phosphor-icons/react";

export function MarketSettings() {
  const { data: markets = [], isLoading } = useMyMarkets();
  const { data: socials, refetch: refetchSocials } = useMySocials();
  const searchParams = useSearchParams();
  const createMarkets = useCreateMarkets();
  const launchMarkets = useLaunchMarkets();
  const updateMarkets = useUpdateMarkets();
  const connectTwitter = useConnectTwitter();
  const [pendingInput, setPendingInput] = useState<MarketInput | null>(null);
  const [twitterDialogOpen, setTwitterDialogOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [activatedTypes, setActivatedTypes] = useState<MarketType[]>([]);

  useEffect(() => {
    if (searchParams.get("twitter") === "connected") {
      void refetchSocials();
    }
  }, [searchParams, refetchSocials]);

  useEffect(() => {
    if (!socials?.twitterUsername || isLoading || !markets) return;

    const saved = localStorage.getItem("pending-market");
    if (!saved) return;

    const input = JSON.parse(saved) as MarketInput;
    const existingMarket = markets.find(
      (market) => market.marketType === input.marketType,
    );
    const mutation = markets.length === 0
      ? launchMarkets
      : existingMarket
        ? updateMarkets
        : createMarkets;

    mutation.mutate([input], {
      onSuccess: () => {
        localStorage.removeItem("pending-market");
        setActivatedTypes((current) =>
          current.includes(input.marketType)
            ? current
            : [...current, input.marketType],
        );
        setNotice("Market activated successfully.");
      },
      onError: (error) => setNotice(error.message),
    });
  }, [socials?.twitterUsername, isLoading, markets]);

  function activateMarket(marketType: MarketType, pricing: { unit: "usdc" | "minutes" | "holders"; amount: number }) {
    const input: MarketInput = {
      marketType,
      paymentType: pricing.unit === "usdc" ? "USDC" : "CREATOR_TOKEN",
      amount: pricing.amount,
    };

    if (!socials?.twitterUsername) {
      setPendingInput(input);
      setTwitterDialogOpen(true);
      return;
    }

    const existingMarket = markets.find((market) => market.marketType === marketType);
    const mutation = markets.length === 0
      ? launchMarkets
      : existingMarket
        ? updateMarkets
        : createMarkets;
    mutation.mutate([input], {
      onSuccess: () => {
        setActivatedTypes((current) =>
          current.includes(input.marketType)
            ? current
            : [...current, input.marketType],
        );
        setNotice("Market activated successfully.");
      },
      onError: (error) => setNotice(error.message),
    });
  }

  return (
    <main className="w-full p-4 pt-8 sm:p-6 sm:pt-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-[32px] font-medium tracking-tight">Market</h1>
          <p className="text-sm text-muted-foreground">Edit your services and manage their availability.</p>
        </header>
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <ServiceCard type="dms" active={!isLoading && (markets.some((market) => market.marketType === "DM") || activatedTypes.includes("DM"))} onActivate={(pricing) => activateMarket("DM", pricing)} isActivating={launchMarkets.isPending || createMarkets.isPending || updateMarkets.isPending} />
          <ServiceCard type="group" active={!isLoading && (markets.some((market) => market.marketType === "GROUP") || activatedTypes.includes("GROUP"))} onActivate={(pricing) => activateMarket("GROUP", pricing)} isActivating={launchMarkets.isPending || createMarkets.isPending || updateMarkets.isPending} />
        </div>
        {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
        <Dialog open={twitterDialogOpen} onOpenChange={setTwitterDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect X before activating your market</DialogTitle>
              <DialogDescription>Connect X first. Then activate your market with the selected pricing.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTwitterDialogOpen(false)}>Cancel</Button>
              <Button type="button" onClick={() => {
                if (pendingInput) localStorage.setItem("pending-market", JSON.stringify(pendingInput));
                connectTwitter.mutate();
              }} disabled={connectTwitter.isPending}>
                <XLogoIcon aria-hidden="true" />
                {connectTwitter.isPending ? "Connecting…" : "Connect X"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
