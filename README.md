# Pierre Ótica — E-commerce com provador virtual 3D

> **Como trocar o nome da loja:** edite **`src/lib/config.ts`** → `storeConfig.name`
> (ou defina `NEXT_PUBLIC_STORE_NAME` no `.env`). É o único ponto necessário.

E-commerce profissional para ótica (pt-BR / BRL) com Next.js App Router,
PostgreSQL + Prisma, NextAuth, Mercado Pago e provador virtual 3D com
MediaPipe + Three.js. Stack deliberadamente simples e comum.

**Status: FASE 2 concluída** ✅ (autenticação e papéis).
Roadmap das fases no fim deste README.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Front + servidor | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Banco | PostgreSQL (Neon/Supabase em prod, Docker local) + Prisma 6 |
| Auth | NextAuth v5 (Auth.js) — e-mail/senha + Google, papéis CUSTOMER/ATTENDANT/ADMIN |
| Pagamento | Mercado Pago (Pix, cartão, boleto) + webhook idempotente |
| Frete | Melhor Envio/Correios + tabela configurável no admin |
| Arquivos | S3 compatível (Cloudflare R2/AWS) com URLs assinadas |
| Provador 3D | MediaPipe Face Landmarker + Three.js (100% no navegador) |
| E-mail | Resend |
| Validação | Zod + React Hook Form |

## Estrutura

```
prisma/
  schema.prisma            # modelo de dados completo (26 modelos)
  migrations/…             # migração inicial
  seed.ts                  # seed: 20 produtos, marcas, admin, cliente…
src/
  app/(store)/…            # loja pública (home, produtos, provador…)
  app/(store)/paginas/…    # páginas institucionais editáveis no admin
  components/ui/…          # design system (Button, Input, Drawer…)
  components/home/…        # seções da home
  components/catalog/…     # cards de produto, favoritos
  lib/config.ts            # ⬅️ IDENTIDADE DA LOJA (nome, contato, frete)
  lib/db.ts                # singleton do Prisma
  lib/content.ts           # leitura de conteúdo com fallback
  lib/utils.ts             # cn(), formatBRL(), parcelamento…
docs/                      # guia GLB + checklist de lançamento
```

## Como rodar (local)

Requisitos: **Node.js 20+** e **Docker** (ou um Postgres pronto).

```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
copy .env.example .env
#   → confirme DATABASE_URL (o padrão já serve para o Docker abaixo)

# 3. Subir o Postgres local e criar tabelas
docker compose up -d
npm run db:migrate        # aplica a migração inicial

# 4. Popular dados de exemplo
npm run db:seed

# 5. Rodar a loja
npm run dev               # http://localhost:3000
```

Sem Docker? Aponte `DATABASE_URL` para o Neon/Supabase e pule o passo 3.

### Contas criadas pelo seed

| Papel | E-mail | Senha |
|---|---|---|
| Admin | `admin@pierre.test` | `Admin@1234` |
| Cliente | `cliente@pierre.test` | `Cliente@1234` |

> ⚠️ Senhas default — troque (`SEED_ADMIN_PASSWORD` no `.env` antes do seed,
> e depois diretamente no banco) antes de qualquer uso real.

### Testar login (Fase 2)

Com o banco rodando e seed aplicado:

1. `http://localhost:3000/entrar` → entre com `admin@pierre.test` / `Admin@1234`
2. O header passa a mostrar sua inicial; `/minha-conta` direciona ao painel
3. Conta admin vê o botão "Ir para o painel admin" → `/admin` (bloqueado para não-admins)
4. Deslogado, `/minha-conta` redireciona para login com retorno automático
5. 5 tentativas erradas/min dispara a mensagem de "Muitas tentativas"

Google OAuth: preencha `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` no `.env`
(redirect: `http://localhost:3000/api/auth/callback/google`) e o botão
aparece automaticamente nas telas de login/cadastro.

### Testar catálogo (Fase 3)

