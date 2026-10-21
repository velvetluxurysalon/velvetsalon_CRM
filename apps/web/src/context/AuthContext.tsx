import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type Role = 'admin' | 'receptionist' | 'staff';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  token: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string, role: Role) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isReceptionist: boolean;
  isStaff: boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'velvet_token';

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate from localStorage on mount
  // Returns ms until the JWT expires (<= 0 if already expired or unreadable)
  const msUntilExpiry = (token: string): number => {
    try {
      const payload = JSON.parse(
        atob((token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')),
      ) as { exp?: number };
      return payload.exp ? payload.exp * 1000 - Date.now() : 0;
    } catch {
      return 0;
    }
  };

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (raw) {
      try {
        const stored = JSON.parse(raw) as AuthUser;
        if (msUntilExpiry(stored.token) > 0) {
          setUser(stored);
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  // Log out automatically at the moment the token expires (page left open)
  useEffect(() => {
    if (!user) return;
    const ms = msUntilExpiry(user.token);
    const timer = setTimeout(
      () => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      },
      Math.max(ms, 0),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [user]);

  const login = async (email: string, password: string, role: Role) => {
    const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(err.message ?? 'Invalid credentials');
    }

    const data = (await res.json()) as AuthUser;
    localStorage.setItem(TOKEN_KEY, JSON.stringify(data));
    setUser(data);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAdmin: user?.role === 'admin',
        isReceptionist: user?.role === 'receptionist',
        isStaff: user?.role === 'staff',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
