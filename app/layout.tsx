import type { Metadata } from "next";
import "./globals.css";
import { ConditionalLayout } from "@/components/admin/layout/ConditionalLayout";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "GDG Admin Dashboard",
  description: "Admin panel for GDG community management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ConditionalLayout>{children}</ConditionalLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
