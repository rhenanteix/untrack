import Image from "next/image";

type BrandLogoProps = {
  variant?: "full" | "symbol";
  size?: "sm" | "md" | "lg";
  tone?: "dark" | "light";
  className?: string;
};

const dimensions = {
  sm: { width: 360, height: 88 },
  md: { width: 360, height: 88 },
  lg: { width: 360, height: 88 },
} as const;

export function BrandLogo({
  variant = "full",
  size = "md",
  tone = "dark",
  className,
}: BrandLogoProps) {
  const source = tone === "light" ? "/linkor-logo-light.svg" : "/linkor-logo.svg";
  const { width, height } = dimensions[size];
  const classes = [
    "brand-logo-asset",
    `brand-logo-asset--${variant}`,
    `brand-logo-asset--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      <Image src={source} alt="LinkOr" width={width} height={height} priority />
    </span>
  );
}