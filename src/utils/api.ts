// src/utils/api.ts
import { apiRequest, API_ENDPOINTS } from '../config/api';
import { VaultData } from '../types/vault';

export interface RegisterData {
  email: string;
  password: string;
  securityQuestions: Array<{ question: string; answer: string }>;
  salt: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface SecurityVerificationData {
  email: string;
  answers: string[];
}

function authHeaders() {
  const token = localStorage.getItem('vaultseed_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const authAPI = {
  login: async (data: LoginData) => {
    const response = await apiRequest(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response?.token) {
      localStorage.setItem('vaultseed_token', response.token);
      localStorage.setItem('vaultseed_user', JSON.stringify(response.user));
    }

    return response;
  },

  register: async (data: RegisterData) => {
    const response = await apiRequest(API_ENDPOINTS.AUTH.REGISTER, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response?.token) {
      localStorage.setItem('vaultseed_token', response.token);
      localStorage.setItem('vaultseed_user', JSON.stringify(response.user));
    }

    return response;
  },

  verifySecurityQuestions: async (data: SecurityVerificationData) => {
    return apiRequest(API_ENDPOINTS.AUTH.VERIFY_SECURITY, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { ...authHeaders() },
    });
  },

  logout: () => {
    localStorage.removeItem('vaultseed_token');
    localStorage.removeItem('vaultseed_user');
  }
};

// Vault API calls
export const vaultAPI = {
  // ✅ match backend response { encryptedData, clientSalt, lastAccessed }
  get: async (): Promise<{ encryptedData: string; clientSalt: string } | null> => {
    return apiRequest(API_ENDPOINTS.VAULT.GET, {
      headers: { ...authHeaders() },
    });
  },

  // save encryptedData & clientSalt
  save: async (encryptedData: string, clientSalt: string) => {
    return apiRequest(API_ENDPOINTS.VAULT.SAVE, {
      method: 'POST',
      headers: { ...authHeaders() },
      body: JSON.stringify({
        encryptedData,
        clientSalt,
      }),
    });
  },

  export: async () => {
    return apiRequest(API_ENDPOINTS.VAULT.EXPORT, {
      headers: { ...authHeaders() },
    });
  },

  delete: async () => {
    return apiRequest(API_ENDPOINTS.VAULT.DELETE, {
      method: 'DELETE',
      headers: { ...authHeaders() },
    });
  }
};
