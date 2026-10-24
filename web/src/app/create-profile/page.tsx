import type { Metadata } from "next";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata: Metadata = { title: "Create profile | Worth" };

export default function CreateProfilePage() {
  return <ProfileForm mode="create" />;
}
