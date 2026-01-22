import { useState } from 'react';
import { Layout, DebugConsole } from '../components';
import { useAuth, useDebug } from '../context';
import type { WorkspaceRole } from '../types';

export function SettingsPage() {
  const { user, currentWorkspace, workspaces, members, userRole, logout, refreshMembers } = useAuth();
  const { isDebugEnabled, toggleDebug } = useDebug();
  
  const [showDebug, setShowDebug] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('Editor');
  const [isInviting, setIsInviting] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !currentWorkspace) return;
    
    setIsInviting(true);
    try {
      const response = await fetch(`/api/workspaces/${currentWorkspace.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      
      if (response.ok) {
        setInviteEmail('');
        setShowInvite(false);
        refreshMembers();
      }
    } catch (error) {
      console.error('Failed to send invite:', error);
    }
    setIsInviting(false);
  };

  return (
    <Layout title="Settings">
      {/* User Info */}
      <div className="card mb-md">
        <div className="flex items-center gap-md mb-md">
          <div style={{ 
            width: 56, 
            height: 56, 
            borderRadius: 'var(--radius-full)',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text-inverse)',
          }}>
            {user?.name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{user?.name}</div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              {user?.email}
            </div>
          </div>
        </div>
        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={logout}>
          Sign Out
        </button>
      </div>

      {/* Workspace */}
      <div className="card mb-md">
        <h4 className="mb-md">Workspace</h4>
        <div className="flex items-center gap-md mb-md">
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>
              {currentWorkspace?.name || 'No workspace'}
            </div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              {userRole && `You are ${userRole === 'Owner' ? 'the' : 'an'} ${userRole}`}
            </div>
          </div>
          {workspaces.length > 1 && (
            <select 
              className="form-input form-select"
              value={currentWorkspace?.id}
              onChange={() => {/* Would switch workspace */}}
              style={{ width: 'auto' }}
            >
              {workspaces.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Members List */}
        {members.length > 0 && (
          <div className="mb-md">
            <div className="form-label">Members ({members.length})</div>
            <div className="list" style={{ maxHeight: 200, overflowY: 'auto' }}>
              {members.map((member) => (
                <div key={member.userId} className="flex items-center gap-sm" style={{ padding: 'var(--space-sm) 0' }}>
                  <div style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-bg-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'var(--font-size-sm)',
                  }}>
                    {member.email.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: 'var(--font-size-sm)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {member.email}
                    </div>
                  </div>
                  <span className="cuisine-badge" style={{ 
                    background: member.pending ? 'var(--color-warning)' : undefined,
                    color: member.pending ? 'var(--color-bg-primary)' : undefined,
                  }}>
                    {member.pending ? 'Pending' : member.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invite Button (Owner only) */}
        {userRole === 'Owner' && (
          <>
            {showInvite ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input
                  type="email"
                  className="form-input mb-sm"
                  placeholder="Email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <div className="flex gap-sm">
                  <select
                    className="form-input form-select"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                    style={{ flex: 1 }}
                  >
                    <option value="Editor">Editor</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                  <button 
                    className="btn btn-primary"
                    onClick={handleInvite}
                    disabled={!inviteEmail.trim() || isInviting}
                  >
                    {isInviting ? 'Sending...' : 'Send'}
                  </button>
                  <button 
                    className="btn btn-ghost"
                    onClick={() => setShowInvite(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%' }}
                onClick={() => setShowInvite(true)}
              >
                Invite Family Member
              </button>
            )}
          </>
        )}
      </div>

      {/* Debug Settings */}
      <div className="card mb-md">
        <h4 className="mb-md">Developer</h4>
        <div className="flex justify-between items-center mb-md">
          <div>
            <div>Debug Mode</div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              Show detailed error information
            </div>
          </div>
          <button
            className={`toggle-tried ${isDebugEnabled ? 'tried' : ''}`}
            onClick={toggleDebug}
            style={{ width: 44, height: 44 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>
        <button 
          className="btn btn-secondary" 
          style={{ width: '100%' }}
          onClick={() => setShowDebug(!showDebug)}
        >
          {showDebug ? 'Hide Debug Console' : 'Show Debug Console'}
        </button>
      </div>

      {/* Debug Console */}
      {showDebug && (
        <div className="mb-md">
          <DebugConsole />
        </div>
      )}

      {/* App Info */}
      <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
        <div style={{ fontSize: 'var(--font-size-sm)' }}>TasteTrail v1.0.0</div>
        <div style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-xs)' }}>
          Made with ❤️ for food lovers
        </div>
      </div>
    </Layout>
  );
}
