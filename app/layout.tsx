import type { Metadata } from "next";
import { Poppins, Roboto, Pacifico } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Tiimiakatemia Prague - Studuj jinak!",
  description: "We do business to learn, to live fully we earn!",
};

// TAP Brand Typography
const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "600", "700", "800"], // Include Bold (700) for headings
  display: "swap",
  subsets: ["latin", "latin-ext"],
});

const roboto = Roboto({
  variable: "--font-roboto", 
  weight: ["300", "400", "500", "700"],
  display: "swap",
  subsets: ["latin", "latin-ext"],
});

const pacifico = Pacifico({
  variable: "--font-pacifico",
  weight: "400", // Pacifico only has regular weight
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${roboto.variable} ${poppins.variable} ${pacifico.variable} font-body antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
