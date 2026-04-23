import * as React from "react";
import { CardTitle } from "@/components/ui/card";
import { DialogTitle } from "@/components/ui/dialog";
import { SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CARD_TITLE_PREMIUM, SHEET_HEADING_CLASS } from "@/lib/headings";

const sheetDialogTitleClass = cn(SHEET_HEADING_CLASS, "leading-none");

export function PremiumCardTitle({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CardTitle>) {
  return (
    <CardTitle className={cn(CARD_TITLE_PREMIUM, className)} {...props}>
      {children}
    </CardTitle>
  );
}

export function PremiumSheetTitle({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SheetTitle>) {
  return (
    <SheetTitle className={cn(sheetDialogTitleClass, className)} {...props}>
      {children}
    </SheetTitle>
  );
}

export function PremiumDialogTitle({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  return (
    <DialogTitle className={cn(sheetDialogTitleClass, className)} {...props}>
      {children}
    </DialogTitle>
  );
}
