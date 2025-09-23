export interface SecurityQuestion {
  question: string;
  answer: string;
}

export interface SeedPhrase {
  seed: string;
  name?: string;
  id: string;
  createdAt: string;
}

export interface VaultData {
  seeds: SeedPhrase[];
  securityQuestions: SecurityQuestion[];
}

export interface StoredVault {
  salt: string;
  data: string;
}

export interface FailedAttempt {
  count: number;
  lockUntil: number;
}

export interface IPFailedAttempt {
  count: number;
  lockUntil: number;
  timeoutDuration: number; // in milliseconds
}

export interface AppSettings {
  darkMode: boolean;
}

export interface TooltipState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}