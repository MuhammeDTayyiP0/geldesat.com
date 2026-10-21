#!/usr/bin/env node
/**
 * Publish an over-the-air update to our own server (no EAS, no limits).
 *
 *   npm run ota -- --message "İlan kartı yenilendi"
 *   npm run ota -- --message "Deneme" --channel preview
 *   npm run ota -- --message "Yeni sohbet" --rollout 10
 *   npm run ota -- --message "Çökme düzeltmesi" --critical
 *
 * Options:
 *   --message, -m   What changed (shown in the admin panel).            required
 *   --channel       production (store builds) or preview (test APKs).   default production
 *   --platform      android | ios | all                                 default all
 *   --rollout       Share of devices that get it, 0-100.                default 100
 *   --critical      Restart the app as soon as the update is downloaded.
 *   --server        Site URL.                                           default app.json extra.apiBaseUrl
 *   --dry-run       Build and hash, but do not upload.
 *
 * Needs GELDESAT_OTA_TOKEN (same value as OTA_PUBLISH_TOKEN on the server), from
 * the environment or mobile-app/.env.local. See OTA_GUNCELLEME.md.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = "dist-ota";
const BATCH_BYTES = 8 * 1024 * 1024;

const CONTENT_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
  json: "application/json",
  js: "application/javascript",
  html: "text/html",
  txt: "text/plain",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  lottie: "application/json",
};

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { channel: "production", platform: "all", rollout: 100, critical: false, dryRun: false, message: "", server: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) fail(`${arg} için değer eksik.`);
      return v;
    };
    if (arg === "--message" || arg === "-m") opts.message = next();
    else if (arg === "--channel") opts.channel = next();
    else if (arg === "--platform") opts.platform = next();
    else if (arg === "--rollout") opts.rollout = Number(next());
    else if (arg === "--server") opts.server = next();
    else if (arg === "--critical") opts.critical = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else fail(`Bilinmeyen seçenek: ${arg}`);
  }
  if (!opts.message.trim()) fail('Ne değiştiğini yazın: --message "…"');
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(opts.channel)) fail("Kanal küçük harf, rakam ve - olmalı (ör. production, preview).");
  if (!["android", "ios", "all"].includes(opts.platform)) fail("--platform android, ios ya da all olmalı.");
  if (!Number.isInteger(opts.rollout) || opts.rollout < 0 || opts.rollout > 100) fail("--rollout 0 ile 100 arasında bir tam sayı olmalı.");
  return opts;
}

function readToken() {
  if (process.env.GELDESAT_OTA_TOKEN) return process.env.GELDESAT_OTA_TOKEN.trim();
  const file = join(root, ".env.local");
  if (!existsSync(file)) return "";
  const line = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("GELDESAT_OTA_TOKEN="));
  return line ? line.slice("GELDESAT_OTA_TOKEN=".length).trim().replace(/^["']|["']$/g, "") : "";
}

function run(command, { capture = false } = {}) {
  const result = spawnSync(command, { cwd: root, shell: true, stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit", encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) fail(`Komut başarısız oldu: ${command}`);
  return result.stdout ?? "";
}

/** The runtime this JS was built for; must match the store build (app.json runtimeVersion). */
function runtimeVersionOf(exp) {
  const rv = exp.runtimeVersion;
  if (typeof rv === "string") return rv;
  if (rv && typeof rv === "object" && rv.policy === "appVersion") return exp.version;
  fail('app.json\'da runtimeVersion bir metin ya da { "policy": "appVersion" } olmalı.');
}

const describe = (path, ext, isLaunch) => {
  const data = readFileSync(join(root, OUT, path));
  const normalizedExt = (ext ?? extname(path).slice(1)).toLowerCase();
  return {
    path,
    data,
    asset: {
      hash: createHash("sha256").update(data).digest("base64url"),
      key: createHash("md5").update(data).digest("hex"),
      contentType: isLaunch ? "application/javascript" : (CONTENT_TYPES[normalizedExt] ?? "application/octet-stream"),
      ...(isLaunch ? {} : normalizedExt ? { fileExtension: `.${normalizedExt}` } : {}),
    },
  };
};

