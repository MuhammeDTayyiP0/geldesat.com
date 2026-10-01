import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { TopProgressBar } from "@/components/layout/TopProgressBar";
import { NotFound } from "@/components/common/NotFound";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "GeldeSat";

/** Instant base styles + initial brand splash screen so first frame paints a clean branded spinner until styles load. */
const CRITICAL_CSS = `*,::before,::after{box-sizing:border-box}html{overflow-x:hidden;-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent;touch-action:manipulation;scroll-behavior:smooth}body{background-color:#f3f5f8;color:#12151c;margin:0;min-height:100dvh;font-family:"IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}#app-splash-loader{position:fixed;inset:0;z-index:999999;background-color:#f3f5f8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;user-select:none;transition:opacity .28s cubic-bezier(.4,0,.2,1),visibility .28s cubic-bezier(.4,0,.2,1);pointer-events:auto}.splash-spinner-wrap{position:relative;display:flex;align-items:center;justify-content:center}.splash-glow{position:absolute;inset:-8px;border-radius:9999px;background:rgba(26,79,216,.15);filter:blur(10px)}.splash-spin{animation:brand-spin-dynamic 1.35s cubic-bezier(.5,.05,.15,.95) infinite;transform-origin:center center;color:#1A4FD8}.splash-text{font-size:14px;font-weight:600;letter-spacing:.04em;color:#5a6270;margin:0;font-family:"IBM Plex Sans",-apple-system,BlinkMacSystemFont,sans-serif;animation:splash-pulse 1.5s ease-in-out infinite}@keyframes brand-spin-dynamic{0%{transform:rotate(0deg) scale(.94);filter:drop-shadow(0 0 0px rgba(26,79,216,0))}42%{transform:rotate(180deg) scale(1.08);filter:drop-shadow(0 4px 14px rgba(26,79,216,.45))}78%{transform:rotate(325deg) scale(1.02);filter:drop-shadow(0 2px 8px rgba(26,79,216,.25))}100%{transform:rotate(360deg) scale(.94);filter:drop-shadow(0 0 0px rgba(26,79,216,0))}}@keyframes splash-pulse{0%,100%{opacity:1}50%{opacity:.6}}`;

const BASE = "https://www.geldesat.com";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" },
      // Fallback title — her route kendi title'ını override eder
      { title: `${APP_NAME} — Türkiye İlan Platformu` },
      { name: "description", content: "GeldeSat — Türkiye'nin ilan platformu. Emlak, vasıta, ikinci el eşya ve hizmet ilanlarını ücretsiz verin, kolayca alın-satın. Güvenli iletişim, anlık mesajlaşma." },
      { name: "theme-color", content: "#1A4FD8" },
      { name: "application-name", content: APP_NAME },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
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
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/favicon.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
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
  const isListingDetail = useRouterState({
    select: (s) => s.matches.some((m) => m.routeId === "/ilan/$slug"),
  });
  // BottomNav shows on inbox /mesajlar and general pages, but hides in individual chat thread and listing detail (which has StickyContactBar)
  const hideBottomNav = isChatThread || isListingDetail;

  // Once client hydrates, smoothly remove initial splash overlay from DOM
  useEffect(() => {
    const el = document.getElementById("app-splash-loader");
    if (el) {
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      const t = setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 320);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <div className={isChatThread ? "flex app-chat-shell flex-col overflow-hidden" : isChat ? "flex h-dvh flex-col overflow-hidden" : "flex min-h-dvh flex-1 flex-col"}>
      <TopProgressBar />
      <Header className={isChatThread ? "hidden md:block" : undefined} />
      <main className={isChat ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "flex-1 mobile-content-space md:pb-12"}>
        <Outlet />
      </main>
      {isChat ? null : <Footer />}
      {isChatThread ? null : <CookieBanner />}
      {hideBottomNav ? null : <BottomNav />}
      <Toaster position="top-center" richColors />
    </div>
  );
}

function Root() {
  return (
    <html lang="tr" className="antialiased" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }} />
        <noscript>
          <style dangerouslySetInnerHTML={{ __html: "#app-splash-loader{display:none!important}" }} />
        </noscript>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `setTimeout(function(){var e=document.getElementById("app-splash-loader");if(e){e.style.opacity="0";e.style.pointerEvents="none";setTimeout(function(){if(e.parentNode)e.parentNode.removeChild(e)},300)}},2500);`,
          }}
        />
      </head>
      <body className="flex min-h-dvh flex-col">
        {/* Brand Splash Screen — visible until CSS and initial paint finish */}
        <div id="app-splash-loader" aria-hidden="true">
          <div className="splash-spinner-wrap">
            <div className="splash-glow" />
            <div className="splash-spin">
              <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" width="56" height="56" fill="none">
                <path
                  d="M36 12 H 24 A 12 12 0 0 0 12 24 V 28 A 4 4 0 0 0 16 32 H 48 A 4 4 0 0 1 52 36 V 40 A 12 12 0 0 1 40 52 H 28"
                  stroke="#1A4FD8"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M24 32 H 32" stroke="#1A4FD8" strokeWidth="8" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <p className="splash-text">GeldeSat</p>
        </div>
        <Shell />
        <Scripts />
      </body>
    </html>
  );
}
