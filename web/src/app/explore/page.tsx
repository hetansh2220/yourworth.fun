import type { Metadata } from "next";
import { ExploreScreen } from "@/components/explore/explore-screen";

export const metadata: Metadata = { title: "Explore | Worth" };

export default function ExplorePage() {
  return <ExploreScreen />;
}
