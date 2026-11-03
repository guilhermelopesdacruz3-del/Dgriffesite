/**
 * @type {import('next').NextConfig}
 *
 * Modo ESTÁTICO (STATIC_EXPORT=1): usado pelo `scripts/build-demo-zip.mjs`
 * para gerar o ZIP de demonstração (arrastar no Netlify Drop). Produção
 * normal continua como servidor Next completo.
 */

const isStaticExport = process.env.STATIC_EXPORT === "1";
const isDev = process.env.NODE_ENV !== "production";

const staticOnly = isStaticExport
  ? { output: "export", trailingSlash: true, images: { unoptimized: true } }
  : {};

// ---------------------------------------------------------------
// Origens de imagens permitidas (auditoria A19): a lista é FIXA —
// picsum (seed/demo) + o endpoint do armazenamento dos uploads.
// O antigamente usado `hostname: "**"` deixava next/image carregar
// imagem de QUALQUER host https, o que facilita rastreamento de
// visualizações e conteúdo misto após um eventual comprometimento.
// ---------------------------------------------------------------
const imageRemotePatterns = [
  { protocol: "https", hostname: "picsum.photos" },
  { protocol: "https", hostname: "fastly.picsum.photos" },
];
for (const envUrl of [process.env.AWS_ENDPOINT_URL_S3]) {
  if (envUrl) {
    const { protocol, hostname } = new URL(envUrl);
    imageRemotePatterns.push({ protocol: protocol.replace(":", ""), hostname });
  }
}

/**
 * Cabeçalhos de segurança (auditoria A7 — CSP, HSTS e reforços):
 *  • CSP controla de onde scripts/imagens/conexões podem vir;
 *  • Permissions-Policy libera a câmera APENAS para o próprio site
 *    (provador 3D) e fecha microfone/geolocalização;
 *  • HSTS pede https ao navegador por 1 ano.
 * Nota de manutenção: `connect-src` inclui a origem do armazenamento (o
 * provador busca o .glb do modelo 3D lá); imagens usam a lista acima. Se
 * trocar a hospedagem de imagens, atualize os dois blocos juntos.
 */
const isProd = process.env.NODE_ENV === "production";
const csp = [
  `default-src 'self'`,
  // Next injeta scripts inline (hidratação); dev também precisa de eval (HMR).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  // Auditoria (A11): o rastreador facial e o modelo são servidos de
  // /public/mediapipe — nenhuma terceira origem é necessária na conexão.
  `connect-src 'self' ${process.env.AWS_ENDPOINT_URL_S3 ?? ""} ${
    isDev ? "ws://localhost:3000 ws://127.0.0.1:3000" : ""
  }`.trim(),
  `media-src 'self' blob:`,
  `worker-src 'self' blob:`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // HSTS só em produção (em dev http a imperativa força não faz sentido).
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

/** Aplica os cabeçalhos a todas as rotas. */
function securityHeaderRoutes() {
  return [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ];
}

const nextConfig = {
  reactStrictMode: true,
  ...staticOnly,
  ...(isStaticExport ? {} : { headers: securityHeaderRoutes }),
  images: {
    unoptimized: isStaticExport,
    remotePatterns: imageRemotePatterns,
  },
  eslint: {
    // O lint roda separadamente (`npm run lint`); o build exige apenas tipos válidos.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
