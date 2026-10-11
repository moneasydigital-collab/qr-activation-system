import { NextResponse } from "next/server";
import { createHmac, randomInt } from "node:crypto";
import { isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  // Hanya admin yang boleh membuat PIN.
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "Silakan login sebagai admin." },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    return NextResponse.json(
      { error: "Konfigurasi secret server belum benar." },
      { status: 500 }
    );
  }

  const { data: qr, error: lookupError } = await supabase
    .from("qr_codes")
    .select("id, code, is_active")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: "Gagal memeriksa QR." },
      { status: 500 }
    );
  }

  if (!qr) {
    return NextResponse.json(
      { error: "QR tidak ditemukan." },
      { status: 404 }
    );
  }

  if (qr.is_active) {
    return NextResponse.json(
      {
        error:
          "QR sudah aktif. Nonaktifkan QR terlebih dahulu jika ingin membuat PIN baru."
      },
      { status: 409 }
    );
  }

  // PIN acak enam digit.
  const pin = randomInt(0, 1_000_000)
    .toString()
    .padStart(6, "0");

  // Simpan hash, bukan PIN asli.
  const pinHash = createHmac("sha256", secret)
    .update(`${qr.id}:${pin}`)
    .digest("hex");

  const { data, error } = await supabase
    .from("qr_codes")
    .update({
      activation_pin_hash: pinHash,
      pin_attempts: 0,
      pin_locked_until: null,
      activated_at: null,
    })
    .eq("id", qr.id)
    .eq("is_active", false)
    .select("id, code")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Gagal menyimpan PIN." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Status QR berubah. Muat ulang dashboard." },
      { status: 409 }
    );
  }

  // PIN asli hanya dikembalikan saat dibuat.
  return NextResponse.json({
    ok: true,
    code: data.code,
    pin,
    message:
      "Berikan PIN ini kepada pemilik QR. Simpan PIN sebelum menutup pesan ini.",
  });
}
