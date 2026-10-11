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
  const [generatedPins, setGeneratedPins] = useState({});

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

async function generatePin(id) {
  setLoading(true);
  setMessage("");

  try {
    const response = await fetch(`/api/qr/${id}/pin`, {
      method: "POST",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Gagal membuat PIN.");
    }

    setGeneratedPins((current) => ({
      ...current,
      [id]: result.pin,
    }));

    setMessage(
      `PIN untuk ${result.code} berhasil dibuat. Salin PIN sebelum meninggalkan halaman.`
    );
  } catch (error) {
    setMessage(
      error instanceof Error
        ? error.message
        : "Gagal membuat PIN."
    );
  } finally {
    setLoading(false);
  }
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
  
  // Mengelompokkan QR berdasarkan status yang tersimpan
  const activatedRows = rows.filter(
    (row) => row.is_active
  );

  const waitingRows = rows.filter(
    (row) => !row.is_active && Boolean(row.destination_url)
  );

  const emptyRows = rows.filter(
    (row) => !row.is_active && !row.destination_url
  );

  // Menampilkan kartu QR untuk setiap kategori
  const renderQRRows = (items, emptyMessage) => {
    if (items.length === 0) {
      return <p style={{ color: "#777" }}>{emptyMessage}</p>;
    }

    return items.map((row) => {
      const draft = drafts[row.id] || {
        destination_url: row.destination_url || "",
        is_active: row.is_active,
      };

      return (
        <section
          key={row.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 16,
            marginTop: 12,
            background: "#fff",
          }}
        >
          <strong>{row.code}</strong>
<div
  style={{
    marginTop: 12,
    marginBottom: 16,
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 8,
  }}
>
  <button
    type="button"
    disabled={loading || row.is_active}
    onClick={() => generatePin(row.id)}
    style={{
      padding: 10,
      borderRadius: 6,
      cursor:
        loading || row.is_active
          ? "not-allowed"
          : "pointer",
    }}
  >
    {generatedPins[row.id]
      ? "Buat PIN Baru"
      : "Buat PIN Aktivasi"}
  </button>

  {generatedPins[row.id] && (
    <div style={{ marginTop: 12 }}>
      <p style={{ marginBottom: 6 }}>
        PIN aktivasi untuk {row.code}:
      </p>

      <strong
        style={{
          display: "block",
          fontSize: 28,
          letterSpacing: 5,
          marginBottom: 10,
        }}
      >
        {generatedPins[row.id]}
      </strong>

      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(
              generatedPins[row.id]
            );
            setMessage("PIN berhasil disalin.");
          } catch {
            setMessage(
              "Gagal menyalin otomatis. Silakan salin PIN secara manual."
            );
          }
        }}
      >
        Salin PIN
      </button>

      <p style={{ fontSize: 12, color: "#666" }}>
        Berikan PIN ini kepada pemilik QR.
        Simpan sebelum menutup atau memuat ulang dashboard.
      </p>
    </div>
  )}
</div>

          <p style={{ marginTop: 8 }}>
            Status:{" "}
            {row.is_active
              ? "Aktif"
              : row.destination_url
                ? "Menunggu aktivasi"
                : "QR kosong"}
          </p>

          <div style={{ marginBottom: 12 }}>
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
                  width={180}
                  height={180}
                  style={{ display: "block", background: "#fff" }}
                />

                <p>
                  <a
                    href={qrImages[row.id].dataUrl}
                    download={`${row.code}.png`}
                  >
                    Download PNG
                  </a>
                </p>
              </div>
            )}
          </div>

          <label
            htmlFor={`destination-${row.id}`}
            style={{ display: "block", marginBottom: 6 }}
          >
            Link tujuan
          </label>

          <input
            id={`destination-${row.id}`}
            type="url"
            maxLength={2048}
            placeholder="https://contoh.com"
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
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 10,
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          />

          <label
            style={{
              display: "block",
              marginTop: 12,
              marginBottom: 12,
            }}
          >
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
            type="button"
            disabled={loading}
            onClick={() => saveQR(row.id)}
            style={{ padding: 10 }}
          >
            Simpan perubahan
          </button>
        </section>
      );
    });
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

<div style={{ marginTop: 24, marginBottom: 20 }}>
  <h2>Ringkasan QR</h2>
  <p>Total QR: {rows.length}</p>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: 12,
    }}
  >
    <div style={{
      padding: 16,
      border: "1px solid #bbf7d0",
      borderRadius: 10,
      background: "#f0fdf4",
    }}>
      <p style={{ margin: 0 }}>Sudah aktif</p>
      <strong style={{ fontSize: 28 }}>
        {activatedRows.length}
      </strong>
    </div>

    <div style={{
      padding: 16,
      border: "1px solid #fde68a",
      borderRadius: 10,
      background: "#fffbeb",
    }}>
      <p style={{ margin: 0 }}>Menunggu aktivasi</p>
      <strong style={{ fontSize: 28 }}>
        {waitingRows.length}
      </strong>
    </div>

    <div style={{
      padding: 16,
      border: "1px solid #ddd",
      borderRadius: 10,
      background: "#f9fafb",
    }}>
      <p style={{ margin: 0 }}>QR kosong</p>
      <strong style={{ fontSize: 28 }}>
        {emptyRows.length}
      </strong>
    </div>
  </div>
</div>

<div style={{ display: "grid", gap: 24 }}>
  <section>
    <h2>1. QR Sudah Diaktifkan ({activatedRows.length})</h2>
    <p>QR yang sudah aktif dan siap digunakan.</p>
    {renderQRRows(
      activatedRows,
      "Belum ada QR yang diaktifkan."
    )}
  </section>

  <section>
    <h2>2. URL Menunggu Aktivasi ({waitingRows.length})</h2>
    <p>User sudah memasukkan URL, tetapi admin belum mengaktifkannya.</p>
    {renderQRRows(
      waitingRows,
      "Belum ada pengajuan URL yang menunggu aktivasi."
    )}
  </section>

  <section>
    <h2>3. QR Kosong ({emptyRows.length})</h2>
    <p>QR belum memiliki URL tujuan.</p>
    {renderQRRows(
      emptyRows,
      "Semua QR sudah memiliki URL atau sudah aktif."
    )}
  </section>
</div>
    </main>
  );
}
