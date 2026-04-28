import { UniversalJumpsShell } from "@/components/layout/UniversalJumpsShell";

export default function UniversalJumpsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <UniversalJumpsShell>{children}</UniversalJumpsShell>;
}
