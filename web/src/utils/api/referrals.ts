import { api } from "@/lib/api";

export type ReferralAvailabilityResponse = {
  success: boolean;
  available: boolean;
  message?: string;
};

export function checkReferralCodeAvailability(referralCode: string) {
  return api<ReferralAvailabilityResponse>(
    `/referrals/availability?referralCode=${encodeURIComponent(referralCode.trim().toLowerCase())}`,
  );
}
