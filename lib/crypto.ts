import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/lib/env";

/**
 * 빌링키 암호화 (AES-256-GCM). 포맷: hex( "PFK1" | iv(12) | tag(16) | ciphertext ).
 * 빌링키는 그 자체로 결제 권한이므로 DB 유출 시에도 바로 쓰이지 않게 앱 키로 감싼다.
 */
const MAGIC = Buffer.from("PFK1", "ascii");

function key(): Buffer {
  const secret = getServerEnv().APP_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error("APP_ENCRYPTION_KEY 는 32자 이상이어야 합니다 (.env.local).");
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ct]).toString("hex");
}

export function decryptSecret(envelopeHex: string): string {
  const env = Buffer.from(envelopeHex, "hex");
  const magic = env.subarray(0, 4);
  if (magic.length !== 4 || !timingSafeEqual(magic, MAGIC)) throw new Error("INVALID_ENVELOPE");
  const iv = env.subarray(4, 16);
  const tag = env.subarray(16, 32);
  const ct = env.subarray(32);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
