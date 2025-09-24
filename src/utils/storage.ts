// Storage utility functions for VaultSeed

export interface VaultData {
  data: string;
  salt: string;
}

export interface AppSettings {
  darkMode: boolean;
}

// Vault storage functions
export const saveVault = (email: string, vault: VaultData): void => {
  const key = `vaultseed_${btoa(email)}`;
  localStorage.setItem(key, JSON.stringify(vault));
};

export const loadVault = (email: string): VaultData | null => {
  const key = `vaultseed_${btoa(email)}`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
};

// ✅ Delete vault (clear local cached vault)
export const deleteVault = (email: string): void => {
  const key = `vaultseed_${btoa(email)}`;
  localStorage.removeItem(key);
};

// Failed attempts tracking
export const getFailedAttempts = (email: string): number => {
  const key = `vaultseed_failed_${btoa(email)}`;
  const stored = localStorage.getItem(key);
  return stored ? parseInt(stored, 10) : 0;
};

export const setFailedAttempts = (email: string, count: number): void => {
  const key = `vaultseed_failed_${btoa(email)}`;
  localStorage.setItem(key, count.toString());
};

export const recordFailedAttempt = (email: string): void => {
  const current = getFailedAttempts(email);
  setFailedAttempts(email, current + 1);

  // Set lockout timestamp
  const lockKey = `vaultseed_lock_${btoa(email)}`;
  localStorage.setItem(lockKey, Date.now().toString());
};

export const clearFailedAttempts = (email: string): void => {
  const key = `vaultseed_failed_${btoa(email)}`;
  const lockKey = `vaultseed_lock_${btoa(email)}`;
  localStorage.removeItem(key);
  localStorage.removeItem(lockKey);
};

export const isAccountLocked = (email: string): { locked: boolean; timeLeft: number } => {
  const attempts = getFailedAttempts(email);
  const lockKey = `vaultseed_lock_${btoa(email)}`;
  const lockTime = localStorage.getItem(lockKey);

  if (attempts >= 5 && lockTime) {
    const lockTimestamp = parseInt(lockTime, 10);
    const lockDuration = 15 * 60 * 1000; // 15 minutes
    const timeLeft = Math.max(0, lockDuration - (Date.now() - lockTimestamp));

    if (timeLeft > 0) {
      return { locked: true, timeLeft: Math.ceil(timeLeft / 60000) };
    } else {
      clearFailedAttempts(email);
    }
  }

  return { locked: false, timeLeft: 0 };
};

// IP-based rate limiting
export const recordIPFailedAttempt = (): void => {
  const key = "vaultseed_ip_failed";
  const lockKey = "vaultseed_ip_lock";
  const current = parseInt(localStorage.getItem(key) || "0", 10);
  localStorage.setItem(key, (current + 1).toString());
  localStorage.setItem(lockKey, Date.now().toString());
};

export const clearIPFailedAttempts = (): void => {
  localStorage.removeItem("vaultseed_ip_failed");
  localStorage.removeItem("vaultseed_ip_lock");
};

export const isIPLocked = (): { locked: boolean; timeLeft: number } => {
  const attempts = parseInt(localStorage.getItem("vaultseed_ip_failed") || "0", 10);
  const lockTime = localStorage.getItem("vaultseed_ip_lock");

  if (attempts >= 10 && lockTime) {
    const lockTimestamp = parseInt(lockTime, 10);
    const lockDuration = 30 * 60 * 1000; // 30 minutes
    const timeLeft = Math.max(0, lockDuration - (Date.now() - lockTimestamp));

    if (timeLeft > 0) {
      return { locked: true, timeLeft: Math.ceil(timeLeft / 60000) };
    } else {
      clearIPFailedAttempts();
    }
  }

  return { locked: false, timeLeft: 0 };
};

// App settings
export const getAppSettings = (): AppSettings => {
  const stored = localStorage.getItem("vaultseed_settings");
  return stored ? JSON.parse(stored) : { darkMode: false };
};

export const saveAppSettings = (settings: AppSettings): void => {
  localStorage.setItem("vaultseed_settings", JSON.stringify(settings));
};

// Clipboard utility with automatic clearing
export const clearClipboardAfterDelay = (text: string, delay: number = 30000): void => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      setTimeout(() => {
        navigator.clipboard.writeText("").catch(() => {});
      }, delay);
    }).catch(() => {
      // Fallback copy
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
      } catch (e) {
        // ignore
      }
      document.body.removeChild(textArea);

      setTimeout(() => {
        try {
          const clearArea = document.createElement("textarea");
          clearArea.value = "";
          document.body.appendChild(clearArea);
          clearArea.select();
          document.execCommand("copy");
          document.body.removeChild(clearArea);
        } catch {
          // ignore
        }
      }, delay);
    });
  }
};
