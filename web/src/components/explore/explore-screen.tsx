import { BuildingsIcon, PaintBrushIcon, MegaphoneIcon } from "@phosphor-icons/react/dist/ssr";
import { ExploreSection, type ExploreProfile } from "@/components/explore/explore-section";

const portraits = [
  "photo-1534528741775-53994a69daeb",
  "photo-1500648767791-00dcc994a43e",
  "photo-1506794778202-cad84cf45f1d",
  "photo-1524504388940-b1c1722653e1",
  "photo-1517841905240-472988babdf9",
  "photo-1506794778202-cad84cf45f1d",
];
const names = ["Sophie Bennett", "Alex Morgan", "Jordan Lee", "Maya Chen", "Olivia Rhye", "Noah Parker"];
function profiles(category: string, bio: string): ExploreProfile[] {
  return names.map((name, index) => ({
    username: `${name.toLowerCase().replaceAll(" ", "")}-${category}`,
    name,
    bio,
    imageSrc: `https://images.unsplash.com/${portraits[index]}?w=480&auto=format&fit=crop`,
    minutePrice: [0.12, 0.18, 0.25, 0.1, 0.15, 0.2][index],
    change24h: [2.34, -1.2, 0, 4.5, -0.76, 1.8][index],
  }));
}

const founders = profiles("founder", "Building products and sharing lessons on startups, teams, and growth.");
const creators = profiles("creator", "Sharing ideas on storytelling, content, and building a community.");
const designers = profiles("designer", "Helping teams turn complex ideas into thoughtful product experiences.");

export function ExploreScreen() {
  return (
    <main className="w-full min-w-0 space-y-10 p-4 sm:p-6">
      <ExploreSection id="founders" title="Founders" description="Get advice from proven entrepreneurs" icon={<BuildingsIcon size={26} />} profiles={founders} />
      <ExploreSection id="creators" title="Creators" description="Connect with creative voices and community builders" icon={<MegaphoneIcon size={26} />} profiles={creators} />
      <ExploreSection id="designers" title="Designers" description="Get a fresh perspective on your next product" icon={<PaintBrushIcon size={26} />} profiles={designers} />
    </main>
  );
}
