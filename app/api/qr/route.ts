import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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
    .order("created_at", { ascending: false });

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

  const records = Array.from({ length: count }, () => ({
    code:
      `${prefix}-` +
      crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase(),
    destination_url: null,
    is_active: false,
  }));

  const { data, error } = await supabase
    .from("qr_codes")
    .insert(records)
    .select("id, code, destination_url, is_active, created_at");

  if (error) {
    console.error("Gagal membuat QR:", error.message);

    return NextResponse.json(
      { error: "QR gagal dibuat. Silakan coba lagi." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { data },
    { status: 201 }
  );
}
