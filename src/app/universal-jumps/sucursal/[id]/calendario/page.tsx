import { use } from "react";
import { redirect } from "next/navigation";

type LegacyFranquiciaAliasCalendarioPageProps = {
  params: Promise<{ id: string }>;
};

export default function UniversalJumpsSucursalCalendarioPage({
  params,
}: LegacyFranquiciaAliasCalendarioPageProps) {
  const { id } = use(params);
  redirect(`/universal-jumps/franquicia/${id}/calendario`);
}
