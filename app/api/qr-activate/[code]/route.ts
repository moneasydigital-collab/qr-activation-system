import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

type Context = {
  params: Promise<{ code: string }>;
};

export async function POST(
  request: Request,
  context: Context
) {
  const { code } = await context.params;
  const body = await request.json().catch(() => null);

  const pin =
    typeof body?.pin === "string" ? body.pin.trim() : "";

  const rawUrl =
    typeof body?.destination_url === "string"
      ? body.destination_url.trim()
      : "";

  // Semua QR memakai PIN global yang sama.
  const globalPin = process.env.QR_ACTIVATION_PIN;

  if (!globalPin || !/^\d{8}$/.test(globalPin)) {
    return NextResponse.json(
      { error: "PIN global belum dikonfigurasi dengan benar." },
      { status: 500, headers }
    );
  }

  if (!/^\d{8}$/.test(pin)) {
    return NextResponse.json(
      { error: "Masukkan PIN aktivasi yang terdiri dari 8 angka." },
      { status: 400, headers }
    );
  }

  // Validasi URL tujuan.
  if (!rawUrl || rawUrl.length > 2048) {
    return NextResponse.json(
      { error: "Masukkan URL tujuan yang valid." },
      { status: 400, headers }
    );
  }

  let destinationUrl: string;

  try {
    const parsed = new URL(rawUrl);

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
      { error: "URL harus menggunakan http:// atau https:// yang valid." },
      { status: 400, headers }
    );
  }

  // Ambil QR yang hendak diaktifkan.
  const { data: qr, error: lookupError } = await supabase
    .from("qr_codes")
    .select("id, code, is_active, pin_attempts, pin_locked_until")
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

  if (qr.is_active) {
    return NextResponse.json(
      { error: "QR ini sudah aktif." },
      { status: 409, headers }
    );
  }

  // Kunci percobaan PIN berlaku pada QR ini.
  const now = Date.now();
  const lockedUntil = qr.pin_locked_until
    ? new Date(qr.pin_locked_until).getTime()
    : 0;

  if (lockedUntil > now) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi setelah 15 menit." },
      { status: 429, headers }
    );
  }

  const pinMatches = timingSafeEqual(
    Buffer.from(pin),
    Buffer.from(globalPin)
  );

  if (!pinMatches) {
    const previousAttempts =
      lockedUntil > 0 && lockedUntil <= now
        ? 0
        : qr.pin_attempts || 0;

    const attempts = previousAttempts + 1;

    const newLock =
      attempts >= 5
        ? new Date(now + 15 * 60 * 1000).toISOString()
        : null;

    const { error: attemptError } = await supabase
      .from("qr_codes")
      .update({
        pin_attempts: attempts,
        pin_locked_until: newLock,
      })
      .eq("id", qr.id)
      .eq("is_active", false);

    if (attemptError) {
      return NextResponse.json(
        { error: "Gagal mencatat percobaan PIN." },
        { status: 500, headers }
      );
    }

    return NextResponse.json(
      {
        error:
          attempts >= 5
            ? "PIN salah 5 kali. QR dikunci selama 15 menit."
            : `PIN salah. Sisa percobaan: ${5 - attempts}.`,
      },
      {
        status: attempts >= 5 ? 429 : 401,
        headers,
      }
    );
  }

  // PIN benar: aktifkan QR dan simpan URL pilihan user.
  const { data: activated, error: activateError } = await supabase
    .from("qr_codes")
    .update({
      destination_url: destinationUrl,
      is_active: true,
      activation_pin_hash: null,
      pin_attempts: 0,
      pin_locked_until: null,
      activated_at: new Date().toISOString(),
    })
    .eq("id", qr.id)
    .eq("is_active", false)
    .select("code, destination_url, is_active, activated_at")
    .maybeSingle();

  if (activateError) {
    return NextResponse.json(
      { error: "Gagal mengaktifkan QR. Silakan coba lagi." },
      { status: 500, headers }
    );
  }

  if (!activated) {
    return NextResponse.json(
      { error: "QR sudah berubah atau sudah aktif." },
      { status: 409, headers }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "QR berhasil diaktifkan!",
      data: activated,
    },
    { status: 200, headers }
  );
}
