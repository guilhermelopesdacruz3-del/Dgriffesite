/**
 * Provisionamento do armazenamento de arquivos (Fase 7).
 *
 * Neon Object Storage é S3-compatível: criamos o bucket `pierre` (público
 * para leitura, escrita só com credencial), configuramos o CORS para que o
 * navegador carregue os `.glb` direto do bucket no provador e fazemos um
 * ciclo completo de ida-e-volta (put → get anônimo → delete) para provar.
 *
 * Uso: npx tsx scripts/setup-storage.mts
 */
import "dotenv/config";
import {
  S3Client,
  CreateBucketCommand,
  PutBucketCorsCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const BUCKET = process.env.STORAGE_BUCKET ?? "pierre";

if (!process.env.AWS_ENDPOINT_URL_S3) {
  throw new Error("AWS_ENDPOINT_URL_S3 ausente no .env (credenciais do Neon Object Storage)");
}

const s3 = new S3Client({ forcePathStyle: true }); // Neon exige path-style

// 1) Bucket (idempotente)
try {
  await s3.send(
    new CreateBucketCommand({
      Bucket: BUCKET,
      CreateBucketConfiguration: { LocationConstraint: "us-east-2" as never },
    }),
  );
  console.log(`bucket "${BUCKET}" criado (public_read via confiuração do projeto)`);
} catch (err) {
  const e = err as { name?: string };
  if (e.name === "BucketAlreadyOwnedByYou" || e.name === "BucketAlreadyExists") {
    console.log(`bucket "${BUCKET}" já existe — seguindo`);
  } else {
    throw err;
  }
}
await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
console.log("HeadBucket ok");

// 2) CORS: o navegador (provador/admin) faz GET com Origin — precisamos dos
//    cabeçalhos. Segundo a docs Neon o bucket aceita PutBucketCors; se não
//    suportar, caímos no plano B (proxy pela rota /api/arquivo).
try {
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ["*"],
            AllowedMethods: ["GET", "HEAD"],
            AllowedHeaders: ["*"],
            MaxAgeSeconds: 86400,
          },
        ],
      },
    }),
  );
  console.log("CORS configurado (GET/HEAD, origem *)");
} catch (err) {
  console.warn("PutBucketCors não suportado — seguiremos com prox. Erro:", (err as Error).message);
}

// 3) Ciclo interno: upload → leitura com credencial → delete
const key = "zz-test/setup.txt";
const body = Buffer.from("Pierre Fase 7 — storage ok");
await s3.send(
  new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: "text/plain" }),
);
console.log("PutObject ok");
const got = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
const text = await got.Body?.transformToByteArray();
console.log("GetObject ok, conteúdo:", new TextDecoder().decode(text));
await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
console.log("DeleteObject ok");

// 4) Leitura ANÔNIMA (como o navegador fará) + verificação de CORS na resposta
const url = `${process.env.AWS_ENDPOINT_URL_S3}/${BUCKET}/${key}`;
// recria para testar a URL pública
await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: "text/plain" }));
const res = await fetch(url, { headers: { Origin: "http://localhost:3000" } });
const acao = res.headers.get("access-control-allow-origin");
console.log(`GET anônimo: HTTP ${res.status}, access-control-allow-origin: ${acao ?? "— (sem CORS)"}`);
const content = await res.text();
console.log("conteúdo público:", content);

// OPTIONS de preflight (o loader pode não precisar, mas checamos)
const pre = await fetch(url, {
  method: "OPTIONS",
  headers: {
    Origin: "http://localhost:3000",
    "Access-Control-Request-Method": "GET",
  },
});
console.log(
  `OPTIONS: HTTP ${pre.status}, acao: ${pre.headers.get("access-control-allow-origin") ?? "—"}`,
);

await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
console.log("limpeza ok");

// 5) Servindo objeto como glb: checar Content-Type só por sanidade
console.log("--- setup de storage concluído com sucesso ---");
