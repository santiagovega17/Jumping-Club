import { use } from "react";
import { redirect } from "next/navigation";

type LegacyFranquiciaAliasPageProps = {
  params: Promise<{ id: string }>;
};

export default function UniversalJumpsSucursalPage({ params }: LegacyFranquiciaAliasPageProps) {
  const { id } = use(params);
  redirect(`/universal-jumps/franquicia/${id}`);
}
