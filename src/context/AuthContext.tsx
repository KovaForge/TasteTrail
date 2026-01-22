import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User, AuthState, Workspace, WorkspaceMember, WorkspaceRole } from '../types';

interface AuthContextType extends AuthState {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  members: WorkspaceMember[];
  userRole: WorkspaceRole | null;
  login: () => void;
  logout: () => void;
  setCurrentWorkspace: (workspace: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
  refreshMembers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  // Fetch user info from Azure SWA auth endpoint
  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/.auth/me');
      const data = await response.json();
      
      if (data.clientPrincipal) {
        const principal = data.clientPrincipal;
        setUser({
          id: principal.userId,
          email: principal.userDetails,
          name: principal.userDetails.split('@')[0],
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch workspaces
  const refreshWorkspaces = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/workspaces');
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data.workspaces || []);
        
        // Auto-select first workspace or create one if none exists
        if (data.workspaces?.length > 0) {
          const saved = localStorage.getItem('tastetrail_workspace');
          const savedWorkspace = data.workspaces.find((w: Workspace) => w.id === saved);
          setCurrentWorkspace(savedWorkspace || data.workspaces[0]);
        } else {
          // Create default workspace
          const createResponse = await fetch('/api/workspaces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'My Family' }),
          });
          if (createResponse.ok) {
            const newWorkspace = await createResponse.json();
            setWorkspaces([newWorkspace]);
            setCurrentWorkspace(newWorkspace);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    }
  }, [user]);

  // Fetch workspace members
  const refreshMembers = useCallback(async () => {
    if (!currentWorkspace) return;
    
    try {
      const response = await fetch(`/api/workspaces/${currentWorkspace.id}/members`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  }, [currentWorkspace]);

  // Get user's role in current workspace
  const userRole = user && currentWorkspace
    ? members.find(m => m.userId === user.id)?.role || null
    : null;

  // Save selected workspace to localStorage
  useEffect(() => {
    if (currentWorkspace) {
      localStorage.setItem('tastetrail_workspace', currentWorkspace.id);
    }
  }, [currentWorkspace]);

  // Initial user fetch
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Fetch workspaces when user changes
  useEffect(() => {
    if (user) {
      refreshWorkspaces();
    }
  }, [user, refreshWorkspaces]);

  // Fetch members when workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      refreshMembers();
    }
  }, [currentWorkspace, refreshMembers]);

  const login = () => {
    window.location.href = '/.auth/login/aad?post_login_redirect_uri=' + encodeURIComponent(window.location.pathname);
  };

  const logout = () => {
    window.location.href = '/.auth/logout?post_logout_redirect_uri=/';
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    currentWorkspace,
    workspaces,
    members,
    userRole,
    login,
    logout,
    setCurrentWorkspace,
    refreshWorkspaces,
    refreshMembers,
  };

  return (
    <AuthContext.Provider value={value}>
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
