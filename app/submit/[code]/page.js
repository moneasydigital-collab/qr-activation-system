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
  const [pin, setPin] = useState("");
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

  async function activate(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/qr-activate/${encodeURIComponent(code)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            destination_url: url.trim(),
            pin: pin.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Aktivasi gagal.");
        return;
      }

      setStatus("active");
      setUrl("");
      setPin("");
      setMessage(
        "QR berhasil diaktifkan! Silakan scan ulang QR untuk membuka URL tujuan."
      );
    } catch {
      setMessage("Koneksi bermasalah. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  const cardStyle = {
    maxWidth: 460,
    width: "100%",
    boxSizing: "border-box",
    padding: 24,
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    background: "#fff",
    color: "#111827",
    boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
  };

  const inputStyle = {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 16,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        background: "#f3f4f6",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section style={cardStyle}>
        <h1 style={{ marginTop: 0 }}>Aktivasi QR Code</h1>

        <p style={{ color: "#6b7280", overflowWrap: "anywhere" }}>
          Kode QR: <strong>{code}</strong>
        </p>

        {status === "loading" && (
          <p>Memeriksa status QR...</p>
        )}

        {status === "not_found" && (
          <p role="alert">
            QR tidak ditemukan. Periksa kembali kode QR kamu.
          </p>
        )}

        {status === "error" && (
          <p role="alert">{message}</p>
        )}

        {status === "active" && (
          <div>
            <h2 style={{ color: "#15803d" }}>
              QR sudah aktif
            </h2>
            <p>
              QR ini sudah diaktifkan. Scan ulang QR untuk membuka
              halaman tujuan.
            </p>
            <p role="status">{message}</p>
          </div>
        )}

        {(status === "open" || status === "pending") && (
          <form onSubmit={activate}>
            <p>
              {status === "pending"
                ? "URL pernah diajukan untuk QR ini. Masukkan URL final dan PIN aktivasi untuk menyelesaikan aktivasi."
                : "Masukkan URL tujuan dan PIN yang diberikan admin untuk mengaktifkan QR."}
            </p>

            <label htmlFor="destination_url">
              URL tujuan
            </label>
            <input
              id="destination_url"
              type="url"
              required
              maxLength={2048}
              placeholder="https://contoh.com"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              style={inputStyle}
            />

            <label htmlFor="activation_pin">
              PIN aktivasi (6 digit)
            </label>
            <input
              id="activation_pin"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              placeholder="Contoh: 048251"
              value={pin}
              onChange={(event) =>
                setPin(
                  event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6)
                )
              }
              style={inputStyle}
            />

            <button
              type="submit"
              disabled={saving || pin.length !== 6}
              style={{
                width: "100%",
                padding: 13,
                border: 0,
                borderRadius: 8,
                background:
                  saving || pin.length !== 6
                    ? "#9ca3af"
                    : "#111827",
                color: "#fff",
                fontSize: 16,
                fontWeight: 600,
                cursor:
                  saving || pin.length !== 6
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {saving ? "Memproses aktivasi..." : "Aktifkan QR"}
            </button>

            <p role="status" style={{ overflowWrap: "anywhere" }}>
              {message}
            </p>

            <small style={{ color: "#6b7280" }}>
              PIN hanya dapat dipakai sekali. Setelah aktivasi
              berhasil, QR akan langsung mengarah ke URL tujuan.
            </small>
          </form>
        )}
      </section>
    </main>
  );
}
