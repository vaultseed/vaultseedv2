// AES-GCM + PBKDF2 encryption utilities
export async function getKey(password: string, salt: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 500000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptData(key: CryptoKey, data: string): Promise<string> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(data)
  );
  
  const buf = new Uint8Array(iv.byteLength + encrypted.byteLength);
  buf.set(iv, 0);
  buf.set(new Uint8Array(encrypted), iv.byteLength);
  
  return btoa(String.fromCharCode(...buf));
}

export async function decryptData(key: CryptoKey, data: string): Promise<string | null> {
  try {
    const buf = new Uint8Array([...atob(data)].map(c => c.charCodeAt(0)));
    const iv = buf.slice(0, 12);
    const encText = buf.slice(12);
    
    const dec = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encText
    );
    
    return new TextDecoder().decode(dec);
  } catch (e) {
    return null;
  }
}

export function validatePassword(password: string): boolean {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,}$/;
  return regex.test(password);
}

export function generateSalt(): string {
  return crypto.getRandomValues(new Uint8Array(16))
    .reduce((str, b) => str + String.fromCharCode(b), "");
}

export function getPasswordStrength(password: string): {
  score: number;
  feedback: string;
  color: string;
} {
  let score = 0;
  let feedback = '';
  
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
  if (/(.)\1{2,}/.test(password)) score -= 1; // Repeated characters
  
  score = Math.max(0, Math.min(5, score));
  
  switch (score) {
    case 0:
    case 1:
      feedback = 'Very Weak';
      return { score, feedback, color: 'bg-red-500' };
    case 2:
      feedback = 'Weak';
      return { score, feedback, color: 'bg-orange-500' };
    case 3:
      feedback = 'Fair';
      return { score, feedback, color: 'bg-yellow-500' };
    case 4:
      feedback = 'Good';
      return { score, feedback, color: 'bg-blue-500' };
    case 5:
      feedback = 'Strong';
      return { score, feedback, color: 'bg-green-500' };
    default:
      return { score: 0, feedback: 'Very Weak', color: 'bg-red-500' };
  }
}

export async function exportVault(vaultData: any, password: string): Promise<string> {
  const salt = generateSalt();
  const key = await getKey(password, salt);
  const encrypted = await encryptData(key, JSON.stringify(vaultData));
  
  const exportData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    salt,
    data: encrypted
  };
  
  return JSON.stringify(exportData, null, 2);
}