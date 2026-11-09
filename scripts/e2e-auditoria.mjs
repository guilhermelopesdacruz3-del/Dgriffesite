/**
 * e2e de regressão da Fase 10a/10b (auditoria) — roda contra o dev local.
 * Testa: cabeçalhos de segurança (A7), página do pedido fechada (A2),
 * token de convidado (A2/A3), rota demo com gate (A1), rate limit de cupom (A23).
 */
const BASE = "http://localhost:3000";
// ID do produto resolvido do banco (o seed recria IDs — hardcode ficava velho)
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const AURORA = (
  await new PrismaClient().product.findUniqueOrThrow({
    where: { slug: "lumen-aura-redonda" },
    select: { id: true },
  })
).id;
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

// ---------- 1. A7: cabeçalhos de segurança na home ----------
const home = await fetch(`${BASE}/`);
const h = home.headers;
check("CSP presente", h.has("content-security-policy"), `headers=${[...h.keys()].join(",")}`);
check("CSP bloqueia frames", (h.get("content-security-policy") ?? "").includes("frame-ancestors 'none'"));
check("X-Frame-Options DENY", h.get("x-frame-options") === "DENY");
check("nosniff", h.get("x-content-type-options") === "nosniff");
check("Permissions-Policy câmera self", (h.get("permissions-policy") ?? "").includes("camera=(self)"));

// ---------- 2. A2: pedido existente (com conta) inacessível sem sessão ----------
const pedidoAntigo = await fetch(`${BASE}/pedido/PZ-9JQAYW`);
check("Pedido com conta sem sessão → 404", pedidoAntigo.status === 404, `status=${pedidoAntigo.status}`);

// ---------- 3. A2/A3: checkout de convidado gera token no link ----------
const guestOrder = await fetch(`${BASE}/api/checkout`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    items: [{ productId: AURORA, variantId: null, quantity: 1 }],
    prescriptionId: null,
    cupom: null,
    freteId: "PAC",
    contato: { nome: "Visitante Teste", email: "guest-e2e@pierre.test", telefone: "11912345678" },
    entrega: {
      cep: "01310-100",
      rua: "Avenida Paulista",
      numero: "1000",
      complemento: null,
      bairro: "Bela Vista",
      cidade: "São Paulo",
      uf: "SP",
      observacoes: null,
    },
    metodo: "PIX",
  }),
});
const guestBody = await guestOrder.json();
check("Checkout convidado ok", guestOrder.status === 200 && guestBody.ok === true, JSON.stringify(guestBody).slice(0, 300));
const { code, redirectUrl } = guestBody;
check("redirectUrl inclui ?t= (token)", typeof redirectUrl === "string" && redirectUrl.includes("?t="), `redirectUrl=${redirectUrl}`);
check("Código novo tem 8 posições (PZ-XXXXXXXX)", /^PZ-[A-Z1-9]{8}$/.test(code), `code=${code}`);

const token = new URL(redirectUrl ?? "...", BASE).searchParams.get("t") ?? "";

// com token → 200 e mostra o pedido
const comToken = await fetch(`${BASE}/pedido/${code}?t=${token}`);
const html = await comToken.text();
check("Página do pedido COM token → 200", comToken.status === 200, `status=${comToken.status}`);
check("Página mostra o código do pedido", html.includes(code));
check("Página mostra endereço só com token", html.includes("Avenida Paulista"));

// sem token → 404 (a página não revela que o pedido existe)
const semToken = await fetch(`${BASE}/pedido/${code}`);
check("Página do pedido SEM token → 404", semToken.status === 404, `status=${semToken.status}`);

// token errado → 404
const tokenErrado = await fetch(`${BASE}/pedido/${code}?t=${"a".repeat(32)}`);
check("Página com token ERRADO → 404", tokenErrado.status === 404, `status=${tokenErrado.status}`);

// ---------- 3b. A1: rota demo continua aprovando EM DESENVOLVIMENTO ----------
const demo = await fetch(`${BASE}/api/demo/pagar`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ code }),
});
check("Demo pagar aprova em dev NODE_ENV=development", demo.status === 200, `status=${demo.status} ${(await demo.text()).slice(0, 200)}`);

// depois de pago, a página continua acessível pelo link
const pago = await fetch(`${BASE}/pedido/${code}?t=${token}`);
const pagoHtml = await pago.text();
check("Página do pedido pago continua com token → 200", pago.status === 200, `status=${pago.status}`);
check("Pedido aprovado reflete status PAID", pagoHtml.includes("Pagamento confirmado") || pagoHtml.includes("Em preparo"));

// ---------- 4. A23: rate limit do cupom (30/min por IP) ----------
let saw429 = 0;
for (let i = 0; i < 34; i += 1) {
  const res = await fetch(`${BASE}/api/cupom`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: "PRIMEIRA15", items: [{ productId: AURORA, price: 599.9, quantity: 1 }] }),
  });
  if (res.status === 429) saw429 += 1;
}
check("Rate limit do cupom dispara 429", saw429 > 0, `respostas429=${saw429}`);

console.log(`\n${passed} passou(m), ${failed.length} falhou(m): ${failed.join(", ") || "—"}`);
process.exit(failed.length ? 1 : 0);
