import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store",
};

type Context = {
  params: Promise<{ code: string }>;
};

export async function GET(
  _request: Request,
  context: Context
) {
  const { code } = await context.params;

  const { data, error } = await supabase
    .from("qr_codes")
    .select("id, destination_url, is_active")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Gagal memeriksa QR." },
      { status: 500, headers }
    );
  }

  if (!data) {
    return NextResponse.json(
      { status: "not_found" },
      { status: 404, headers }
    );
  }

  if (data.is_active && data.destination_url) {
    return NextResponse.json(
      { status: "active" },
      { headers }
    );
  }

  if (data.destination_url) {
    return NextResponse.json(
      { status: "pending" },
      { headers }
    );
  }

  return NextResponse.json(
    { status: "open" },
    { headers }
  );
}

export async function POST(
  request: Request,
  context: Context
) {
  const { code } = await context.params;
  const body = await request.json().catch(() => null);

  if (
    typeof body?.destination_url !== "string" ||
    !body.destination_url.trim() ||
    body.destination_url.length > 2048
  ) {
    return NextResponse.json(
      { error: "Masukkan URL yang valid." },
      { status: 400, headers }
    );
  }

  let destinationUrl: string;

  try {
    const parsed = new URL(body.destination_url.trim());

    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error("URL tidak diizinkan.");
    }

    destinationUrl = parsed.toString();
  } catch {
    return NextResponse.json(
      {
        error:
          "URL harus diawali http:// atau https:// dan valid."
      },
      { status: 400, headers }
    );
  }

  const { data: qr, error: lookupError } = await supabase
    .from("qr_codes")
    .select("id, destination_url, is_active")
    .eq("code", code)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: "Gagal memeriksa QR." },
      { status: 500, headers }
    );
  }

  if (!qr) {
    return NextResponse.json(
      { error: "QR tidak ditemukan." },
      { status: 404, headers }
    );
  }

  if (qr.is_active || qr.destination_url) {
    return NextResponse.json(
      {
        error:
          "QR sudah pernah diajukan atau sudah aktif. Hubungi admin jika perlu bantuan."
      },
      { status: 409, headers }
    );
  }

  // Hanya satu pengajuan yang dapat berhasil untuk setiap QR.
  const { data: updated, error: updateError } = await supabase
    .from("qr_codes")
    .update({ destination_url: destinationUrl })
    .eq("id", qr.id)
    .eq("is_active", false)
    .is("destination_url", null)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json(
      { error: "Gagal menyimpan URL." },
      { status: 500, headers }
    );
  }

  if (!updated) {
    return NextResponse.json(
      {
        error:
          "QR sudah diajukan oleh pengguna lain. Silakan hubungi admin."
      },
      { status: 409, headers }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      status: "pending",
      message: "URL berhasil dikirim. Tunggu aktivasi admin."
    },
    { status: 201, headers }
  );
}
