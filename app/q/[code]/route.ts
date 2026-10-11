import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;

  const { data, error } = await supabase
    .from("qr_codes")
    .select("destination_url, is_active")
    .eq("code", code)
    .maybeSingle();

  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };

  if (error) {
    console.error("QR lookup error:", error.message);

    return new Response("Terjadi kesalahan server.", {
      status: 500,
      headers,
    });
  }

  if (!data) {
    return new Response("QR Code tidak ditemukan.", {
      status: 404,
      headers,
    });
  }

  if (!data.is_active || !data.destination_url) {
    return new Response(
      "QR Code ini belum aktif. Silakan hubungi admin.",
      { status: 403, headers }
    );
  }

  let target: URL;

  try {
    target = new URL(data.destination_url);

    if (!["https:", "http:"].includes(target.protocol)) {
      throw new Error("Protokol URL tidak diizinkan.");
    }
  } catch {
    return new Response("Link tujuan tidak valid.", {
      status: 500,
      headers,
    });
  }

  return NextResponse.redirect(target, {
    status: 302,
    headers,
  });
}
