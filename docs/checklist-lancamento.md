# Checklist de lançamento (produção)

## Infra / domínio
- [ ] Domínio registrado e DNS apontando para a Vercel (SSL automático)
- [ ] Banco gerenciado criado (Neon/Supabase) com usuário dedicado
- [ ] `DATABASE_URL` (pooled) + `DIRECT_URL` (migrações) configuradas
- [ ] `npx prisma migrate deploy` aplicado no banco de produção
- [ ] Backups automáticos do banco habilitados

## Identidade e legal
- [ ] Nome, CNPJ e endereço reais em `src/lib/config.ts`
- [ ] Páginas revisadas por jurídico: Privacidade (LGPD), Termos, Trocas
- [ ] Banner de cookies com consentimento ativo (Fase 9)
- [ ] E-mail oficial de contato/privacidade criado no domínio

## Integrações
- [ ] Credenciais **de produção** do Mercado Pago + webhook apontando para
      `https://seudominio/api/webhooks/mercadopago` e `WEBHOOK_SECRET` definido
- [ ] Pix, cartão e boleto testados em modo **sandbox** e uma **compra real**
- [ ] R2/S3: bucket criado, CORS liberado, chaves IAM mínimas, `S3_PUBLIC_URL`
- [ ] Resend: domínio verificado (SPF + DKIM), `EMAIL_FROM` correto
- [ ] Melhor Envio/Correios: token válido e prazos conferidos

## Comercial
- [ ] Catálogo revisado: fotos reais, especificações, estoques
- [ ] Modelos GLB testados no provador com pessoas reais
- [ ] Cupons/testes criados e testados
- [ ] Frete grátis / parcelamento conferidos com a política da empresa

## SEO / métricas
- [ ] `sitemap.xml` e `robots.txt` acessíveis
- [ ] Dados estruturados `schema.org/Product` validados
- [ ] Google Search Console + Analytics configurados
- [ ] Sentry habilitado (front + erros de payment)

## Go-live
- [ ] `lighthouse` ≥ 90 em Performance/Acessibilidade nas páginas principais
- [ ] Compra real em ambiente de produto (Pix + cartão) conferida end-to-end
- [ ] E-mail de confirmação recebido e rastreio exibido
- [ ] Teste de reembolso/cancelamento executado
- [ ] Plano de rollback: migrações + variáveis versionadas
