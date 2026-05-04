import { use } from "react";
import { redirect } from "next/navigation";

type LegacyFranquiciaAliasAdministracionPageProps = {
  params: Promise<{ id: string }>;
};

export default function UniversalJumpsSucursalAdministracionPage({
  params,
}: LegacyFranquiciaAliasAdministracionPageProps) {
  const { id } = use(params);
  redirect(`/universal-jumps/franquicia/${id}/administracion`);
}
