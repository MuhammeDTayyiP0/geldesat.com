import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { TopProgressBar } from "@/components/layout/TopProgressBar";
import { NotFound } from "@/components/common/NotFound";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "GeldeSat";

/** Instant base styles so first frame paints immediately without flash of unstyled content or layout shifts. */
const CRITICAL_CSS = `*,::before,::after{box-sizing:border-box}html{overflow-x:hidden;-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent;touch-action:manipulation;scroll-behavior:smooth}body{background-color:#f3f5f8;color:#12151c;margin:0;min-height:100dvh;font-family:"IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}svg{display:inline-block;vertical-align:middle;max-width:100%}header svg{width:1.5rem;height:1.5rem}img{max-width:100%;height:auto}.site-header,header{height:4rem;min-height:4rem}a{color:inherit;text-decoration:none}button,input,select,textarea{font:inherit}button,[role="button"]{cursor:pointer}.max-w-6xl{max-width:72rem;margin-left:auto;margin-right:auto}`;

const BASE = "https://www.geldesat.com";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, interactive-widget=resizes-content" },
      // Fallback title — her route kendi title'ını override eder
      { title: `${APP_NAME} — Türkiye İlan Platformu` },
      { name: "description", content: "GeldeSat — Türkiye'nin ilan platformu. Emlak, vasıta, ikinci el eşya ve hizmet ilanlarını ücretsiz verin, kolayca alın-satın. Güvenli iletişim, anlık mesajlaşma." },
      { name: "theme-color", content: "#1A4FD8" },
      { name: "robots", content: "index,follow" },
      // Coğrafi meta etiketler — Türkiye aramaları için
      { name: "geo.region", content: "TR" },
      { name: "geo.country", content: "Turkey" },
      { name: "geo.placename", content: "Türkiye" },
      { name: "language", content: "Turkish" },
      // Open Graph
      { property: "og:site_name", content: APP_NAME },
      { property: "og:locale", content: "tr_TR" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: `${APP_NAME} — Türkiye İlan Platformu` },
      { property: "og:description", content: "Emlak, vasıta ve ikinci el ilanlar. Güvenli alım satım." },
      { property: "og:image", content: `${BASE}/og.jpg` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:url", content: BASE },
      // Twitter / X
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@geldesat" },
      { name: "twitter:title", content: `${APP_NAME} — Türkiye İlan Platformu` },
      { name: "twitter:description", content: "Emlak, vasıta ve ikinci el ilanlar. Güvenli alım satım." },
      { name: "twitter:image", content: `${BASE}/og.jpg` },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
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
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: APP_NAME,
          url: BASE,
          logo: `${BASE}/og.jpg`,
          image: `${BASE}/og.jpg`,
          sameAs: [],
          contactPoint: [
            {
              "@type": "ContactPoint",
              contactType: "customer support",
              availableLanguage: "Turkish",
              url: `${BASE}/sayfa/iletisim`,
            },
          ],
        }),
      },
    ],
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
      <main className={isChat ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "flex-1 pb-24 md:pb-12"}>
        <Outlet />
      </main>
      {isChat ? null : <Footer />}
      {isChat ? null : <CookieBanner />}
      {isChat ? null : <BottomNav />}
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
