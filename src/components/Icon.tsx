import * as Icons from "lucide-react";
import { LucideProps } from "lucide-react";

type IconProps = LucideProps & { name: string };

export function Icon({ name, ...props }: IconProps) {
  // Convert kebab-case to PascalCase
  const pascal = name
    .split("-")
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const Comp = (Icons as any)[pascal] ?? Icons.Sparkles;
  return <Comp {...props} />;
}
