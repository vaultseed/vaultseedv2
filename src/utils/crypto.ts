// src/utils/crypto.ts
// AES-GCM + PBKDF2 helpers for client-side encryption

export async function getKey(password: string, salt: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 500000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(key: CryptoKey, data: string): Promise<string> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(data));

  const buf = new Uint8Array(iv.byteLength + encrypted.byteLength);
  buf.set(iv, 0);
  buf.set(new Uint8Array(encrypted), iv.byteLength);

  // base64 the combined IV + ciphertext for transport/storage
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < buf.length; i += chunkSize) {
    const slice = buf.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

export async function decryptData(key: CryptoKey, data: string): Promise<string | null> {
  try {
    // decode base64 -> Uint8Array
    const binary = atob(data);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

    const iv = bytes.slice(0, 12);
    const encText = bytes.slice(12);

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encText);
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error('decryptData error', e);
    return null;
  }
}

export function validatePassword(password: string): boolean {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,}$/;
  return regex.test(password);
}

export function generateSalt(): string {
  // produce base64 salt (16 bytes)
  const arr = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

export function getPasswordStrength(password: string): { score: number; feedback: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  if (/(.)\1{2,}/.test(password)) score--;
  score = Math.max(0, Math.min(5, score));

  let feedback = 'Very Weak';
  let color = 'bg-red-500';
  if (score <= 1) { feedback = 'Very Weak'; color = 'bg-red-500'; }
  else if (score === 2) { feedback = 'Weak'; color = 'bg-orange-500'; }
  else if (score === 3) { feedback = 'Fair'; color = 'bg-yellow-500'; }
  else if (score === 4) { feedback = 'Good'; color = 'bg-blue-500'; }
  else if (score >= 5) { feedback = 'Strong'; color = 'bg-green-500'; }

  return { score, feedback, color };
}

export async function exportVault(vaultData: any, password: string): Promise<string> {
  const salt = generateSalt();
  const key = await getKey(password, salt);
  const encrypted = await encryptData(key, JSON.stringify(vaultData));
  return JSON.stringify({ version: '1.0', timestamp: new Date().toISOString(), salt, data: encrypted }, null, 2);
}