1. `/produtos` — grid com sidebar de filtros (desktop) e filtros dentro do
   Drawer no mobile (botão **Filtros** com contador)
2. Clique formatos/cores/faixas/marcas: a **URL atualiza** (`?formato=square`
   etc.), os cards filtram e aparecem chips "x" para remover; "Limpar tudo"
   reseta; voltar/avançar do navegador preserva o estado
3. Busca no topo (ou pelo ícone de busca do header) → `?q=aviador`
4. Ordenação (Relevância / Novidades / Menor / Maior preço) via select
5. Com muitos produtos a paginação aparece (`?pagina=2` em links crawleáveis)
6. Abra um produto: galeria + miniaturas, escolha de cor/tamanho,
   "Adicionar ao carrinho" grava no localStorage (com a foto da variação)
   e o badge do header conta os itens
7. A PDP inclui medidas reais (`48-22-145 mm`), parcelamento e
   `schema.org/Product` no código-fonte (valida em search.google.com/test/rich-results)

### Testar carrinho e checkout (Fase 4)

1. Em uma PDP, adicione um item → **`/carrinho`**: lista com foto, cor,
   stepper de quantidade (+/−), remover; badge do header acompanha
2. No carrinho, aplique o cupom **PRIMEIRA15** (−15% da primeira compra) e
   calcule o frete com um CEP (ex.: `01310-100`); acima de R$ 299 o Pac fica grátis
3. **Fechar pedido** → `/checkout`: endereço preenchido automaticamente pelo
   CEP (ViaCEP), escolha Pac/Sedex/Retirada e o método de pagamento
4. **Concluir pedido** cria o pedido (código tipo `PZ-9F3KQ2`), reserva o
   estoque e esvazia o carrinho; você cai em **`/pedido/CODE`**
5. Modo demonstração (sem `MERCADO_PAGO_ACCESS_TOKEN`): na página do pedido
   clique **"Simular pagamento aprovado"** → status vira "Pagamento
   confirmado" e o estoque da variação é baixado (`npm run db:studio` confere)
6. Com token de teste do Mercado Pago no `.env`: o checkout redireciona à
   página do MP (Pix, cartão e boleto) e o webhook `/api/webhooks/mercadopago`
   confirma o pagamento automaticamente (idempotente)
   - **LGPD (minimização):** o payload do MP salvo em `Payment.raw` passa por
     lista branca (`sanitizeMpPayment`) — guarda só valor/status/datas/método
     e códigos de Pix; **nada** de e-mail do pagador, nome/CPF ou dígitos de
     cartão
7. Cupons: validade `startsAt/endsAt`, mínimo, `maxUses`, `perUserLimit` e
   escopo (categoria/marca/produto) são checados **no servidor** — o carrinho
   revalida novamente na criação do pedido

### Comandos

| Comando | Uso |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `start` | Build e produção local |
| `npm run lint` / `typecheck` | ESLint (estilo) e verificação de tipos |
| `npm run db:migrate` | Migrações (dev) |
| `npm run db:deploy` | Migrações (CI/prod) |
| `npm run db:seed` | Seed de exemplo (limpa as tabelas!) |
| `npm run db:studio` | Prisma Studio (ver/editar dados) |

## Variáveis de ambiente

Todas listadas com comentários em **`.env.example`**. Resumo:

- `DATABASE_URL` (+ `DIRECT_URL` opcional em Neon/Supabase)
- `NEXT_PUBLIC_STORE_NAME`, `NEXT_PUBLIC_SITE_URL`
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `EMAIL_FROM`
- `S3_*` (endpoint, bucket, chaves, `S3_PUBLIC_URL`)
- `MELHOR_ENVIO_TOKEN` (opcional)

## Publicar na Netlify

Guia completo em [`docs/publicar-netlify.md`](docs/publicar-netlify.md). Resumo:

