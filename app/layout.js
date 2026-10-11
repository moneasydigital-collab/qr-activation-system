export const metadata = {
  title: "QR Activation System",
  description: "Dynamic QR Code Activation System"
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
