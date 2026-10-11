"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function SubmitPage() {
  const params = useParams();
  const code = Array.isArray(params?.code)
    ? params.code[0]
    : params?.code;

  const [status, setStatus] = useState("loading");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!code) return;

    let mounted = true;

    async function loadStatus() {
      try {
        const response = await fetch(
          `/api/qr-submit/${encodeURIComponent(code)}`,
          { cache: "no-store" }
        );

        const result = await response.json();

        if (!mounted) return;

        if (response.status === 404) {
          setStatus("not_found");
        } else if (!response.ok) {
          setStatus("error");
          setMessage(result.error || "Gagal memeriksa QR.");
        } else {
          setStatus(result.status);
        }
      } catch {
        if (mounted) {
          setStatus("error");
          setMessage("Tidak dapat menghubungi server.");
        }
      }
    }

    loadStatus();

    return () => {
      mounted = false;
    };
  }, [code]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/qr-submit/${encodeURIComponent(code)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ destination_url: url }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Gagal mengirim URL.");
        return;
      }

      setStatus("pending");
      setMessage(
        "URL berhasil dikirim. Silakan tunggu aktivasi admin."
      );
    } catch {
      setMessage("Koneksi bermasalah. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  const boxStyle = {
    maxWidth: 480,
    width: "100%",
    boxSizing: "border-box",
    padding: 24,
    border: "1px solid #ddd",
    borderRadius: 14,
    background: "#fff",
    color: "#111",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        background: "#f5f5f5",
      }}
    >
      <section style={boxStyle}>
        <h1>Aktivasi QR Code</h1>
        <p style={{ color: "#666", overflowWrap: "anywhere" }}>
          Kode: {code}
        </p>

        {status === "loading" && <p>Memeriksa status QR...</p>}

        {status === "not_found" && (
          <p>QR tidak ditemukan. Periksa kembali kode QR kamu.</p>
        )}

        {status === "error" && (
          <p role="alert">{message}</p>
        )}

        {status === "active" && (
          <p>QR sudah aktif. Silakan pindai QR untuk membuka link tujuan.</p>
        )}

        {status === "pending" && (
          <div>
            <h2>Menunggu aktivasi admin</h2>
            <p>URL kamu sudah tersimpan dan tidak dapat diganti melalui halaman ini.</p>
            <p>{message || "Admin akan memeriksa URL sebelum mengaktifkan QR."}</p>
          </div>
        )}

        {status === "open" && (
          <form onSubmit={submit}>
            <h2>Masukkan URL tujuan</h2>

            <p>
              Masukkan link yang ingin dibuka ketika QR sudah aktif.
            </p>

            <label htmlFor="destination_url">URL tujuan</label>

            <input
              id="destination_url"
              type="url"
              required
              maxLength={2048}
              placeholder="https://contoh.com"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              style={{
                display: "block",
                width: "100%",
                boxSizing: "border-box",
                padding: 12,
                marginTop: 8,
                marginBottom: 14,
                border: "1px solid #ccc",
                borderRadius: 6,
              }}
            />

            <button
              type="submit"
              disabled={saving}
              style={{ padding: 12, cursor: "pointer" }}
            >
              {saving ? "Mengirim..." : "Kirim URL untuk aktivasi"}
            </button>

            <p role="status">{message}</p>
            <small>
              Gunakan URL lengkap dengan http:// atau https://.
              Setelah dikirim, URL menunggu persetujuan admin.
            </small>
          </form>
        )}
      </section>
    </main>
  );
}