1. Banco na nuvem (Neon/Supabase grátis) → `npm run db:deploy` + `db:seed` apontando para ele
2. Push para o GitHub → Netlify "Import project" (`netlify.toml` no repo configura tudo)
3. Variáveis no painel: `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `AUTH_SECRET`
   (+ opcionais: Mercado Pago, Resend, S3, Google OAuth)
4. Domínio próprio + webhook do Mercado Pago → detalhes no guia

## Conteúdo editável (Fase 1)

Já ficam no banco e serão editáveis pelo painel admin (Fase 6):

- Barra de aviso do topo → `Setting` `announcement`
- Hero da home → `Banner` slot `home_hero`
- Páginas institucionais → `Page` (markdown em `/paginas/[slug]`)
- Marcas e categorias → `Brand` / `Category`

## Navegação disponível agora

`/` home completa (13 seções), `/produtos` (catálogo com filtros laterais,
busca, ordenação, paginação e chips de filtros ativos — tudo na URL),
`/produtos/[slug]` PDP (galeria com miniaturas, variação de cor/tamanho,
especificações, schema.org, relacionados, mini carrinho via localStorage),
`/carrinho` (cupom, frete por CEP, totais), `/checkout` (identificação,
entrega, frete, Pix/cartão/boleto), `/pedido/[code]` (status do pedido,
QR do Pix quando disponível), `/marcas`, `/provador` (página explicativa) +
`/provador/estudio` (estúdio interativo com câmera), `/paginas/*`
institucionais. Enquanto o
banco não estiver rodando/seedado, a home e o catálogo exibem conteúdo de
exemplo (mesmo comportamento com filtros aplicáveis sobre os 8 produtos
demonstrativos); o checkout exige o banco (com Docker:
`docker compose up -d`).

## Roadmap por fases

- [x] **Fase 1** — Setup, design system, schema + seed
- [x] **Fase 2** — Autenticação e papéis (NextAuth)
- [x] **Fase 3** — Catálogo completo: filtros, busca, página de produto
- [x] **Fase 4** — Carrinho, cupons, frete, checkout + Mercado Pago
- [x] **Fase 5** — Perfil do cliente e pedidos (conta logada completa)
- [x] **Fase 6** — Admin: produtos (variações/imagens/estoque), pedidos (status/rastreio), cupons e dashboard
- [x] **Fase 7** — Upload de GLB + visualizador 3D no admin (Neon Object Storage)
- [x] **Fase 7b** — Receitas de óculos + venda com lentes (bucket privado, validação do óptico)
- [x] **Fase 8** — Provador virtual (MediaPipe + Three.js)
- [x] **Fase 9** — SEO (sitemap/robots/manifest/JSON-LD) + LGPD (consentimento de cookies)
- [x] **Fase 9b** — Auditoria de segurança/LGPD (24 achados catalogados)
- [x] **Fase 10a/10b** — Correções da auditoria (ver seção abaixo)
- [x] **Fase 11** — Pós-venda essencial: "esqueci minha senha" + e-mails
  (recuperação de senha autosserviço e confirmação de pedido via Resend)
- [ ] **Fase 12** — Testes (Vitest/Playwright), upgrade next@16, deploy real

Guias já disponíveis: [`docs/guia-glb.md`](docs/guia-glb.md) e
[`docs/checklist-lancamento.md`](docs/checklist-lancamento.md).

### Correções da auditoria de segurança (Fase 10a/10b)

Após a auditoria (Fase 9b), todas as correções prioritárias foram aplicadas com
e2e de regressão (`scripts/e2e-auditoria.mjs` + `scripts/e2e-auditoria-2.mjs`;
32 verificações automatizadas) e build de produção verde:

1. **Página do pedido é privada (A2)** — pedido **com conta**: só o dono
   logado (ou ADMIN); pedido de **convidado**: só abre pelo link com
   `?t=<token>` — sem token ou token errado → 404. Novo campo
   `Order.accessToken` (migration `20261031151222_order_access_token`).
2. **Código de pedido imprevisível (A3)** — `PZ-` + 8 posições com
   `crypto.randomInt` (antes: `Math.random()` com 6).
3. **`/api/demo/pagar` trancada em produção (A1)** — além de exigir ausência
   do token do Mercado Pago, agora recusa quando `NODE_ENV=production`. O
   caminho de teste manual do webhook tem o mesmo gate (A24).
4. **Webhook anti-replay (A13)** — assinatura HMAC do MP exige `ts` com menos
   de 5 minutos.
5. **Cupom à prova de corrida (A5)** — `usedCount` incrementado de forma
   CONDICIONAL dentro da transação (esgotado → pedido não é criado) e
   cancelamento/reembolso devolve o uso ao contador.
6. **Estoque à prova de corrida (A6)** — baixa da reserva só acontece se o
   saldo atual cobre a quantidade (`updateMany` condicional).
7. **Cabeçalhos de segurança (A7)** — CSP, HSTS (produção), X-Frame-Options,
   nosniff, Referrer-Policy e Permissions-Policy (câmera só para o próprio
   site) em todas as rotas, via `next.config.mjs`.
8. **JSON-LD escapado (A8)** — `<` virado `\u003c` (`serializeJsonLd()`),
   impossibilitando XSS via `</script>`.
9. **Opt-in de marketing (A10)** — a caixa de cadastro fica DESMARCADA por
   padrão (LGPD); o servidor também assume `false`.
10. **Papel de admin confirmado no banco (A21)** — um admin rebaixado perde o
    papel imediatamente (não só na renovação do JWT); usado nas páginas,
    actions e na página de pedido.
11. **LGPD autosserviço (A12)** — em `/minha-conta/dados`: "Baixar JSON" com
    todos os dados pessoais e "Excluir minha conta" (digite EXCLUIR); receitas
    e arquivos são apagados de verdade e pedidos ficam anonimizados.
12. **Rastreador facial auto-hospedado (A11)** — WASM + modelo do provador
    servidos de `/public/mediapipe` (nada de Google/jsdelivr, nem no CSP).
13. **Senha com letras e números (A16)** — cadastro e troca de senha.
14. **CPF com dígito verificador (A18)** + unicidade entre contas.
15. **remotePatterns fechado (A19)** — só picsum e o armazenamento.
16. **Sufixo da chave do armazenamento sanitizado (A20)**.
17. **Rate limit no cupom (A23)** — 30 tentativas/min por IP (429).

**Dívidas conhecidas (documentadas):** rate limit ainda em memória (trocar por
Redis em multi-instância — A14); dependências `npm audit fix --force`
(breaking): `next@16` (corrige postcss), `mercadopago@3`, eslint/tailwind
(dev); AuditLog sem retenção automática (A22).

### E-mails e recuperação de senha (Fase 11)

- **"Esqueci minha senha"** (`/recuperar-senha`, link também em `/entrar`):
  pede o e-mail → link de uso único válido 1 hora → formulário de nova senha
  (letras + números). Segurança: guarda só o HASH SHA-256 do token, rate limit
  5/min por IP e 3/15 min por e-mail, resposta neutra que não revela se o
  e-mail existe, e-mail de aviso após a troca.
- **Confirmação de pedido por e-mail** — quando o pagamento é aprovado
  (webhook do Mercado Pago **ou** modo demonstração), o cliente recebe
  "Pedido recebido" com resumo dos itens e o link da página do pedido (com o
  token `?t=` nos pedidos de convidado).
- **Envio**: usa Resend com `RESEND_API_KEY` + `EMAIL_FROM`
  (ver `.env.example`). **Sem chave nada quebra** — em desenvolvimento cada
  e-mail é impresso no console do servidor (inclusive os links de reset, o
  que facilita testar o fluxo de ponta a ponta).

#### Testar a recuperação de senha

1. Saia da conta (ou use uma janela anônima) → `/entrar` → **"Esqueci minha
   senha"** → informe `cliente@pierre.test` → veja a mensagem neutra
2. Em desenvolvimento: o link está no **console do servidor** (linha
   `[email·fallback]`, campo "copie este endereço")
3. Abra o link → crie uma senha nova (letras + números) → "Senha trocada!"
4. Entre com a senha nova; tentar o link de novo recusa ("expirou ou já foi
   usado"); um e-mail avisa que a senha foi trocada
5. Com `RESEND_API_KEY` configurada: os mesmos passos (as mensagens chegam no
   e-mail de verdade em vez do console)

### Testar a conta do cliente (Fase 5)

1. Entre pelo `/entrar` com o cliente do seed (**cliente@pierre.test /
   Cliente@1234**) — ou crie uma conta nova em `/criar-conta` (o login já
   acontece na hora)
2. **Visão geral** (`/minha-conta`): últimos pedidos, endereço padrão,
   contadores de favoritos e atalhos para as áreas
3. **Endereços** (`/minha-conta/enderecos`): criar, editar, remover
   (confirmação em duas etapas) e "Tornar padrão" — só um fica padrão por vez
4. **Dados e senha** (`/minha-conta/dados`): nome/telefone/CPF com máscara,
   trocar senha (conta Google pode definir a primeira senha sem informar a
   atual) e preferências LGPD com salvamento automático
5. **Favoritos**: toque no coração de qualquer card (catálogo, home, PDP) —
   ele acende na hora (localStorage) e sincroniza com a conta; a lista fica
   em `/favoritos` e acompanha o login (visitante vê convite para entrar)
6. **Meus pedidos** (`/minha-conta/pedidos`): status com badge (aguardando
   pagamento → pago → enviado → entregue), código amigável e link para o
   detalhe em `/pedido/[code]`
7. Rota privada: deslogado, qualquer `/minha-conta/*` redireciona para
   `/entrar?callbackUrl=...` e volta para onde você estava depois do login

### Testar o admin (Fase 6)

Entre em `/admin` com o administrador do seed (**admin@pierre.test / Admin@1234**) —
rota protegida por middleware *e* re-verificada no servidor.

1. **Dashboard** (`/admin`): KPIs de pedidos em aberto/ativos, receita
   confirmada, provador 3D + os dois painéis de rotina (últimos pedidos e
   estoque baixo ≤ 3)
2. **Produtos** (`/admin/produtos`): busca por nome/SKU/slug, estoque agregado,
   selos Destaque/Novo/Inativo. **Novo produto** (`/admin/produtos/novo`):
   nome, descrição, preços (aceita vírgula), especificações em mm, variações
   por cor com estoque e imagens por URL ("Principal" define a foto do card;
   upload de arquivos fica para a Fase 7). Deixe slug/SKU vazios: são gerados
   automaticamente. **Editar** permite ajustar estoque — toda mudança vira um
   `StockMovement` (trilha de auditoria); exclusão (2 cliques) é **lógica**,
   o produto sai da loja mas o histórico de pedidos permanece
3. **Pedidos** (`/admin/pedidos`): filtros por status, KPI de valor, tabela
   com rastreio. **Detalhe** (`/admin/pedidos/[code]`): itens com snapshot,
   endereço, pagamento e o formulário de status + rastreio — cada mudança
   grava `before → after` no `AuditLog` e o cliente já vê o novo status
   (e o código de rastreio) na sua página `/pedido/[code]`
4. **Cupons** (`/admin/cupons`): criar/editar (percentual até 90% ou valor
   fixo, pedido mínimo, limite de usos, validade). Cupom com uso registrado
   **não é apagado**: vira "Inativo" preservando o histórico. O uso aparece
   como `usos / limite`

Ciclo de venda completo para testar a operação: cliente compra (carrinho →
checkout → aprovação demo em `/pedido/[code]`) → status "Pago" → admin muda
para "Enviado" com rastreio → cliente vê o rastreio. O estoque da variação
caiu automaticamente na venda (movimento `SALE`).

### SEO e LGPD (Fase 9)

**SEO** — rotas geradas pelo framework (nada manual):
- `/sitemap.xml` é **dinâmico**: home, catálogo, categorias e páginas CMS com
  `lastmod` real. Se o banco estiver fora, devolve as rotas estáticas (a loja
  nunca quebra por causa do SEO)
- `/robots.txt` bloqueia áreas privadas (admin, conta, checkout, pedidos,
  estúdio do provador e `/api/`) e aponta para o sitemap
- `/manifest.webmanifest` + favicon SVG próprio (atalho "instalar" no celular)
- JSON-LD: **Organization/WebSite com SearchAction** na home e
  **LocalBusiness** para cada loja física; no produto o `Product` estruturado
  já existia. Abertos/Google compartilham corretamente via `metadataBase`
  (`NEXT_PUBLIC_SITE_URL` muda tudo num só lugar)

**LGPD — cookies com consentimento prévio** (nada de rastreio antes da escolha):
1. Na primeira visita aparece o banner: **"Só o essencial"**,
   **"Personalizar"** (análise/marketing separados) ou **"Aceitar tudo"**;
   a escolha fica em `pierre.consent.v1` no navegador
2. Depois de escolher o banner não volta no carregamento; para revogar, use
   **"Preferências de cookies"** no rodapé (reabre o banner)
3. A seção **"Cookies e consentimento"** no fim de
   `/paginas/politica-de-privacidade` documenta as três categorias
4. Quando um script de analytics/marketing for integrado, checar
   `hasConsent('analise' | 'marketing')` antes de carregar (função pronta em
   `src/components/lgpd/cookie-consent.tsx` — nada ainda usa cookies
   opcionais)

e2e provado: banner na 1ª visita → personalizar grava `analise:true,
marketing:false` → persiste no recarregamento → revogação pelo rodapé reabre →
"Aceitar tudo" grava os dois opcionais; sitemap com 39 URLs (produtos,
categorias, páginas) e robots na segunda visita OK.

### Testar o modelo 3D por produto (Fase 7)

O armazenamento usa o **Neon Object Storage** (mesmo backend do banco; bucket
`pierre`, criado por `npx tsx scripts/setup-storage.mts`, público para leitura
com CORS configurado).

1. No admin, abra um produto (`/admin/produtos/[id]`) — a coluna lateral tem o
   cartão **Modelo 3D (provador)**
2. **Enviar arquivo .glb** (até 30 MB, formato conferido no servidor: glTF
   binário) — o modelo entra no bucket e o produto passa a usá-lo; o arquivo
   anterior sai sozinho (banco e bucket ficam consistentes)
3. **Calibrar no estúdio**: abre o provador em modo calibração — ajuste
   escala, X/Y/Z, rotações, esticamento e inclinação com a câmera ligada e
   clique em **Salvar calibração no produto** (a barra só existe para ADMIN;
   clientes nunca veem)
4. Na loja: "Experimentar em 3D" na página do produto abre o estúdio com a
   armação e a calibração salvas; a calibração é reaproveitada do banco
5. **Remover modelo** (confirmação em 2 cliques) — a loja volta a mostrar a
   armação padrão e o arquivo .glb sai do bucket

Imagens de produto também aceitam **upload real** no formulário ("Fazer
upload", até 8 MB — JPEG/PNG/WEBP conferidos por magic bytes) ou continuar por
URL. Toda mutação grava em `AuditLog` (`model3d.upload`,
`model3d.calibrate`, `model3d.deactivate`, `image.upload`).

### Testar receitas e lentes (Fase 7b)

Compra de **armação de grau com lentes dirigidas por receita** — o coração da
ótica. Lentes só saem com receituário anexado e validado pelo óptico.

1. **Cliente envia a receita**: `/minha-conta/receitas` (ou a nova aba
   **Minhas receitas** na conta) — foto (JPEG/PNG/WEBP) ou PDF até 10 MB,
   conferido por magic bytes no servidor. Cada pedido com lente escolhe um
   pacote (CR-39, antirreflexo+azul, progressivas) e uma receita sua
2. **Privacidade**: o arquivo vai para o bucket **privado** `uploads`
   (`receitas/{userId}/…`) — anônimo recebe **403**; a leitura é só pela rota
   `/api/minhas-receitas/[id]/arquivo` (dono ou admin), que redireciona para
   uma **URL assinada de 15 min** (nada de link fixo)
3. **PDP**: em produtos de grau (ex.: Aurora Cristal) aparece o bloco
   **"Lentes de grau"** — marque "com lentes", escolha o pacote e o preço soma
   (armação + lente) no carrinho
4. **Checkout**: se a compra tem lentes, a seção **"2. Receita de óculos"**
   exige uma receita sua (selecione na lista ou anexe ali mesmo). Receita
   RECUSADA bloqueia o pedido; PENDING ou VALIDATED aceitam
5. **Pós-pagamento**: receita PENDING deixa o pedido em **"Validação da
   receita"** (`AWAITING_PRESCRIPTION_VALIDATION`) após o pagamento; receita já
   VALIDATED segue direto para **Pago**. O cliente acompanha o status e abre o
   arquivo em `/pedido/[code]`
6. **Óptico no admin**: `/admin/pedidos/[code]` mostra o cartão **Receita de
   óculos** com botão **Ver arquivo da receita** (URL assinada), **Validar** e
   **Recusar** (2 cliques). Validar → pedido vai para **Em preparo**;
   recusar → pedido **Cancelado** e receita **REJECTED** (contato pelo
   WhatsApp). Toda revisão grava em `AuditLog` (`prescription.review`)

Fluxos e2e provados: upload → 403/302 assinado → PDP com lentes (R$ 249,90 +
R$ 349,90 = R$ 599,80) → checkout com receita → hold em validação → admin
valida (Em preparo) → 2º pedido direto Pago → 3º pedido recusado (Cancelado).

### Testar o provador virtual (Fase 8)

1. Abra **`/provador/estudio`** e clique **"Ativar câmera"** — o navegador
   pedirá permissão; o vídeo é processado 100% no aparelho (nada sobe ao
   servidor)
2. Enquadre o rosto a 40–70 cm: a armação de demonstração (redonda, metal +
   lente fumê) aparece "vestida" no rosto, com oclusão real (a haste some
   atrás da bochecha quando você vira) e sombra sobre a pele
3. Gire a cabeça (yaw/pitch/roll): o modelo 3D acompanha a rotação real da
   cabeça, não é adesivo 2D. Leia o instrumento no topo: distância (cm),
   largura da armação (mm) e FPS
4. Luz: a iluminação do palco imita a do ambiente (brilho, tinta de cor e
   direção) — apague a luz de um lado e veja a cena acompanhar
5. Ajustes de encaixe abaixo do palco: escala, opacidade das lentes,
   inclinação pantoscópica, X/Y/Z, inverter frente/verso, oclusão on/off —
   tudo em milímetros, como uma bancada de ótica
6. **Foto**: botão "Foto" compõe vídeo + armação e permite baixar o JPEG
7. Com produto vinculado: **`/provador/estudio?produto=aura-redonda`** usa o
   `.glb` ativo do banco (`Model3D`), com a calibração salva no admin como
   ponto de partida (o mesmo acontece clicando "Experimentar em 3D" numa PDP
   com 3D). Sem `.glb`/sem banco entra a **armação padrão da loja**
   (`public/models/frame-padrao.glb`, Wayfarer preto — substitua o arquivo
   para trocar a peça exibida; mantenha otimizado: webp + simplify)
