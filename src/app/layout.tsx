import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import NextTopLoader from "nextjs-toploader";
import { Toaster } from "@/components/ui/sonner";
import { PostHogProvider } from "./posthog-provider";
import { PostHogPageView } from "./posthog-pageview";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: "Tappka – Studentský portál Tiimiakatemia Prague",
    template: "%s | Tappka",
  },
  description:
    "Studentský portál pro studující a kouče:ky Tiimiakatemia Prague na PEF ČZU.",
  manifest: "/manifest.json",
  openGraph: {
    title: "Tappka – Studentský portál Tiimiakatemia Prague",
    description:
      "Studentský portál pro studující a kouče:ky Tiimiakatemia Prague na PEF ČZU.",
    url: defaultUrl,
    siteName: "Tappka",
    locale: "cs_CZ",
    type: "website",
    images: [
      {
        url: "/tap_logo.png",
        width: 512,
        height: 512,
        alt: "Tappka – Tiimiakatemia Prague",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Tappka – Studentský portál Tiimiakatemia Prague",
    description:
      "Studentský portál pro studující a kouče:ky Tiimiakatemia Prague na PEF ČZU.",
    images: ["/tap_logo.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tappka - Tiimiakatemia",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#b31b1b",
};

// TAP Brand Typography (self-hosted via next/font/local so builds never depend
// on a network connection to Google Fonts). Each weight ships a single woff2
// that already contains both the latin and latin-ext subsets (Czech diacritics).
const poppins = localFont({
  variable: "--font-poppins",
  display: "swap",
  src: [
    { path: "./fonts/poppins-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/poppins-800.woff2", weight: "800", style: "normal" },
  ],
});

const roboto = localFont({
  variable: "--font-roboto",
  display: "swap",
  src: [
    { path: "./fonts/roboto-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/roboto-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/roboto-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/roboto-700.woff2", weight: "700", style: "normal" },
  ],
});

const pacifico = localFont({
  variable: "--font-pacifico",
  display: "swap",
  src: [{ path: "./fonts/pacifico-400.woff2", weight: "400", style: "normal" }],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" suppressHydrationWarning>
      <body
        className={`${roboto.variable} ${poppins.variable} ${pacifico.variable} font-body antialiased`}
      >
        <NextTopLoader color="#b31b1b" showSpinner={false} height={3} />
        <PostHogProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <PostHogPageView />
            {children}
            <Toaster />
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
