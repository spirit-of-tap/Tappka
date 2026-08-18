import type { Metadata, Viewport } from "next";
import { Poppins, Roboto, Pacifico } from "next/font/google";
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
  title: "Tappka - Studentsky portal Tiimiakatemia Prague",
  description: "We do business to learn, to live fully we earn!",
  manifest: "/manifest.json",
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

// TAP Brand Typography
const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "600", "700", "800"],
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
  weight: "400",
  display: "swap",
  subsets: ["latin"],
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
