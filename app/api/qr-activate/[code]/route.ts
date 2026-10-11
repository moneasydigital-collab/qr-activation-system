import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

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

  // Validasi input
  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json(
      { error: "Masukkan PIN yang terdiri dari 6 angka." },
      { status: 400, headers }
    );
  }

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
      {
        error:
          "URL harus menggunakan http:// atau https:// yang valid.",
      },
      { status: 400, headers }
    );
  }

  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    return NextResponse.json(
      { error: "Konfigurasi keamanan server belum benar." },
      { status: 500, headers }
    );
  }

  // Ambil data QR dan hash PIN dari database
  const { data: qr, error: lookupError } = await supabase
    .from("qr_codes")
    .select(
      "id, code, is_active, activation_pin_hash, pin_attempts, pin_locked_until"
    )
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

  if (!qr.activation_pin_hash) {
    return NextResponse.json(
      {
        error:
          "PIN belum dibuat oleh admin. Hubungi admin untuk meminta PIN.",
      },
      { status: 400, headers }
    );
  }

  // Batasi percobaan PIN yang salah
  if (
    qr.pin_locked_until &&
    new Date(qr.pin_locked_until).getTime() > Date.now()
  ) {
    return NextResponse.json(
      {
        error:
          "Terlalu banyak percobaan. Coba kembali setelah 15 menit.",
      },
      { status: 429, headers }
    );
  }

  // Hitung hash PIN dengan metode yang sama seperti API pembuat PIN
  const candidateHash = createHmac("sha256", secret)
    .update(`${qr.id}:${pin}`)
    .digest("hex");

  const storedHash = qr.activation_pin_hash;

  const validStoredHash =
    typeof storedHash === "string" &&
    /^[a-f0-9]{64}$/i.test(storedHash);

  const pinMatches =
    validStoredHash &&
    timingSafeEqual(
      Buffer.from(candidateHash, "hex"),
      Buffer.from(storedHash, "hex")
    );

  if (!pinMatches) {
    const attempts = (qr.pin_attempts || 0) + 1;

    const lockedUntil =
      attempts >= 5
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null;

    const { error: attemptError } = await supabase
      .from("qr_codes")
      .update({
        pin_attempts: attempts,
        pin_locked_until: lockedUntil,
      })
      .eq("id", qr.id)
      .eq("is_active", false)
      .eq("activation_pin_hash", storedHash);

    if (attemptError) {
      return NextResponse.json(
        { error: "Gagal memproses percobaan PIN." },
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

  // Aktifkan QR hanya jika hash PIN belum berubah dan QR masih nonaktif.
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
    .eq("activation_pin_hash", storedHash)
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
      {
        error:
          "QR sudah berubah atau telah diaktifkan. Silakan muat ulang halaman.",
      },
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
