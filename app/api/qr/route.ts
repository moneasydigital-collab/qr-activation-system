
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Mengambil daftar QR untuk dashboard admin
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "Silakan login sebagai admin." },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("qr_codes")
    .select("id, code, destination_url, is_active, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Gagal membaca QR:", error.message);

    return NextResponse.json(
      { error: "Gagal mengambil data QR." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// Membuat QR baru dengan nomor berurutan
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "Silakan login sebagai admin." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);

  const count = Number(body?.count);

  const prefix =
    typeof body?.prefix === "string"
      ? body.prefix.trim().toUpperCase()
      : "QR";

  // Validasi jumlah dan prefix
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 500 ||
    !/^[A-Z0-9_-]{1,20}$/.test(prefix)
  ) {
    return NextResponse.json(
      {
        error:
          "Jumlah QR harus 1–500. Prefix hanya boleh berisi huruf, angka, _ atau -."
      },
      { status: 400 }
    );
  }

  // Ambil kode yang sesuai dengan prefix
  const { data: existingCodes, error: existingError } =
    await supabase
      .from("qr_codes")
      .select("code")
      .like("code", `${prefix}%`);

  if (existingError) {
    console.error(
      "Gagal memeriksa nomor QR:",
      existingError.message
    );

    return NextResponse.json(
      { error: "Gagal memeriksa nomor QR terakhir." },
      { status: 500 }
    );
  }

  // Cari nomor terbesar yang sudah digunakan
  const codePattern = new RegExp(`^${prefix}(\\d+)$`);

  const maxNumber = (existingCodes || []).reduce(
    (max, row) => {
      const match = row.code.match(codePattern);

      return match
        ? Math.max(max, Number(match[1]))
        : max;
    },
    0
  );

  // Buat nomor berurutan: QR001, QR002, QR003, dst.
  const records = Array.from(
    { length: count },
    (_, index) => ({
      code:
        `${prefix}` +
        String(maxNumber + index + 1).padStart(3, "0"),
      destination_url: null,
      is_active: false,
    })
  );

  // Simpan seluruh QR baru ke Supabase
  const { data, error } = await supabase
    .from("qr_codes")
    .insert(records)
    .select(
      "id, code, destination_url, is_active, created_at"
    );

  if (error) {
    console.error("Gagal membuat QR:", error.message);

    return NextResponse.json(
      {
        error:
          "QR gagal dibuat. Periksa kode yang sudah digunakan lalu coba lagi."
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { data },
    { status: 201 }
  );
}
