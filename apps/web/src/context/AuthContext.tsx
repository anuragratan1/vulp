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
    await api.logout();
    setTokenState(null);
    setUser(null);
    setWorkspace(null);
    setWorkspaces([]);
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
