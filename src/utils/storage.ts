import { FailedAttempt, StoredVault, IPFailedAttempt } from '../types/vault';

const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
const IP_MAX_ATTEMPTS = 5;
const IP_INITIAL_LOCKOUT = 15 * 60 * 1000; // 15 minutes

// Get user's IP address (simplified for demo - in production use proper IP detection)
function getUserIP(): string {
  // In a real application, you'd get this from the server
  // For demo purposes, we'll use a combination of user agent and screen resolution
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx!.textBaseline = 'top';
  ctx!.font = '14px Arial';
  ctx!.fillText('IP fingerprint', 2, 2);
  const fingerprint = canvas.toDataURL();
  
  // Create a simple hash of browser fingerprint
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `fp_${Math.abs(hash)}`;
}

export function getFailedAttempts(email: string): FailedAttempt {
  const obj = JSON.parse(localStorage.getItem("failedAttempts") || "{}");
  return obj[email] || { count: 0, lockUntil: 0 };
}

export function setFailedAttempts(email: string, record: FailedAttempt): void {
  const obj = JSON.parse(localStorage.getItem("failedAttempts") || "{}");
  obj[email] = record;
  localStorage.setItem("failedAttempts", JSON.stringify(obj));
}

export function isAccountLocked(email: string): { locked: boolean; timeLeft?: number } {
  const attempts = getFailedAttempts(email);
  if (attempts.lockUntil && Date.now() < attempts.lockUntil) {
    return {
      locked: true,
      timeLeft: Math.ceil((attempts.lockUntil - Date.now()) / 60000)
    };
  }
  return { locked: false };
}

export function recordFailedAttempt(email: string): void {
  const attempts = getFailedAttempts(email);
  attempts.count = (attempts.count || 0) + 1;
  
  if (attempts.count >= MAX_ATTEMPTS) {
    attempts.lockUntil = Date.now() + LOCKOUT_TIME;
    attempts.count = 0;
  }
  
  setFailedAttempts(email, attempts);
}

export function clearFailedAttempts(email: string): void {
  const attempts = getFailedAttempts(email);
  attempts.count = 0;
  attempts.lockUntil = 0;
  setFailedAttempts(email, attempts);
}

export function saveVault(email: string, vault: StoredVault): void {
  localStorage.setItem(`seedvault_${email}`, JSON.stringify(vault));
}

export function loadVault(email: string): StoredVault | null {
  const stored = localStorage.getItem(`seedvault_${email}`);
  return stored ? JSON.parse(stored) : null;
}

export function clearClipboardAfterDelay(text: string, delay: number = 10000): void {
  navigator.clipboard.writeText(text).then(() => {
    setTimeout(() => navigator.clipboard.writeText(""), delay);
  });
}

export function getAppSettings(): { darkMode: boolean } {
  const settings = localStorage.getItem('seedvault_settings');
  return settings ? JSON.parse(settings) : { darkMode: false };
}

export function saveAppSettings(settings: { darkMode: boolean }): void {
  localStorage.setItem('seedvault_settings', JSON.stringify(settings));
}

// IP-based rate limiting functions
export function getIPFailedAttempts(ip: string): IPFailedAttempt {
  const obj = JSON.parse(localStorage.getItem("ipFailedAttempts") || "{}");
  return obj[ip] || { count: 0, lockUntil: 0, timeoutDuration: IP_INITIAL_LOCKOUT };
}

export function setIPFailedAttempts(ip: string, record: IPFailedAttempt): void {
  const obj = JSON.parse(localStorage.getItem("ipFailedAttempts") || "{}");
  obj[ip] = record;
  localStorage.setItem("ipFailedAttempts", JSON.stringify(obj));
}

export function isIPLocked(): { locked: boolean; timeLeft?: number; ip: string } {
  const ip = getUserIP();
  const attempts = getIPFailedAttempts(ip);
  
  if (attempts.lockUntil && Date.now() < attempts.lockUntil) {
    return {
      locked: true,
      timeLeft: Math.ceil((attempts.lockUntil - Date.now()) / 60000),
      ip
    };
  }
  return { locked: false, ip };
}

export function recordIPFailedAttempt(): string {
  const ip = getUserIP();
  const attempts = getIPFailedAttempts(ip);
  attempts.count = (attempts.count || 0) + 1;
  
  if (attempts.count >= IP_MAX_ATTEMPTS) {
    // Exponential backoff: double the timeout duration each time
    attempts.lockUntil = Date.now() + attempts.timeoutDuration;
    attempts.timeoutDuration = Math.min(attempts.timeoutDuration * 2, 24 * 60 * 60 * 1000); // Max 24 hours
    attempts.count = 0;
  }
  
  setIPFailedAttempts(ip, attempts);
  return ip;
}

export function clearIPFailedAttempts(): void {
  const ip = getUserIP();
  const attempts = getIPFailedAttempts(ip);
  attempts.count = 0;
  attempts.lockUntil = 0;
  // Reset timeout duration to initial value on successful login
  attempts.timeoutDuration = IP_INITIAL_LOCKOUT;
  setIPFailedAttempts(ip, attempts);
}