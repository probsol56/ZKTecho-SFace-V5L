import Image from "next/image";

export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="SFPL crest"
      width={40}
      height={44}
      className={`object-contain ${className ?? ""}`}
      priority
    />
  );
}
