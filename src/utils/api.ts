import { apiRequest, API_ENDPOINTS } from '../config/api';
import { VaultData } from '../types/vault';

export interface RegisterData {
  email: string;
  password: string;
  securityQuestions: Array<{
    question: string;
    answer: string;
  }>;
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

// Authentication API calls
export const authAPI = {
  register: async (data: RegisterData) => {
    return apiRequest(API_ENDPOINTS.AUTH.REGISTER, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  login: async (data: LoginData) => {
    const response = await apiRequest(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (response.token) {
      localStorage.setItem('vaultseed_token', response.token);
      localStorage.setItem('vaultseed_user', JSON.stringify(response.user));
    }
    
    return response;
  },

  verifySecurityQuestions: async (data: SecurityVerificationData) => {
    return apiRequest(API_ENDPOINTS.AUTH.VERIFY_SECURITY, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  logout: () => {
    localStorage.removeItem('vaultseed_token');
    localStorage.removeItem('vaultseed_user');
  }
};

// Vault API calls
export const vaultAPI = {
  get: async () => {
    return apiRequest(API_ENDPOINTS.VAULT.GET);
  },

  save: async (encryptedData: string, clientSalt: string) => {
    return apiRequest(API_ENDPOINTS.VAULT.SAVE, {
      method: 'POST',
      body: JSON.stringify({
        encryptedData,
        clientSalt,
      }),
    });
  },

  export: async () => {
    return apiRequest(API_ENDPOINTS.VAULT.EXPORT);
  },

  delete: async () => {
    return apiRequest(API_ENDPOINTS.VAULT.DELETE, {
      method: 'DELETE',
    });
  }
};
