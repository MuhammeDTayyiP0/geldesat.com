import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { TopProgressBar } from "@/components/layout/TopProgressBar";
import { NotFound } from "@/components/common/NotFound";
import { DeletionBanner } from "@/components/account/DeletionBanner";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";
import plexLatin from "@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?url";
import plexLatinExt from "@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-ext-wght-normal.woff2?url";
import { jsonLd } from "@/lib/seo";

const APP_NAME = "GeldeSat";

/**
 * Instant base styles plus the first-load progress bar: a thin brand-coloured
 * line that creeps across the top while the JS loads, then Shell finishes it
 * and fades it out after hydrating. Server-rendered content stays visible throughout.
 * If hydration never happens the bar fades out on its own.
 */
const CRITICAL_CSS = `*,::before,::after{box-sizing:border-box}html{overflow-x:hidden;-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent;touch-action:manipulation;scroll-behavior:smooth}body{background-color:#f3f5f8;color:#12151c;margin:0;min-height:100dvh;font-family:"IBM Plex Sans Variable",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}#boot-progress{position:fixed;top:0;left:0;z-index:9999;height:2.5px;width:0;pointer-events:none;background:linear-gradient(90deg,#1a4fd8,#3b82f6 50%,#60a5fa);box-shadow:0 0 10px #1a4fd8,0 0 4px #3b82f6;animation:boot-grow 4s cubic-bezier(.08,.6,.3,1) forwards,boot-fade .4s ease 12s forwards}#boot-progress.done{width:100%!important;opacity:0;animation:none;transition:width .2s ease-out,opacity .3s ease .2s}@keyframes boot-grow{0%{width:0}100%{width:88%}}@keyframes boot-fade{to{opacity:0}}`;

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
      // Turkish text needs both the latin and latin-ext ranges; fetch them with the CSS.
      { rel: "preload", href: plexLatin, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "preload", href: plexLatinExt, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: jsonLd({
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
  const isAdmin = useRouterState({
    select: (s) => s.location.pathname === "/admin" || s.location.pathname.startsWith("/admin/"),
  });
  const isChat = useRouterState({
    select: (s) => s.location.pathname.startsWith("/mesajlar"),
  });
  const isChatThread = useRouterState({
    select: (s) => s.matches.some((m) => m.routeId === "/mesajlar/$id"),
  });
  const isListingDetail = useRouterState({
    select: (s) => s.matches.some((m) => m.routeId === "/ilan/$slug"),
  });
  // BottomNav shows on inbox /mesajlar and general pages, but hides in individual chat thread and listing detail (which has its own contact bar)
  const hideBottomNav = isChatThread || isListingDetail;

  // Hydrated: run the first-load bar to the end; it fades out (Root renders it, so it stays in the DOM).
  useEffect(() => {
    document.getElementById("boot-progress")?.classList.add("done");
  }, []);

  // The admin console brings its own full-screen layout.
  if (isAdmin) {
    return (
      <>
        <TopProgressBar />
        <Outlet />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  return (
    <div className={isChatThread ? "flex app-chat-shell flex-col overflow-hidden" : isChat ? "flex h-dvh flex-col overflow-hidden" : "flex min-h-dvh flex-1 flex-col"}>
      <TopProgressBar />
      <Header className={isChatThread ? "hidden md:block" : undefined} />
      {isChatThread ? null : <DeletionBanner />}
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
          <style dangerouslySetInnerHTML={{ __html: "#boot-progress{display:none!important}" }} />
        </noscript>
        <HeadContent />
      </head>
      <body className="flex min-h-dvh flex-col">
        <div id="boot-progress" aria-hidden="true" suppressHydrationWarning />
        <Shell />
        <Scripts />
      </body>
    </html>
  );
}
