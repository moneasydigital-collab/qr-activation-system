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

  // QR yang belum aktif akan membuka halaman pengajuan URL.
  if (!data.is_active || !data.destination_url) {
    const formUrl = new URL(
      `/submit/${encodeURIComponent(code)}`,
      request.url
    );

    return NextResponse.redirect(formUrl, {
      status: 302,
      headers,
    });
  }

  let target: URL;

  try {
    target = new URL(data.destination_url);

    if (
      !["http:", "https:"].includes(target.protocol) ||
      target.username ||
      target.password
    ) {
      throw new Error("URL tidak diizinkan.");
    }
  } catch {
    return new Response("Link tujuan tidak valid.", {
      status: 500,
      headers,
    });
  }

  // QR aktif langsung menuju URL yang disetujui.
  return NextResponse.redirect(target, {
    status: 302,
    headers,
  });
}
