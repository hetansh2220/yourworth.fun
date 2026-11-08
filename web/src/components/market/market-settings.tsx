"use client";

import { ServiceCard } from "@/components/market/service-card";
import {
  useCreateMarkets,
  useLaunchMarkets,
  useMyMarkets,
  useUpdateMarkets,
} from "@/hooks/use-markets";
import { useConnectTwitter, useMySocials } from "@/hooks/use-socials";
import type { MarketInput, MarketType } from "@/utils/api/markets";
import type { ServicePricing } from "@/components/dialogs/service-pricing-dialog";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { XLogoIcon } from "@phosphor-icons/react";
import { toast } from "@/components/ui/toast";

export function MarketSettings() {
  const { data: markets = [], isLoading } = useMyMarkets();
  const {
    data: socials,
    isLoading: socialsLoading,
    refetch: refetchSocials,
  } = useMySocials();
  const searchParams = useSearchParams();
  const router = useRouter();
  const createMarkets = useCreateMarkets();
  const launchMarkets = useLaunchMarkets();
  const updateMarkets = useUpdateMarkets();
  const connectTwitter = useConnectTwitter();
  const [pendingInput, setPendingInput] = useState<MarketInput | null>(null);
  const [twitterDialogOpen, setTwitterDialogOpen] = useState(false);
  const [activatedTypes, setActivatedTypes] = useState<MarketType[]>([]);
  const [deactivatedTypes, setDeactivatedTypes] = useState<MarketType[]>([]);

  useEffect(() => {
    if (searchParams.get("twitter") === "connected") {
      void refetchSocials();
    }
  }, [searchParams, refetchSocials]);

  useEffect(() => {
    if (socialsLoading) return;
    setTwitterDialogOpen(!socials?.twitterUsername);
  }, [socials?.twitterUsername, socialsLoading]);

  useEffect(() => {
    if (!socials?.twitterUsername || isLoading || !markets) return;

    const saved = localStorage.getItem("pending-market");
    if (!saved) return;

    const input = JSON.parse(saved) as MarketInput;
    const existingMarket = markets.find(
      (market) => market.marketType === input.marketType,
    );
    const mutation =
      markets.length === 0
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
        toast.add({ title: "Market activated", description: "Your market is now active.", type: "success" });
      },
      onError: (error) => toast.add({ title: "Could not activate market", description: error.message, type: "error" }),
    });
  }, [socials?.twitterUsername, isLoading, markets]);

  function activateMarket(
    marketType: MarketType,
    pricing: { unit: "usdc" | "minutes" | "holders"; amount: number },
  ) {
    setDeactivatedTypes((current) => current.filter((type) => type !== marketType));
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

    const existingMarket = markets.find(
      (market) => market.marketType === marketType,
    );
    const mutation =
      markets.length === 0
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
        toast.add({ title: "Market updated", description: "Your pricing was saved.", type: "success" });
      },
      onError: (error) => toast.add({ title: "Could not update market", description: error.message, type: "error" }),
    });
  }

  function getSavedPricing(marketType: MarketType): ServicePricing | undefined {
    const market = markets.find((item) => item.marketType === marketType);
    if (!market || market.amount == null) return undefined;

    return {
      unit: market.paymentType === "USDC" ? "usdc" : "minutes",
      amount: Number(market.amount),
    };
  }

  return (
    <main className="w-full p-4 pt-8 sm:p-6 sm:pt-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-[32px] font-medium tracking-tight">Market</h1>
          <p className="text-sm text-muted-foreground">
            Edit your services and manage their availability.
          </p>
        </header>
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <ServiceCard
            type="dms"
            initialPricing={getSavedPricing("DM")}
            active={
              !isLoading &&
              !deactivatedTypes.includes("DM") &&
              (markets.some((market) => market.marketType === "DM") ||
                activatedTypes.includes("DM"))
            }
            onActivate={(pricing) => activateMarket("DM", pricing)}
            onDeactivate={() => {
              setDeactivatedTypes((current) => [...current, "DM"]);
              toast.add({ title: "DM market deactivated", type: "success" });
            }}
            isActivating={
              launchMarkets.isPending ||
              createMarkets.isPending ||
              updateMarkets.isPending
            }
          />
          <ServiceCard
            type="group"
            initialPricing={getSavedPricing("GROUP")}
            active={
              !isLoading &&
              !deactivatedTypes.includes("GROUP") &&
              (markets.some((market) => market.marketType === "GROUP") ||
                activatedTypes.includes("GROUP"))
            }
            onActivate={(pricing) => activateMarket("GROUP", pricing)}
            onDeactivate={() => {
              setDeactivatedTypes((current) => [...current, "GROUP"]);
              toast.add({ title: "Group market deactivated", type: "success" });
            }}
            isActivating={
              launchMarkets.isPending ||
              createMarkets.isPending ||
              updateMarkets.isPending
            }
          />
        </div>
        <Dialog open={twitterDialogOpen} onOpenChange={setTwitterDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect X before activating your market</DialogTitle>
              <DialogDescription>
                Connect X first. Then activate your market with the selected
                pricing.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard")}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (pendingInput)
                    localStorage.setItem(
                      "pending-market",
                      JSON.stringify(pendingInput),
                    );
                  connectTwitter.mutate();
                }}
                disabled={connectTwitter.isPending}
              >
                <XLogoIcon aria-hidden="true" />
                {connectTwitter.isPending ? "Connecting…" : "Connect"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
