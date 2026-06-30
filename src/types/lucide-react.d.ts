declare module "lucide-react" {
  import type { ComponentType, SVGProps } from "react";

  export type LucideProps = SVGProps<SVGSVGElement> & {
    absoluteStrokeWidth?: boolean;
    color?: string;
    size?: number | string;
  };

  export type LucideIcon = ComponentType<LucideProps>;

  export const Bookmark: LucideIcon;
  export const Camera: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const Mic: LucideIcon;
  export const Plus: LucideIcon;
  export const Search: LucideIcon;
  export const Star: LucideIcon;
  export const SwitchCamera: LucideIcon;
  export const Type: LucideIcon;
  export const Upload: LucideIcon;
  export const X: LucideIcon;
}
