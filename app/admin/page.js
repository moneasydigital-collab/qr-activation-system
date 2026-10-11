"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrImages, setQrImages] = useState({});

  // Mengambil data QR dari server
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
      throw new Error(
        result.error || "Gagal mengambil data QR."
      );
    }

    const data = result.data || [];

    setRows(data);

    setDrafts(
      Object.fromEntries(
        data.map((row) => [
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
    loadRows().catch((error) => {
      setMessage(error.message || "Gagal memuat dashboard.");
    });
  }, [loadRows]);

  // Login admin
  async function login(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      setMessage(
        error instanceof Error ? error.message : "Login gagal."
      );
    } finally {
      setLoading(false);
    }
  }

  // Simpan URL dan status QR
  async function saveQR(id) {
    const draft = drafts[id];

    if (!draft) {
      setMessage("Data QR belum siap.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/qr/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          destination_url: draft.destination_url,
          is_active: draft.is_active,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Gagal menyimpan QR."
        );
      }

      await loadRows();
      setMessage(
        `QR ${result.data.code} berhasil disimpan.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan QR."
      );
    } finally {
      setLoading(false);
    }
  }

  // Logout admin
  async function logout() {
    try {
      await fetch("/api/logout", {
        method: "POST",
      });
    } finally {
      setLoggedIn(false);
      setRows([]);
      setDrafts({});
      setQrImages({});
      setMessage("Kamu sudah logout.");
    }
  }

  // Membuat gambar QR untuk kode yang sudah ada
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

      setMessage(
        `Gambar QR ${row.code} berhasil dibuat.`
      );
    } catch (error) {
      console.error("Gagal membuat QR:", error);
      setMessage("Gagal membuat gambar QR. Coba lagi.");
    }
  }

  // Menyiapkan draft URL dan status
  function updateDraft(id, changes) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {
          destination_url: "",
          is_active: false,
        }),
        ...changes,
      },
    }));
  }

  const fieldStyle = {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    padding: 10,
    border: "1px solid #ccc",
    borderRadius: 6,
    marginTop: 6,
  };

  // Tiga kategori berdasarkan data yang tersimpan
  const activatedRows = rows.filter(
    (row) => row.is_active
  );

  const waitingRows = rows.filter(
    (row) => !row.is_active && Boolean(row.destination_url)
  );

  const emptyRows = rows.filter(
    (row) => !row.is_active && !row.destination_url
  );

  // Tampilan setiap QR
  function renderQRRows(items, emptyMessage) {
    if (items.length === 0) {
      return (
        <p style={{ color: "#777" }}>
          {emptyMessage}
        </p>
      );
    }

    return items.map((row) => {
      const draft = drafts[row.id] || {
        destination_url: row.destination_url || "",
        is_active: row.is_active,
      };

      const image = qrImages[row.id];

      return (
        <section
          key={row.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 16,
            marginTop: 12,
            background: "#fff",
            color: "#111",
          }}
        >
          <strong style={{ fontSize: 18 }}>
            {row.code}
          </strong>

          <p>
            Status tersimpan:{" "}
            {row.is_active
              ? "Aktif"
              : row.destination_url
                ? "Menunggu aktivasi"
                : "QR kosong"}
          </p>

          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => generateQR(row)}
            >
              {image ? "Perbarui gambar QR" : "Buat gambar QR"}
            </button>

            {image && (
              <div style={{ marginTop: 12 }}>
                <img
                  src={image.dataUrl}
                  alt={`QR Code ${row.code}`}
                  width={200}
                  height={200}
                  style={{
                    display: "block",
                    background: "#fff",
                    border: "1px solid #ddd",
                    padding: 6,
                    borderRadius: 8,
                  }}
                />

                <p>
                  <a
                    href={image.dataUrl}
                    download={`${row.code}.png`}
                  >
                    Download PNG
                  </a>
                </p>

                <small
                  style={{
                    display: "block",
                    overflowWrap: "anywhere",
                    color: "#555",
                  }}
                >
                  {image.url}
                </small>
              </div>
            )}
          </div>

          <label
            htmlFor={`destination-${row.id}`}
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
              updateDraft(row.id, {
                destination_url: event.target.value,
              })
            }
            style={fieldStyle}
          />

          <label
            style={{
              display: "block",
              marginTop: 14,
              marginBottom: 14,
            }}
          >
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(event) =>
                updateDraft(row.id, {
                  is_active: event.target.checked,
                })
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
            {loading ? "Menyimpan..." : "Simpan perubahan"}
          </button>
        </section>
      );
    });
  }

  // Halaman login
  if (!loggedIn) {
    return (
      <main
        style={{
          maxWidth: 420,
          margin: "70px auto",
          padding: 24,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h1>QR Admin</h1>
        <p>Login untuk mengelola QR Code kamu.</p>

        <form onSubmit={login}>
          <label htmlFor="admin-password">
            Password admin
          </label>

          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            required
            style={{
              ...fieldStyle,
              marginBottom: 14,
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{ padding: 12 }}
          >
            {loading ? "Memproses..." : "Login"}
          </button>
        </form>

        <p role="status">{message}</p>
      </main>
    );
  }

  // Dashboard admin
  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "30px auto",
        padding: 20,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h1>Dashboard QR Admin</h1>

        <button
          type="button"
          onClick={logout}
        >
          Logout
        </button>
      </header>

      <hr />

      <p role="status">{message}</p>

      <div style={{ marginTop: 24, marginBottom: 20 }}>
        <h2>Ringkasan QR</h2>
        <p>Total QR: {rows.length}</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              padding: 16,
              border: "1px solid #bbf7d0",
              borderRadius: 10,
              background: "#f0fdf4",
            }}
          >
            <p style={{ margin: 0 }}>Sudah aktif</p>
            <strong style={{ fontSize: 28 }}>
              {activatedRows.length}
            </strong>
          </div>

          <div
            style={{
              padding: 16,
              border: "1px solid #fde68a",
              borderRadius: 10,
              background: "#fffbeb",
            }}
          >
            <p style={{ margin: 0 }}>Menunggu aktivasi</p>
            <strong style={{ fontSize: 28 }}>
              {waitingRows.length}
            </strong>
          </div>

          <div
            style={{
              padding: 16,
              border: "1px solid #ddd",
              borderRadius: 10,
              background: "#f9fafb",
            }}
          >
            <p style={{ margin: 0 }}>QR kosong</p>
            <strong style={{ fontSize: 28 }}>
              {emptyRows.length}
            </strong>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 24 }}>
        <section>
          <h2>
            1. QR Sudah Diaktifkan ({activatedRows.length})
          </h2>
          <p>QR yang sudah aktif dan siap digunakan.</p>
          {renderQRRows(
            activatedRows,
            "Belum ada QR yang diaktifkan."
          )}
        </section>

        <section>
          <h2>
            2. URL Menunggu Aktivasi ({waitingRows.length})
          </h2>
          <p>
            User sudah memasukkan URL, tetapi QR belum aktif.
          </p>
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
