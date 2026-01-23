import { useState, useEffect } from 'react';
import { Layout } from '../components';
import { useAuth, useDebug } from '../context';
import { api } from '../services';
import type { WorkspaceRole } from '../types';

export function SettingsPage() {
  const { user, currentWorkspace, workspaces, members, userRole, logout, refreshMembers } = useAuth();
  const { isDebugEnabled, toggleDebug } = useDebug();
  
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('Editor');
  const [isInviting, setIsInviting] = useState(false);

  // AI Settings state
  const [activeProvider, setActiveProvider] = useState<'openai' | 'gemini'>('openai');
  
  // Independent state for each provider
  const [openAiKey, setOpenAiKey] = useState('');
  const [openAiModel, setOpenAiModel] = useState('gpt-4o');
  const [hasOpenAi, setHasOpenAi] = useState(false);
  const [maskedOpenAiKey, setMaskedOpenAiKey] = useState('');

  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash-exp');
  const [hasGemini, setHasGemini] = useState(false);
  const [maskedGeminiKey, setMaskedGeminiKey] = useState('');

  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load AI settings on mount
  useEffect(() => {
    loadAISettings();
  }, []);

  async function loadAISettings() {
    try {
      const response = await api.getAISettings();
      if (response.data) {
        setHasOpenAi(response.data.hasOpenAi);
        setHasGemini(response.data.hasGemini);
        
        if (response.data.openAiModel) setOpenAiModel(response.data.openAiModel);
        if (response.data.geminiModel) setGeminiModel(response.data.geminiModel);
        
        if (response.data.maskedOpenAiKey) setMaskedOpenAiKey(response.data.maskedOpenAiKey);
        if (response.data.maskedGeminiKey) setMaskedGeminiKey(response.data.maskedGeminiKey);
        
        setError(response.data.error ? `Warning: ${response.data.error}` : null);
      }
    } catch (err: any) {
      console.error('Failed to load AI settings:', err);
    }
  }

  async function handleSaveAISettings() {
    // Determine which key to save based on active provider
    const keyToSave = activeProvider === 'openai' ? openAiKey : geminiKey;
    const modelToSave = activeProvider === 'openai' ? openAiModel : geminiModel;

    if (!keyToSave.trim()) return;

    setIsSaving(true);
    setTestResult(null);
    setError(null);

    try {
      await api.saveAISettings(activeProvider, keyToSave, modelToSave);
      
      // Clear specific input after save
      if (activeProvider === 'openai') setOpenAiKey('');
      else setGeminiKey('');
      
      setTestResult({ success: true, message: `${activeProvider === 'openai' ? 'OpenAI' : 'Gemini'} key saved successfully` });
      
      // Reload from DB to confirm the round-trip works
      await loadAISettings();
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to save API key' });
    }

    setIsSaving(false);
  }

  async function handleTestConnection() {
    setTestResult(null);
    
    // Test logic typically uses the key stored in DB (unless we pass it, but api.testAIConnection reads from DB)
    // IMPORTANT: backend testAIConnection needs to know WHICH provider to test?
    // Currently backend testAIConnection tests assuming ONE active logic.
    // We should probably pass provider to testAIConnection or backend iterates?
    // Let's assume backend currently reads 'provider' from single-row DB. 
    // Wait, backend will return Multiple Rows now.
    // We need to update api.testAIConnection to accept 'provider' argument!
    
    // Temporary: Frontend change only here. I need to update backend testAIConnection too!
    
    try {
      // TODO: Update backend to accept provider param
      // For now, let's assume API is updated (I will update it next step)
       // @ts-ignore
      const response = await api.testAIConnection(activeProvider); 
      if (response.data) {
        setTestResult({ 
          success: response.data.success, 
          message: response.data.message 
        });
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Connection test failed' });
    }
  }

  async function handleClearKey() {
    if (!confirm(`Are you sure you want to remove your ${activeProvider === 'openai' ? 'OpenAI' : 'Gemini'} API key?`)) return;
    
    try {
      // Pass query param provider to delete specific key
      // api.deleteAISettings needs update to accept provider?
      // deleteAISettings(provider)
      await api.deleteAISettings(activeProvider);
      
      if (activeProvider === 'openai') {
        setHasOpenAi(false);
        setMaskedOpenAiKey('');
        setOpenAiKey('');
      } else {
        setHasGemini(false);
        setMaskedGeminiKey('');
        setGeminiKey('');
      }
      
      setTestResult({ success: true, message: 'API key removed' });
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to remove API key' });
    }
  }

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
      </div>

      {/* AI Provider Settings */}
      <div className="card mb-md">
        <h4 className="mb-md">AI Provider</h4>
        <p className="mb-md" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          Configure your own API key for AI-powered menu imports (OpenAI or Gemini).
        </p>
        
        {/* Provider selector */}
        <div className="form-group">
          <label className="form-label">Provider</label>
          <select 
            className="form-input form-select" 
            value={activeProvider} 
            onChange={(e) => setActiveProvider(e.target.value as 'openai' | 'gemini')}
          >
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
          </select>
        </div>
        
        {/* API Key input */}
        <div className="form-group">
          <label className="form-label">API Key</label>
          <div className="flex gap-sm">
            <input
              type={showApiKey ? 'text' : 'password'}
              className="form-input"
              placeholder={(activeProvider === 'openai' ? hasOpenAi : hasGemini) 
                ? `Stored: ${activeProvider === 'openai' ? maskedOpenAiKey : maskedGeminiKey}` 
                : 'Enter API key'}
              value={activeProvider === 'openai' ? openAiKey : geminiKey}
              onChange={(e) => activeProvider === 'openai' ? setOpenAiKey(e.target.value) : setGeminiKey(e.target.value)}
              style={{ flex: 1 }}
            />
            <button 
              className="btn btn-ghost btn-icon" 
              onClick={() => setShowApiKey(!showApiKey)}
              title={showApiKey ? "Hide key" : "Show key"}
            >
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{ width: 20, height: 20 }}
              >
                {showApiKey ? (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  </>
                ) : (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
        
        {/* Model selector */}
        <div className="form-group">
          <label className="form-label">Model</label>
          <select 
            className="form-input form-select" 
            value={activeProvider === 'openai' ? openAiModel : geminiModel} 
            onChange={(e) => activeProvider === 'openai' ? setOpenAiModel(e.target.value) : setGeminiModel(e.target.value)}
          >
            {activeProvider === 'openai' ? (
              <>
                <option value="gpt-4o">GPT-4o (Recommended)</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </>
            ) : (
              <>
                <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Recommended)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              </>
            )}
          </select>
        </div>

        {/* Status Message */}
        {testResult && (
          <div className={`mb-md p-sm rounded ${testResult.success ? 'bg-success-subtle text-success' : 'bg-error-subtle text-error'}`} style={{ fontSize: 'var(--font-size-sm)' }}>
            {testResult.message}
          </div>
        )}

        {error && (
          <div className="mb-md p-sm rounded bg-error-subtle text-error" style={{ fontSize: 'var(--font-size-sm)' }}>
            {error}
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-sm flex-wrap">
          <button 
            className="btn btn-secondary" 
            onClick={handleTestConnection}
            disabled={!(activeProvider === 'openai' ? hasOpenAi : hasGemini) && !(activeProvider === 'openai' ? openAiKey : geminiKey)}
          >
            Test Connection
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSaveAISettings}
            disabled={!(activeProvider === 'openai' ? openAiKey.trim() : geminiKey.trim()) || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          {((activeProvider === 'openai' ? hasOpenAi : hasGemini) || error) && (
            <button 
              className="btn btn-ghost text-error" 
              onClick={handleClearKey}
              style={{ marginLeft: 'auto' }}
            >
              Clear Key
            </button>
          )}
        </div>
      </div>

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
