import appCss from "../styles.css?url";
import plexLatin from "@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?url";
import plexLatinExt from "@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-ext-wght-normal.woff2?url";

/** The stylesheet every page links. */
export { appCss };

/** Font files every page needs: Turkish text uses both the latin and latin-ext ranges. */
export const criticalFonts = [plexLatin, plexLatinExt];

/**
 * `Link` header announcing the stylesheet and fonts. Cloudflare Early Hints
 * replays it as a 103 response, so browsers start these downloads while the
 * server is still rendering the page instead of after the HTML arrives.
 */
export const criticalAssetsLinkHeader = [
  `<${appCss}>; rel=preload; as=style`,
  ...criticalFonts.map((href) => `<${href}>; rel=preload; as=font; type="font/woff2"; crossorigin`),
].join(", ");
