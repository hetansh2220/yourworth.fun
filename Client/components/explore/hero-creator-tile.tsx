type HeroCreatorTileProps = {
  image: string;
  className?: string;
};

export function HeroCreatorTile({
  image,
  className = "",
}: HeroCreatorTileProps) {
  return (
    <div
      className={`relative aspect-square w-full min-w-0 shrink-0 overflow-hidden rounded-[14px] bg-[#0D0D0F] sm:rounded-[20px] lg:rounded-[28px] ${className}`}
    >
      <img
        src={image}
        alt="Creator"
        draggable={false}
        className="h-full w-full select-none object-cover"
      />
    </div>
  );
}
