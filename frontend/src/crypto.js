// 心理顾问 · 端到端加密模块(Web Crypto API)
// 2026-09-17 T3 立 · Phase 1 #7 "飞书 OAuth 登录 + 端到端加密(用户日记)" 加密子模块
// 0 依赖 · 纯 ES Module · 仅用浏览器原生 Web Crypto API
//
// 设计原则(7 条):
//   1. 密钥派生:PBKDF2-SHA256,200,000 次迭代(OWASP 2023 推荐),每次重新生成 16 字节 salt
//   2. 对称加密:AES-GCM 256(浏览器原生 crypto.subtle),每次 12 字节随机 IV
//   3. 服务端永不接触 passphrase 或明文 — 只存 ciphertext + iv + salt
//   4. passphrase 仅活在内存(单次加解密之间),刷新页面后需用户重新输入
//   5. passphrase 强度下限:长度 ≥ 1(避免空串当密码),生产应 ≥ 8;0917 dev 模式只校验非空
//   6. 失败处理:decrypt 失败抛带原因的 Error(让上层 UI 提示"密码错了或日记损坏")
//   7. base64 用标准 RFC 4648(+/=),前端序列化 + 后端 Python base64 完全兼容
//
// 与 auth.js 的关系:
//   - crypto 模块独立,不依赖 JWT(任何场景下都可加解密)
//   - checkin.js:登录后,拿 passphrase 派生 key → 加密 note → POST /api/diary(ciphertext+iv+salt)
//   - 列表/详情:用户输入 passphrase → 解密所有日记
//
// 不做的:
//   - 不存 passphrase(任何形式,包括 sessionStorage)
//   - 不缓存派生 key(防 XSS 后泄漏)
//   - 不做 key rotation(Phase 1 不考虑)

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

function b64encode(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64decode(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// passphrase 弱校验:非空即可(避免误把空串当密码导致"加密后明文 = 空"反模式)
function _validatePassphrase(p) {
  if (typeof p !== "string" || p.length < 1) {
    throw new Error("passphrase 不能为空");
  }
}

// ---------------------------------------------------------------------------
// 派生 AES-GCM key
// ---------------------------------------------------------------------------

async function deriveKey(passphrase, saltBytes) {
  _validatePassphrase(passphrase);
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 200_000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false, // not extractable
    ["encrypt", "decrypt"]
  );
}

// ---------------------------------------------------------------------------
// 加密:明文 + passphrase → {ciphertext_b64, iv_b64, salt_b64}
// ---------------------------------------------------------------------------

export async function encryptString(plaintext, passphrase) {
  if (typeof plaintext !== "string") throw new Error("plaintext 必须是字符串");
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );
  return {
    ciphertext_b64: b64encode(new Uint8Array(ciphertext)),
    iv_b64: b64encode(iv),
    salt_b64: b64encode(salt),
  };
}

// ---------------------------------------------------------------------------
// 解密:{ciphertext_b64, iv_b64, salt_b64} + passphrase → plaintext
// ---------------------------------------------------------------------------

export async function decryptString({ ciphertext_b64, iv_b64, salt_b64 }, passphrase) {
  const ciphertext = b64decode(ciphertext_b64);
  const iv = b64decode(iv_b64);
  const salt = b64decode(salt_b64);
  const key = await deriveKey(passphrase, salt);
  let plainBuf;
  try {
    plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  } catch (e) {
    throw new Error("解密失败:passphrase 错、salt 错或日记已损坏");
  }
  return new TextDecoder().decode(plainBuf);
}

// ---------------------------------------------------------------------------
// 派生密钥稳定化:同 passphrase + 同 salt → 同 key,可作为"用户身份指纹"
// ---------------------------------------------------------------------------

/** 生成 16 字节随机 salt(给上层用,例如 PBKDF2 salt 由加密模块内部生成,这里给"指纹用"派生) */
export function randomSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

/** 把 Uint8Array 转 base64(给外部用,例如 fingerprint 计算) */
export function bytesToB64(bytes) {
  return b64encode(bytes);
}

/** 从 passphrase 派生一个 16 字节"身份指纹"(PBKDF2 + 固定应用 salt),用于本地判断"这是不是同一个用户" */
export async function fingerprint(passphrase) {
  _validatePassphrase(passphrase);
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode("psy-fingerprint-v1"),
      iterations: 50_000, // 比加解密少一些(只是本地身份判断)
      hash: "SHA-256",
    },
    baseKey,
    128
  );
  return b64encode(new Uint8Array(bits));
}