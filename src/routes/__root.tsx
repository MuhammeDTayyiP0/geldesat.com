import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "GeldeSat";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: `${APP_NAME} — Türkiye ilan platformu` },
      { name: "description", content: "Emlak, vasıta ve ikinci el ilanlar. Güvenli alım satım." },
      { name: "theme-color", content: "#1A4FD8" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&subset=latin,latin-ext&display=swap",
      },
    ],
  }),
  component: Root,
});

function Shell() {
  const isChat = useRouterState({
    select: (s) => s.location.pathname.startsWith("/mesajlar"),
  });
  return (
    <div className={isChat ? "flex h-dvh flex-col overflow-hidden" : "flex min-h-dvh flex-1 flex-col"}>
      <Header />
      <main className={isChat ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "flex-1 pb-24"}>
        <Outlet />
      </main>
      {isChat ? null : <Footer />}
      {isChat ? null : <CookieBanner />}
      <Toaster position="top-center" richColors />
    </div>
  );
}

function Root() {
  return (
    <html lang="tr" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-dvh flex-col">
        <AuthProvider>
          <Shell />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
