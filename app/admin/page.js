"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";


export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [prefix, setPrefix] = useState("QR");
  const [count, setCount] = useState("10");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrImages, setQrImages] = useState({});

  const loadRows = useCallback(async () => {
    const response = await fetch("/api/qr", {
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (response.status === 401) {
      setLoggedIn(false);
      return;
    }

    if (!response.ok) {
      throw new Error(result.error || "Gagal mengambil data QR.");
    }

    setRows(result.data || []);
    setDrafts(
      Object.fromEntries(
        (result.data || []).map((row) => [
          row.id,
          {
            destination_url: row.destination_url || "",
            is_active: row.is_active,
          },
        ])
      )
    );
    setLoggedIn(true);
  }, []);

  useEffect(() => {
    loadRows().catch((error) => setMessage(error.message));
  }, [loadRows]);

  async function login(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Login gagal.");
      }

      setPassword("");
      await loadRows();
      setMessage("Login berhasil.");
    } catch (error) {
      setMessage(error.message || "Login gagal.");
    } finally {
      setLoading(false);
    }
  }

  async function createQR(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix,
          count: Number(count),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal membuat QR.");
      }

      await loadRows();
      setMessage(`${result.data.length} QR berhasil dibuat.`);
    } catch (error) {
      setMessage(error.message || "Gagal membuat QR.");
    } finally {
      setLoading(false);
    }
  }

  async function saveQR(id) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/qr/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(drafts[id]),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal menyimpan QR.");
      }

      await loadRows();
      setMessage(`QR ${result.data.code} berhasil disimpan.`);
    } catch (error) {
      setMessage(error.message || "Gagal menyimpan QR.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setLoggedIn(false);
    setRows([]);
    setDrafts({});
    setMessage("Kamu sudah logout.");
  }

async function generateQR(row) {
  try {
    const baseUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      window.location.origin
    ).replace(/\/+$/, "");

    const qrUrl =
      `${baseUrl}/q/${encodeURIComponent(row.code)}`;

    const dataUrl = await QRCode.toDataURL(qrUrl, {
      width: 600,
      margin: 3,
      errorCorrectionLevel: "H",
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    setQrImages((current) => ({
      ...current,
      [row.id]: {
        dataUrl,
        url: qrUrl,
      },
    }));

    setMessage(`Gambar QR ${row.code} berhasil dibuat.`);
  } catch (error) {
    console.error("Gagal membuat QR:", error);
    setMessage("Gagal membuat QR. Coba lagi.");
  }
}

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: 10,
    border: "1px solid #ccc",
    borderRadius: 6,
  };

  if (!loggedIn) {
    return (
      <main style={{
        maxWidth: 420,
        margin: "70px auto",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}>
        <h1>QR Admin</h1>
        <p>Login untuk mengelola QR Code kamu.</p>

        <form onSubmit={login}>
          <label>Password admin</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            style={{ ...fieldStyle, marginTop: 8, marginBottom: 14 }}
          />

          <button disabled={loading} style={{ padding: 12 }}>
            {loading ? "Memproses..." : "Login"}
          </button>
        </form>

        <p role="status">{message}</p>
      </main>
    );
  }

  return (
    <main style={{
      maxWidth: 1000,
      margin: "30px auto",
      padding: 20,
      fontFamily: "Arial, sans-serif",
    }}>
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <h1>Dashboard QR Admin</h1>
        <button onClick={logout}>Logout</button>
      </header>

      <hr />

      <h2>Buat QR baru</h2>

      <form
        onSubmit={createQR}
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "end",
        }}
      >
        <label>
          Prefix
          <input
            value={prefix}
            onChange={(event) => setPrefix(event.target.value)}
            required
            maxLength={20}
            style={{ ...fieldStyle, width: 150 }}
          />
        </label>

        <label>
          Jumlah QR
          <input
            type="number"
            min="1"
            max="500"
            value={count}
            onChange={(event) => setCount(event.target.value)}
            required
            style={{ ...fieldStyle, width: 120 }}
          />
        </label>

        <button disabled={loading} style={{ padding: 11 }}>
          Buat QR
        </button>
      </form>

      <p role="status">{message}</p>

      <h2>Daftar QR ({rows.length})</h2>

      {rows.length === 0 ? (
        <p>Belum ada QR. Buat QR pertama melalui form di atas.</p>
      ) : (
        rows.map((row) => {
          const draft = drafts[row.id] || {
            destination_url: "",
            is_active: false,
          };

          return (
            <section
              key={row.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: 16,
                marginBottom: 14,
              }}
            >
              <strong>{row.code}</strong>

<div style={{ marginTop: 12, marginBottom: 12 }}>
  <button
    type="button"
    onClick={() => generateQR(row)}
  >
    {qrImages[row.id] ? "Perbarui QR" : "Buat gambar QR"}
  </button>

  {qrImages[row.id] && (
    <div style={{ marginTop: 12 }}>
      <img
        src={qrImages[row.id].dataUrl}
        alt={`QR Code ${row.code}`}
        width={240}
        height={240}
        style={{
          display: "block",
          background: "#fff",
          padding: 8,
          border: "1px solid #ddd",
          borderRadius: 8,
        }}
      />

      <p>
        <a
          href={qrImages[row.id].dataUrl}
          download={`${row.code}.png`}
        >
          Download PNG
        </a>
      </p>

      <small style={{ wordBreak: "break-all" }}>
        Alamat QR: {qrImages[row.id].url}
      </small>
    </div>
  )}
</div>

              <p>
                Status tersimpan:{" "}
                {row.is_active ? "Aktif" : "Nonaktif"}
              </p>

              <label>Link tujuan</label>
              <input
                type="url"
                placeholder="https://contoh.com/produk"
                value={draft.destination_url}
                onChange={(event) =>
                  setDrafts((old) => ({
                    ...old,
                    [row.id]: {
                      ...draft,
                      destination_url: event.target.value,
                    },
                  }))
                }
                style={{ ...fieldStyle, marginTop: 6, marginBottom: 12 }}
              />

              <label style={{ display: "block", marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(event) =>
                    setDrafts((old) => ({
                      ...old,
                      [row.id]: {
                        ...draft,
                        is_active: event.target.checked,
                      },
                    }))
                  }
                />{" "}
                Aktifkan QR
              </label>

              <button
                disabled={loading}
                onClick={() => saveQR(row.id)}
                style={{ padding: 10 }}
              >
                Simpan perubahan
              </button>
            </section>
          );
        })
      )}
    </main>
  );
}
