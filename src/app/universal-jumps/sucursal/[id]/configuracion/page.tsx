import { use } from "react";
import { redirect } from "next/navigation";

type LegacyFranquiciaAliasConfiguracionPageProps = {
  params: Promise<{ id: string }>;
};

export default function UniversalJumpsSucursalConfiguracionPage({
  params,
}: LegacyFranquiciaAliasConfiguracionPageProps) {
  const { id } = use(params);
  redirect(`/universal-jumps/franquicia/${id}/configuracion`);
}