async function api(server, token, path, init) {
  let res;
  try {
    res = await fetch(`${server}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  } catch (err) {
    fail(`${server} adresine ulaşılamadı: ${err.message}`);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) fail(`Sunucu hatası (${res.status}): ${body?.error ?? res.statusText}`);
  return body;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const token = readToken();
  if (!opts.dryRun && token.length < 24) fail("GELDESAT_OTA_TOKEN bulunamadı (ortam değişkeni ya da mobile-app/.env.local).");

  console.log("• Uygulama ayarları okunuyor…");
  const exp = JSON.parse(run("npx expo config --json --type public", { capture: true }));
  const runtimeVersion = runtimeVersionOf(exp);
  const server = (opts.server || exp.extra?.apiBaseUrl || "https://www.geldesat.com").replace(/\/+$/, "");
  const platforms = opts.platform === "all" ? ["android", "ios"] : [opts.platform];

  console.log(`• Kod paketleniyor (${platforms.join(", ")})…`);
  rmSync(join(root, OUT), { recursive: true, force: true });
  run(`npx expo export --output-dir ${OUT} ${platforms.map((p) => `--platform ${p}`).join(" ")}`);

  const metadata = JSON.parse(readFileSync(join(root, OUT, "metadata.json"), "utf8"));
  const files = new Map();
  const bundles = {};
  for (const platform of platforms) {
    const meta = metadata.fileMetadata?.[platform];
    if (!meta?.bundle) fail(`${platform} paketi oluşmadı (dist-ota/metadata.json).`);
    const launch = describe(meta.bundle, null, true);
    const assets = (meta.assets ?? []).map((a) => describe(a.path, a.ext, false));
    for (const f of [launch, ...assets]) files.set(f.asset.hash, f);
    bundles[platform] = { launchAsset: launch.asset, assets: assets.map((a) => a.asset) };
  }
  const totalBytes = [...files.values()].reduce((n, f) => n + f.data.byteLength, 0);
  console.log(`• ${files.size} dosya, ${(totalBytes / 1024 / 1024).toFixed(1)} MB · sürüm ${runtimeVersion} · kanal ${opts.channel} · %${opts.rollout}${opts.critical ? " · kritik" : ""}`);

  if (opts.dryRun) {
    console.log("\n✓ Deneme bitti (--dry-run): hiçbir şey yüklenmedi.");
    return;
  }

  const { missing } = await api(server, token, "/api/ota/publish/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hashes: [...files.keys()] }),
  });
  console.log(`• ${missing.length} yeni dosya yükleniyor (${files.size - missing.length} tanesi sunucuda zaten var)…`);

  let batch = new FormData();
  let batchBytes = 0;
  let sent = 0;
  const flush = async () => {
    if (!batchBytes) return;
    await api(server, token, "/api/ota/publish/assets", { method: "POST", body: batch });
    batch = new FormData();
    batchBytes = 0;
  };
  for (const hash of missing) {
    const f = files.get(hash);
    if (!f) continue;
    if (batchBytes && batchBytes + f.data.byteLength > BATCH_BYTES) await flush();
    batch.append(hash, new Blob([f.data], { type: f.asset.contentType }), f.path.split("/").pop());
    batchBytes += f.data.byteLength;
    sent += 1;
    process.stdout.write(`\r  ${sent}/${missing.length}`);
  }
  await flush();
  if (missing.length) process.stdout.write("\n");

  const result = await api(server, token, "/api/ota/publish/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      runtimeVersion,
      channel: opts.channel,
      message: opts.message.trim(),
      rollout: opts.rollout,
      critical: opts.critical,
      expoClient: exp,
      platforms: bundles,
    }),
  });

  rmSync(join(root, OUT), { recursive: true, force: true });
  console.log(`\n✓ Yayınlandı (${result.groupId}). Telefonlar uygulamayı açınca indirir, bir sonraki açılışta kullanır.`);
  console.log(`  Durdurmak, yüzdeyi değiştirmek ya da geri almak için: ${server}/admin/guncellemeler`);
}

await main();
