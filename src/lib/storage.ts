/**
 * Fase 7 — armazenamento de arquivos (upload real no Object Storage).
 *
 * A loja usa o Object Storage do Neon (S3-compatível, mesmo backend do banco,
 * bucket acompanha branch). O bucket `pierre` é `public_read`: escrita só com
 * credencial (Rota API/admin), leitura anônima com CORS já configurado no
 * setup (`scripts/setup-storage.mts`) — o provador e os cards carregam o
 * `.glb`/imagem direto pela URL pública do objeto.
 *
 * Chaves são imutáveis (timestamp + aleatório): trocamos a referência no banco
 * em vez de sobrescrever, o que permite cache longo (`max-age` de 1 ano).
 */
import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const STORAGE_BUCKET = process.env.STORAGE_BUCKET ?? "pierre";
/**
 * Bucket PRIVADO para documentos sensíveis (Fase 7b): receitas de óculos.
 * Nenhum acesso anônimo — leitura só por URL assinada, gerada on demand na
 * rota autenticada (/api/minhas-receitas/[id]/arquivo).
 */
export const STORAGE_PRIVATE_BUCKET = process.env.STORAGE_PRIVATE_BUCKET ?? "uploads";

/** Endpoint S3 da branch (injetado pelo Neon). */
function endpointUrl(): string {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  if (!endpoint) {
    throw new Error(
      "AWS_ENDPOINT_URL_S3 ausente: credenciais do Object Storage não configuradas no .env",
    );
  }
  return endpoint.replace(/\/+$/, "");
}

let client: S3Client | null = null;

function s3(): S3Client {
  client ??= new S3Client({ forcePathStyle: true }); // Neon exige path-style
  return client;
}

/** URL pública (anônima) do objeto — é o que o banco guarda em glbUrl/url. */
export function storagePublicUrl(key: string): string {
  return `${endpointUrl()}/${STORAGE_BUCKET}/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/** URL interna do store: cache e content-type permanecem na resposta do S3. */
export function buildObjectKey(folder: string, suffix: string, extension: string): string {
  const ext = extension.replace(/[^\w.]/g, "").slice(0, 8) || "bin";
  // Auditoria (A20): o sufixo (ex.: productId/userId) também entra limpo —
  // barra não é permitida dentro do segmento, elimina qualquer manipulação
  // de caminho vinda de referências cruzadas.
  const cleanSuffix = suffix.replace(/[^a-z0-9-]/gi, "-").slice(0, 80);
  const stamp = Date.now().toString(36);
  const nonce = randomUUID().slice(0, 8);
  // Pastas aninhadas são permitidas (receitas/{userId}/…); segmentos limpos.
  const path = folder
    .split("/")
    .map((seg) => seg.replace(/[^a-z0-9-]/gi, "-"))
    .filter(Boolean)
    .join("/");
  return `${path}/${stamp}-${nonce}${cleanSuffix}${ext}`;
}

/** Envia o arquivo com cache longo (chaves imutáveis). */
export async function putStorageObject(
  key: string,
  body: Buffer,
  contentType: string,
  cacheControl = "public, max-age=31536000, immutable",
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
}

/** Apaga o objeto (best-effort: falha não quebra a operação principal). */
export async function deleteStorageObject(key: string): Promise<boolean> {
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }));
    return true;
  } catch (err) {
    console.error("[storage] falha ao apagar objeto", key, err);
    return false;
  }
}

/** Extrai a `key` de uma URL pública armazenada no banco (ou null se inválida). */
export function storageKeyFromUrl(url: string): string | null {
  const base = `${endpointUrl()}/${STORAGE_BUCKET}/`;
  let decoded: URL;
  try {
    decoded = new URL(url);
  } catch {
    return null;
  }
  const prefix = `${decoded.origin}${new URL(base).pathname}`;
  if (!decoded.href.startsWith(prefix)) return null;
  const path = decoded.href.slice(prefix.length);
  return path ? decodeURIComponent(path) : null;
}

/** Baixa bytes do objeto (uso interno/testes). */
export async function getStorageObject(key: string, bucket = STORAGE_BUCKET): Promise<Buffer | null> {
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch (err) {
    console.error("[storage] falha ao ler objeto", key, err);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Objetos PRIVADOS (receitas de óculos — dado sensível)                      */
/* -------------------------------------------------------------------------- */

/** Envia em bucket privado (mesma validação de chave imutável). */
export async function putPrivateObject(
  key: string,
  body: Buffer,
  contentType: string,
  bucket = STORAGE_PRIVATE_BUCKET,
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "private, max-age=3600",
    }),
  );
}

/** Apaga do bucket privado (best-effort). */
export async function deletePrivateObject(
  key: string,
  bucket = STORAGE_PRIVATE_BUCKET,
): Promise<boolean> {
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    console.error("[storage] falha ao apagar objeto privado", key, err);
    return false;
  }
}

/**
 * URL assinada de leitura (GET, 15 min). É o caminho pelo qual a receita é
 * vista: a rota autenticada valida dono/admin e redireciona para cá — o
 * arquivo REAL nunca fica exposto num link fixo.
 */
export async function presignPrivateGet(
  key: string,
  bucket = STORAGE_PRIVATE_BUCKET,
  expiresIn = 15 * 60,
): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn },
  );
}

/* -------------------------------------------------------------------------- */
/* Validações por tipo do arquivo                                             */
/* -------------------------------------------------------------------------- */

/** Tamanho máximo dos modelos 3D no admin (30 MB). */
export const MAX_GLB_BYTES = 30 * 1024 * 1024;
/** Tamanho máximo de imagem no admin (8 MB). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Tamanho máximo de receita enviada pelo cliente (10 MB). */
export const MAX_RECEITA_BYTES = 10 * 1024 * 1024;

/** Assinatura binária de .glb: bytes 0-3 = "glTF". */
export function isGlbBuffer(buf: Buffer): boolean {
  return buf.length >= 4 && buf.subarray(0, 4).toString("latin1") === "glTF";
}

export type ImageKind = { ext: "jpg" | "png" | "webp"; contentType: string } | null;

/** Assinatura binária de PDF: "%PDF" nos primeiros bytes. */
export function isPdfBuffer(buf: Buffer): boolean {
  return buf.length >= 4 && buf.subarray(0, 4).toString("latin1") === "%PDF";
}

export type ReceitaKind = { ext: string; contentType: string } | null;

/** Receita aceita: JPEG/PNG/WEBP (foto do papel) ou PDF (digitalizado). */
export function receitaKindFromBuffer(buf: Buffer): ReceitaKind {
  const image = imageKindFromBuffer(buf);
  if (image) return image;
  if (isPdfBuffer(buf)) return { ext: "pdf", contentType: "application/pdf" };
  return null;
}

/** Reconhece JPEG/PNG/WEBP pelos magic bytes (extensão não é confiável). */
export function imageKindFromBuffer(buf: Buffer): ImageKind {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (buf.length >= 8 && buf.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return { ext: "png", contentType: "image/png" };
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF") {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

/** Formata tamanho legível no admin. */
export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}
