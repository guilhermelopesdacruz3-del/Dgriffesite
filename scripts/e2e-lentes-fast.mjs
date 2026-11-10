/** Teste específico da tela /admin/lentes (Fase 13). Uso: node scripts/e2e-lentes-fast.mjs [base] */
const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");

const csrf = await fetch(`${BASE}/api/auth/csrf`);
const { csrfToken } = await csrf.json();
const login = await fetch(`${BASE}/api/auth/callback/credentials`, {
  method: "POST",
  redirect: "manual",
  headers: { "content-type": "application/x-www-form-urlencoded", cookie: csrf.headers.get("set-cookie")?.split(";")[0] ?? "" },
  body: new URLSearchParams({ csrfToken, email: "admin@dgriffe.test", password: "Admin@1234", callbackUrl: "/admin/lentes" }),
});
const sessionCookie = (login.headers.getSetCookie?.() ?? [])
  .filter((c) => c.includes("authjs.session-token"))
  .map((c) => c.split(";")[0])
  .join("; ");

let ok = 0, fail = [];
const check = (n, c, d = "") => { if (c) { ok++; console.log(`✓ ${n}`); } else { fail.push(n); console.log(`✗ ${n} — ${d}`); } };

const page = await fetch(`${BASE}/admin/lentes`, { headers: { cookie: sessionCookie } });
const html = await page.text();
check("/admin/lentes 200 (logado)", page.status === 200, `status=${page.status}`);
check("título Lentes", html.includes("<h1") && /Lentes/.test(html));
check("menu lateral com Lentes", /href="\/admin\/lentes"/.test(html));
check("lens seed visível (CR-39)", html.includes("CR-39"), "faltando lente do seed");

// guarda: sem sessão → redireciona para login
const gate = await fetch(`${BASE}/admin/lentes`, { redirect: "manual" });
check("sem sessão → 30x (porteiro)", [301, 302, 303, 307, 308].includes(gate.status), `status=${gate.status}`);

console.log(`\n${ok} passou · ${fail.length} falhou${fail.length ? ": " + fail.join(", ") : ""}`);
process.exit(fail.length ? 1 : 0);
