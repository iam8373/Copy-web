import { createHmac } from "node:crypto";

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) for tests: what an authenticator app shows. */
export function totp(base32Secret: string, at = Date.now(), stepOffset = 0): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of base32Secret.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const counter = Math.floor(at / 1000 / 30) + stepOffset;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", key).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}
