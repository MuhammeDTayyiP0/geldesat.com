import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { TopProgressBar } from "@/components/layout/TopProgressBar";
import { NotFound } from "@/components/common/NotFound";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "GeldeSat";

/** Inline, render-blocking paint so the first frame is never unstyled HTML. */
const CRITICAL_CSS = `html,body{background:#f3f5f8;color:#12151c}body{margin:0;min-height:100dvh;visibility:hidden;font-family:"IBM Plex Sans","Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, interactive-widget=resizes-content" },
      { title: `${APP_NAME} — Türkiye ilan platformu` },
      { name: "description", content: "GeldeSat — Türkiye'nin ilan platformu. Emlak, vasıta, ikinci el eşya ve hizmet ilanlarını ücretsiz verin, kolayca alın-satın. Güvenli iletişim, anlık mesajlaşma." },
      { name: "theme-color", content: "#1A4FD8" },
      { name: "robots", content: "index,follow" },
      // Open Graph
      { property: "og:site_name", content: APP_NAME },
      { property: "og:locale", content: "tr_TR" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: `${APP_NAME} — Türkiye ilan platformu` },
      { property: "og:description", content: "Emlak, vasıta ve ikinci el ilanlar. Güvenli alım satım." },
      { property: "og:image", content: "https://geldesat.com/og.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:url", content: "https://geldesat.com" },
      // Twitter / X
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: `${APP_NAME} — Türkiye ilan platformu` },
      { name: "twitter:description", content: "Emlak, vasıta ve ikinci el ilanlar. Güvenli alım satım." },
      { name: "twitter:image", content: "https://geldesat.com/og.jpg" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preload", href: appCss, as: "style" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&subset=latin,latin-ext&display=optional",
      },
    ],
    styles: [{ children: CRITICAL_CSS }],
  }),
  component: Root,
  notFoundComponent: () => <NotFound />,
});


function Shell() {
  const isChat = useRouterState({
    select: (s) => s.location.pathname.startsWith("/mesajlar"),
  });
  const isChatThread = useRouterState({
    select: (s) => s.matches.some((m) => m.routeId === "/mesajlar/$id"),
  });
  return (
    <div className={isChat ? "flex h-dvh flex-col overflow-hidden" : "flex min-h-dvh flex-1 flex-col"}>
      <TopProgressBar />
      <Header className={isChatThread ? "hidden md:block" : undefined} />
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
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }} />
        <HeadContent />
      </head>
      <body className="flex min-h-dvh flex-col">
        <PreviewHostBridge />
        <AuthProvider>
          <Shell />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
