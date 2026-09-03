import type { Metadata, Viewport } from "next";
import { Figtree, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/lib/context/ThemeContext";
import { AuthProvider } from "@/lib/context/AuthContext";
import { PrivacyProvider } from "@/lib/context/PrivacyContext";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Cash-Flow — Understand your money. Control your flow.",
  description:
    "A professional personal-finance platform for Kenya. Track income, expenses, savings, and goals with clarity.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeInitScript = `
(function() {
  try {
    var key = 'cash-flow-theme';
    var stored = localStorage.getItem(key);
    var theme = (stored === 'light' || stored === 'dark')
      ? stored
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.add(theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${body.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-cf-bg font-sans text-cf-text transition-colors duration-200">
        <ThemeProvider>
          <AuthProvider>
            <PrivacyProvider>
              <ToastProvider>{children}</ToastProvider>
            </PrivacyProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
