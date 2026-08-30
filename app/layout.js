// app/layout.js
// Root layout required by Next.js App Router

export const metadata = {
  title: 'AmberSSHVPN',
  description: 'Payment app',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
