import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "Silakan login sebagai admin." },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  if (
    typeof body?.is_active !== "boolean" ||
    typeof body?.destination_url !== "string"
  ) {
    return NextResponse.json(
      { error: "Link tujuan atau status QR tidak valid." },
      { status: 400 }
    );
  }

  const destinationUrl = body.destination_url.trim();
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(destinationUrl);

    if (!["https:", "http:"].includes(parsedUrl.protocol)) {
      throw new Error("Protokol tidak diizinkan.");
    }
  } catch {
    if (body.is_active || destinationUrl) {
      return NextResponse.json(
        { error: "Masukkan link HTTP atau HTTPS yang valid." },
        { status: 400 }
      );
    }
  }

  if (body.is_active && !destinationUrl) {
    return NextResponse.json(
      { error: "Isi link sebelum mengaktifkan QR." },
      { status: 400 }
    );
  }

  const { data: existing, error: findError } = await supabase
    .from("qr_codes")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (findError) {
    return NextResponse.json(
      { error: "Gagal memeriksa QR." },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json(
      { error: "QR tidak ditemukan." },
      { status: 404 }
    );
  }

  const { data, error } = await supabase
    .from("qr_codes")
    .update({
      destination_url: destinationUrl || null,
      is_active: body.is_active,
    })
    .eq("id", id)
    .select("id, code, destination_url, is_active")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Gagal menyimpan perubahan QR." },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}
