import { use } from "react";
import { redirect } from "next/navigation";

type LegacyFranquiciaAliasSociosPageProps = {
  params: Promise<{ id: string }>;
};

export default function UniversalJumpsSucursalSociosPage({
  params,
}: LegacyFranquiciaAliasSociosPageProps) {
  const { id } = use(params);
  redirect(`/universal-jumps/franquicia/${id}/socios`);
}
