import { NextResponse } from "next/server";
import {
  generarCuotasPendientes,
  sincronizarSociosMorosos,
} from "@/actions/caja";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      console.error("[cron/billing] Unauthorized request");
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    const isDayOne = today.getDate() === 27;

    const generatedResult = isDayOne ? await generarCuotasPendientes() : null;
    const morososResult = await sincronizarSociosMorosos();

    if (generatedResult && !generatedResult.ok) {
      console.error("[cron/billing] generarCuotasPendientes failed", generatedResult.error);
      return NextResponse.json(
        { ok: false, error: generatedResult.error, morososResult },
        { status: 500 },
      );
    }
    if (!morososResult.ok) {
      console.error("[cron/billing] sincronizarSociosMorosos failed", morososResult.error);
      return NextResponse.json(
        { ok: false, error: morososResult.error, generatedResult },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      ranGeneracion: isDayOne,
      generatedResult,
      morososResult,
    });
  } catch (error) {
    console.error("[cron/billing] Unexpected error", error);
    return NextResponse.json(
      { ok: false, error: "Unexpected error running billing cron" },
      { status: 500 },
    );
  }
}
