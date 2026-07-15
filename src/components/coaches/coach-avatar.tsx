import Image from "next/image";

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const SIZE_CLASSES = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
};

const SIZE_PX = {
  sm: 36,
  md: 48,
  lg: 64,
};

// Most coaches here are historical or living figures whose likeness this
// site has no rights to use, so they get a plain monogram. `imageUrl` is an
// explicit per-coach exception -- only set on a coach's own data.ts entry
// once that coach has personally supplied a photo for confirmed use (see
// Tom Schwartz, who provided his own for his site review), never assumed.
export function CoachAvatar({
  name,
  imageUrl,
  size = "md",
}: {
  name: string;
  imageUrl?: string;
  size?: keyof typeof SIZE_CLASSES;
}) {
  if (imageUrl) {
    return (
      <span className={`relative inline-block shrink-0 overflow-hidden rounded-full ${SIZE_CLASSES[size]}`}>
        <Image src={imageUrl} alt={name} fill sizes={`${SIZE_PX[size]}px`} className="object-cover" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-900 font-semibold text-white dark:bg-white dark:text-zinc-900 ${SIZE_CLASSES[size]}`}
    >
      {initials(name)}
    </span>
  );
}
