import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SUPERADMIN_ROLES = new Set(["admin_global", "superadmin"]);

function isLocalDashboardPath(pathname: string) {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/administracion") ||
    pathname.startsWith("/calendario") ||
    pathname.startsWith("/socios") ||
    pathname.startsWith("/configuracion") ||
    pathname.startsWith("/perfil")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isUniversalRoute = pathname.startsWith("/universal-jumps");
  const isProtectedRoute = isUniversalRoute || isLocalDashboardPath(pathname);
  const isLoginRoute = pathname === "/login" || pathname === "/";

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!user) return response;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  const rol = perfil?.rol ?? null;
  const isSuperAdmin = rol ? SUPERADMIN_ROLES.has(rol) : false;

  if (isLoginRoute) {
    return NextResponse.redirect(
      new URL(isSuperAdmin ? "/universal-jumps" : "/dashboard", request.url),
    );
  }

  if (isUniversalRoute && !isSuperAdmin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isSuperAdmin && isLocalDashboardPath(pathname)) {
    return NextResponse.redirect(new URL("/universal-jumps", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/administracion/:path*",
    "/calendario/:path*",
    "/socios/:path*",
    "/configuracion/:path*",
    "/perfil/:path*",
    "/universal-jumps/:path*",
  ],
};
