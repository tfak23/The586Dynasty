import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// User interface
export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  has_sleeper_account: boolean;
  sleeper_username?: string;
  sleeper_user_id?: string;
}

// Auth state interface
interface AuthState {
  // User and token
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  // Loading states
  isLoading: boolean;
  isInitializing: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => Promise<void>;
  login: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  
  // Initialize auth from storage
  initialize: () => Promise<void>;
}

// Secure token storage
const saveToken = async (token: string | null) => {
  try {
    if (token) {
      await SecureStore.setItemAsync('auth_token', token);
    } else {
      await SecureStore.deleteItemAsync('auth_token');
    }
  } catch (error) {
    console.error('Error saving token:', error);
  }
};

const loadToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync('auth_token');
  } catch (error) {
    console.error('Error loading token:', error);
    return null;
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isInitializing: true,

      setUser: (user) => 
        set({ 
          user, 
          isAuthenticated: !!user 
        }),

      setToken: async (token) => {
        await saveToken(token);
        set({ 
          token, 
          isAuthenticated: !!token 
        });
      },

      login: async (user, token) => {
        await saveToken(token);
        set({ 
          user, 
          token, 
          isAuthenticated: true 
        });
      },

      logout: async () => {
        await saveToken(null);
        set({ 
          user: null, 
          token: null, 
          isAuthenticated: false 
        });
      },

      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ 
            user: { ...currentUser, ...updates } 
          });
        }
      },

      initialize: async () => {
        set({ isInitializing: true });
        try {
          const token = await loadToken();
          const user = get().user;
          
          if (token && user) {
            set({ 
              token, 
              user, 
              isAuthenticated: true,
              isInitializing: false 
            });
          } else {
            set({ 
              token: null, 
              user: null, 
              isAuthenticated: false,
              isInitializing: false 
            });
          }
        } catch (error) {
          console.error('Error initializing auth:', error);
          set({ 
            token: null, 
            user: null, 
            isAuthenticated: false,
            isInitializing: false 
          });
        }
      },
    }),
    {
      name: 'the586-auth',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist user data, not token (token is in SecureStore)
      partialize: (state) => ({ 
        user: state.user,
      }),
    }
  )
);

// Helper to get authorization header
export const getAuthHeader = () => {
  const token = useAuthStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};
