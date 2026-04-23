import * as React from "react";
import { cn } from "@/lib/utils";
import { SECTION_TITLE_ROW } from "@/lib/headings";

export type SectionHeadingProps = {
  as?: "h2" | "h3" | "div";
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "children">;

export function SectionHeading({
  as: Tag = "h2",
  className,
  children,
  ...rest
}: SectionHeadingProps) {
  return (
    <Tag className={cn(SECTION_TITLE_ROW, className)} {...rest}>
      {children}
    </Tag>
  );
}
