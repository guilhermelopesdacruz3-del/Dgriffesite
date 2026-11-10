/**
 * e2e bloco 2 — regressão pós-auditoria: login (zod 4), arquivos do
 * rastreador facial self-hostados (A11) e JSON-LD escapado (A8).
 */
const BASE = "http://localhost:3000";
let passed = 0;
const failed = [];

function check(name, cond, detail = "") {
  if (cond) {
    passed += 1;
    console.log(`✓ ${name}`);
  } else {
    failed.push(name);
    console.log(`✗ ${name} — ${detail}`);
  }
}

// ---------- 1. A11: provador 100% self-hosted ----------
const task = await fetch(`${BASE}/mediapipe/face_landmarker.task`);
check("face_landmarker.task servido localmente (200)", task.status === 200, `status=${task.status}`);
check("tamanho do modelo coerente (~3,7MB)", Number(task.headers.get("content-length") ?? 0) > 3_000_000);
const wasm = await fetch(`${BASE}/mediapipe/wasm/vision_wasm_internal.js`);
check("wasm loader servido localmente", wasm.status === 200, `status=${wasm.status}`);

// A PDP não deve apontar para CDNs do MediaPipe
const pdp = await fetch(`${BASE}/produtos/aura-redonda`);
const pdpHtml = await pdp.text();
check("PDP sem referência ao CDN do MediaPipe (storage.googleapis)", !pdpHtml.includes("storage.googleapis.com/mediapipe"));
check("PDP sem referência ao jsdelivr", !pdpHtml.includes("cdn.jsdelivr.net"));

// ---------- 2. A8: JSON-LD escapado ----------
const m = pdpHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
check("PDP tem JSON-LD", Boolean(m), "sem bloco ld+json");
if (m) {
  check("JSON-LD sem '<' cru (escape \\u003c)", !m[1].includes("<"), m[1].slice(0, 80));
  // e o JSON continua parseável
  let parsed = null;
  try {
    parsed = JSON.parse(m[1]);
  } catch {
    parsed = null;
  }
  check("JSON-LD parseável", parsed !== null);
}

// ---------- 3. zod 4: login continua funcionando (fluxo NextAuth) ----------
const csrf = await fetch(`${BASE}/api/auth/csrf`);
const { csrfToken } = await csrf.json();
const login = await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: "POST",
  redirect: "manual",
  headers: {
    "content-type": "application/x-www-form-urlencoded",
    cookie: csrf.headers.get("set-cookie")?.split(";")[0] ?? "",
  },
  body: new URLSearchParams({
    csrfToken,
    email: "admin@dgriffe.test",
    password: "Admin@1234",
    callbackUrl: "/admin",
  }),
});
const setCookie = login.headers.getSetCookie?.() ?? [login.headers.get("set-cookie")].filter(Boolean);
check("Login admin → 302 (autorizou)", login.status === 302 || login.status === 200, `status=${login.status}`);
check(
  "Login admin → cookie de sessão emitido",
  setCookie.some((c) => c.includes("authjs.session-token") && !c.includes("authjs.session-token.mf")),
  setCookie.join(" | ").slice(0, 120),
);

// rota protegida de admin com a sessão do admin
const sessionCookie = setCookie
  .filter((c) => c.includes("authjs.session-token"))
  .map((c) => c.split(";")[0])
  .join("; ");
check("Token de sessão obtido", sessionCookie.includes("authjs.session-token"), "sessão não emitida");
const adminPage = await fetch(`${BASE}/admin`, { headers: { cookie: sessionCookie }, redirect: "manual" });
check("Admin logado acessa /admin", adminPage.status === 200, `status=${adminPage.status}`);

// ---------- 4. zod 4: login com senha errada continua recusando ----------
const { csrfToken: t2 } = await (await fetch(`${BASE}/api/auth/csrf`)).json();
const bad = await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: "POST",
  redirect: "manual",
  headers: {
    "content-type": "application/x-www-form-urlencoded",
    cookie: (await fetch(`${BASE}/api/auth/csrf`)).headers.get("set-cookie")?.split(";")[0] ?? "",
  },
  body: new URLSearchParams({
    csrfToken: t2,
    email: "admin@dgriffe.test",
    password: "senha-wrong-111",
    callbackUrl: "/entrar?erro=1",
  }),
});
const erro = (await bad.text()).includes("CredentialsSignin") || (bad.headers.get("location") ?? "").includes("error");
check("Senha errada é recusada", bad.status === 401 || erro, `status=${bad.status}`);

// ---------- 5. home continua renderizando (regressão geral) ----------
const home = await fetch(`${BASE}/`);
check("Home 200", home.status === 200, `status=${home.status}`);

console.log(`\n${passed} passou(m), ${failed.length} falhou(m): ${failed.join(", ") || "—"}`);
process.exit(failed.length ? 1 : 0);
