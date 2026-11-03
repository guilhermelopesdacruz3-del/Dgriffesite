# Publicar na Netlify

Passo a passo para colocar a loja no ar. Tempo total: ~15 minutos (sem
contar a criação de contas). O projeto já está pronto: `netlify.toml`,
`postinstall` com `prisma generate` e fallbacks de demonstração.

## 1. Banco de dados em produção

O site inteiro depende de PostgreSQL (catálogo, pedidos, login). O mais
simples e gratuito para começar é o **Neon** (neon.tech); Supabase também
funciona.

1. Crie um projeto no Neon e copie a **connection string** (com `?sslmode=require`)
2. Rode a migração + seed **a partir da sua máquina**, apontando para o banco novo:
    ```powershell
    # PowerShell — na pasta do projeto
    $env:DATABASE_URL = "postgresql://usuario:senha@ep-xxx.neon.tech/otica?sslmode=require"
    npm run db:deploy   # aplica as migrações (prisma migrate deploy)
    npm run db:seed     # popula catálogo, cupom PRIMEIRA15 e usuários demo
    ```
   - Em Neon, se a connection string passar por **PgBouncer** (`-pooler`),
     configure também `DIRECT_URL` com o host **sem** `-pooler` (migração usa
     conexão direta). O `schema.prisma` já lê essa variável.
3. Guarde a string: ela volta no passo 3.

> `db:seed` limpa as tabelas antes de popular. Nunca rode em banco com dados reais.

## 2. Suba o código para o GitHub

```powershell
git init
git add .
git commit -m "Loja Pierre — catálogo, checkout e provador"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/otica.git
git push -u origin main
```

Garanta que o `.env` **não** está commitado (ele já deve estar no `.gitignore` —
confira com `git status --short | Select-String .env`).

## 3. Criar o site na Netlify

1. app.netlify.com → **Add new site → Import an existing project → GitHub**
2. Selecione o repositório. Com o `netlify.toml` no repo, a Netlify detecta
   tudo sozinha (build `npm run build` + plugin oficial do Next.js) — **não
   mude** Build command / Publish directory
3. Antes do primeiro deploy, abra **Site configuration → Environment variables**
   e cadastre:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | connection string do passo 1 |
| `DIRECT_URL` | (Neon) host sem `-pooler`, para migrações via painel |
| `NEXT_PUBLIC_SITE_URL` | `https://SEU-SITE.netlify.app` |
| `AUTH_SECRET` | segredo longo aleatório (`npx auth secret` gera) |
| `SEED_ADMIN_PASSWORD` | senha nova do admin (diferente da demo) |

   Opcionais — sem elas a loja funciona em **modo demonstração**:
   `MERCADO_PAGO_ACCESS_TOKEN` + `MERCADO_PAGO_WEBHOOK_SECRET` (pagamentos
   reais), `RESEND_API_KEY` + `EMAIL_FROM` (e-mails), `S3_*` + `S3_PUBLIC_URL`
   (imagens/modelos 3D próprios), `AUTH_GOOGLE_ID/SECRET` (login Google),
   `MELHOR_ENVIO_TOKEN` (frete real).

4. Deploy. Primeiro build: ~3–5 min. Versões seguintes publicam no *push* da `main`
   (e cada PR ganha um preview próprio).

> O **provador virtual exige zero configuração de servidor** — MediaPipe +
> Three.js rodam no navegador do cliente. O `.glb` padrão já vai em
> `public/models/`; por isso o pacote do deploy já inclui a peça.

## 4. Depois do primeiro deploy

- **Login Google**: no Google Cloud Console → Credenciais → OAuth client,
  adicione a origem `https://SEU-SITE.netlify.app` e o redirect
  `https://SEU-SITE.netlify.app/api/auth/callback/google`
- **Webhook do Mercado Pago**: no painel do MP, aponte para
  `https://SEU-SITE.netlify.app/api/webhooks/mercadopago` (com o mesmo
  `WEBHOOK_SECRET` cadastrado na Netlify)
- **Domínio próprio**: Site configuration → Domain management → Add a domain;
  aponte o DNS conforme instruções (ou CNAME para o subdomínio). Depois
  atualize `NEXT_PUBLIC_SITE_URL` para o domínio final e dê redeploy
- **Checklist de lançamento** (SEO/LGPD/qualidade): ver
  [`checklist-lancamento.md`](checklist-lancamento.md)

## Problemas comuns

- **Build falha em "can't reach database"** no `next build`: nenhuma rota
  de build deve acessar o banco em tempo de build — todas as páginas de
  catálogo têm fallback demo. Se aparecer, confira se `DATABASE_URL` está na
  Netlify (não só no `.env` local)
- **500 no `/pedido/...`**: banco não seedado — rode `db:seed` (passo 1)
- **Login redireciona para localhost**: `NEXT_PUBLIC_SITE_URL` apontando para
  `localhost` — corrija e redeploy
- **Prisma engine no deploy**: o `postinstall` já roda `prisma generate`; não
  é preciso configurar nada (Netlify usa Linux amd64)
