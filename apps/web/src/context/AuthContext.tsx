import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  api,
  UserRecord,
  WorkspaceRecord,
  getAuthToken,
  setAuthToken,
} from '../api/client.js';

interface AuthContextType {
  user: UserRecord | null;
  workspace: WorkspaceRecord | null;
  workspaces: WorkspaceRecord[];
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (params: { email: string; password: string }) => Promise<void>;
  signup: (params: { email: string; password: string; name: string }) => Promise<void>;
  loginWithGoogleIdToken: (idToken: string) => Promise<void>;
  setSessionFromAuthResponse: (res: any) => void;
  logout: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  updateProfile: (data: { name?: string; avatarUrl?: string }) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [token, setTokenState] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('auth_token');
        if (urlToken) {
          setAuthToken(urlToken);
          setTokenState(urlToken);
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('auth_token');
          window.history.replaceState({}, '', cleanUrl.toString());
        }
      } catch {}
    }

    const currentToken = getAuthToken();
    if (!currentToken) {
      setUser(null);
      setWorkspace(null);
      setWorkspaces([]);
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.getMe();
      setUser(data.user);
      setWorkspace(data.workspace);
      setWorkspaces(data.workspaces || []);
    } catch {
      // Invalid or expired token
      setAuthToken(null);
      setTokenState(null);
      setUser(null);
      setWorkspace(null);
      setWorkspaces([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setSessionFromAuthResponse = useCallback((res: any) => {
    if (!res || !res.token) return;
    setAuthToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    setWorkspace(res.workspace);
    setWorkspaces(res.workspaces || []);
    setIsLoading(false);
  }, []);

  const loginWithGoogleIdToken = async (idToken: string) => {
    const res = await api.loginWithGoogleIdToken(idToken);
    setSessionFromAuthResponse(res);
  };

  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'vulp_auth_success' && event.data.token) {
        setSessionFromAuthResponse({
          token: event.data.token,
          user: event.data.user,
          workspace: event.data.workspace,
          workspaces: event.data.workspaces,
        });
      }
    };

    window.addEventListener('message', handleAuthMessage);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('vulp_auth');
      bc.onmessage = (event) => {
        if (event.data?.type === 'vulp_auth_success' && event.data.token) {
          setSessionFromAuthResponse({
            token: event.data.token,
            user: event.data.user,
            workspace: event.data.workspace,
            workspaces: event.data.workspaces,
          });
        }
      };
    } catch {}

    return () => {
      window.removeEventListener('message', handleAuthMessage);
      bc?.close();
    };
  }, [setSessionFromAuthResponse]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (params: { email: string; password: string }) => {
    const res = await api.login(params);
    setTokenState(res.token);
    setUser(res.user);
    setWorkspace(res.workspace);
    setWorkspaces(res.workspaces || []);
  };

  const signup = async (params: { email: string; password: string; name: string }) => {
    const res = await api.signup(params);
    setTokenState(res.token);
    setUser(res.user);
    setWorkspace(res.workspace);
    setWorkspaces(res.workspaces || []);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    try {
      localStorage.removeItem('vulp_active_workflow_id');
    } catch {}
    setTokenState(null);
    setUser(null);
    setWorkspace(null);
    setWorkspaces([]);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
  };

  const switchWorkspace = async (workspaceId: string) => {
    const res = await api.switchWorkspace(workspaceId);
    setWorkspace(res.workspace);
    setWorkspaces(res.workspaces || []);
  };

  const createWorkspace = async (name: string) => {
    const res = await api.createWorkspace(name);
    setWorkspace(res.workspace);
    setWorkspaces(res.workspaces || []);
  };

  const deleteWorkspace = async (workspaceId: string) => {
    const res = await api.deleteWorkspace(workspaceId);
    setWorkspace(res.workspace);
    setWorkspaces(res.workspaces || []);
  };

  const updateProfile = async (data: { name?: string; avatarUrl?: string }) => {
    const res = await api.updateProfile(data);
    setUser(res.user);
  };

  const completeOnboarding = async () => {
    await api.completeOnboarding();
    if (user) {
      setUser({ ...user, onboardingCompleted: true });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspace,
        workspaces,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        login,
        signup,
        loginWithGoogleIdToken,
        setSessionFromAuthResponse,
        logout,
        switchWorkspace,
        createWorkspace,
        deleteWorkspace,
        updateProfile,
        completeOnboarding,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

