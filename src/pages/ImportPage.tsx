import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components';
import { useAuth, useDebug } from '../context';
import { api, setApiContext } from '../services';
import type { ImportSourceType, ImportDraft } from '../types';
import { CUISINES } from '../types';

type ImportStep = 'select' | 'input' | 'review';

export function ImportPage() {
  const navigate = useNavigate();
  const { currentWorkspace, user } = useAuth();
  const { addEntry } = useDebug();
  
  const [step, setStep] = useState<ImportStep>('select');
  const [sourceType, setSourceType] = useState<ImportSourceType>('text');
  const [sourceValue, setSourceValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ImportDraft | null>(null);

  // Set API context
  useEffect(() => {
    setApiContext(currentWorkspace?.id || null, user?.id || null, addEntry);
  }, [currentWorkspace?.id, user?.id, addEntry]);

  const handleSourceSelect = (type: ImportSourceType) => {
    setSourceType(type);
    setStep('input');
  };

  const handleProcess = async () => {
    if (!sourceValue.trim()) return;

    // Check if AI key is configured (unless it's just raw text, which we might support lightly or consistency blocks)
    // Per requirements: "If no key is configured. URL and screenshot imports are blocked"
    // "Text only imports may optionally still work without AI but default to blocked for consistency"
    // So we check for all.
    const settingsResponse = await api.getAISettings();
    if (!settingsResponse.data?.hasKey) {
      addEntry({
        type: 'error',
        message: 'AI provider not configured. Please add your API key in Settings.',
        timestamp: new Date().toISOString(),
      });
      alert('You need to configure an AI Provider (OpenAI or Gemini) in Settings to import menus.');
      return;
    }
    
    setIsProcessing(true);
    
    // For images, we need to ensure we send just the base64 data if it has a prefix
    let processedValue = sourceValue;
    if (sourceType === 'image' && sourceValue.includes('base64,')) {
      processedValue = sourceValue.split('base64,')[1];
    }

    const response = await api.parseImport({
      sourceType,
      sourceValue: processedValue,
    });
    
    if (response.data) {
      // response.data now matches { restaurant, items, warnings, meta }
      // We need to map it to ImportDraft shape
      setImportId('temp-' + Date.now()); // Parse doesn't create a persistent record yet until commit (or we might want to change that behavior if backend persists it)
      // Actually backend createImport persisted it. parseImport does not seem to persist a draft record in DB in the new implementation?
      // Wait, the new parseImport implementation DOES NOT persist to menu_imports table. It just returns JSON.
      // So we use a temp ID.
      
      setDraft({
        restaurantName: response.data.restaurant.name,
        cuisine: response.data.restaurant.cuisine,
        items: response.data.items.map((item: any) => ({
          ...item,
          selected: true, // Default to selected
        })),
      });
      setStep('review');
    }
    
    setIsProcessing(false);
  };

  const handleToggleItem = (index: number) => {
    if (!draft) return;
    setDraft({
      ...draft,
      items: draft.items.map((item, i) => 
        i === index ? { ...item, selected: !item.selected } : item
      ),
    });
  };

  const handleUpdateDraft = (field: keyof ImportDraft, value: string) => {
    if (!draft) return;
    setDraft({ ...draft, [field]: value });
  };

  const handleCommit = async () => {
    if (!importId || !draft) return;
    
    setIsProcessing(true);
    const selectedDraft: ImportDraft = {
      ...draft,
      items: draft.items.filter(i => i.selected),
    };
    
    const response = await api.commitImport(importId, selectedDraft);
    
    if (response.data) {
      navigate(`/restaurant/${response.data.restaurant.id}`);
    }
    
    setIsProcessing(false);
  };

  const handleReset = () => {
    setStep('select');
    setSourceValue('');
    setImportId(null);
    setDraft(null);
  };

  // Step 1: Select source type
  if (step === 'select') {
    return (
      <Layout title="Import Menu">
        <p className="mb-lg" style={{ color: 'var(--color-text-secondary)' }}>
          Import menu items from text, a website, or a photo
        </p>

        <div className="list">
          <button 
            className="card card-interactive"
            onClick={() => handleSourceSelect('text')}
          >
            <div className="flex items-center gap-md" style={{ padding: 'var(--space-md)' }}>
              <div style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ width: 24, height: 24 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>Paste Text</div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                  Copy and paste menu text
                </div>
              </div>
            </div>
          </button>

          <button 
            className="card card-interactive"
            onClick={() => handleSourceSelect('url')}
          >
            <div className="flex items-center gap-md" style={{ padding: 'var(--space-md)' }}>
              <div style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ width: 24, height: 24 }}>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>Website URL</div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                  Import from a restaurant website
                </div>
              </div>
            </div>
          </button>

          <button 
            className="card card-interactive"
            onClick={() => handleSourceSelect('image')}
          >
            <div className="flex items-center gap-md" style={{ padding: 'var(--space-md)' }}>
              <div style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--color-secondary), #e5a07a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-bg-primary)" strokeWidth="2" style={{ width: 24, height: 24 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>Photo / Screenshot</div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                  Scan a menu image
                </div>
              </div>
            </div>
          </button>
        </div>
      </Layout>
    );
  }

  // Step 2: Input content
  if (step === 'input') {
    return (
      <Layout 
        title={sourceType === 'text' ? 'Paste Menu' : sourceType === 'url' ? 'Enter URL' : 'Upload Image'}
        showBack
        onBack={() => setStep('select')}
      >
        <div className="form-group">
          {sourceType === 'text' && (
            <textarea
              className="form-input"
              placeholder="Paste menu text here...&#10;&#10;Example:&#10;Margherita Pizza - $14.99&#10;Classic tomato and mozzarella"
              value={sourceValue}
              onChange={(e) => setSourceValue(e.target.value)}
              rows={10}
              autoFocus
            />
          )}
          
          {sourceType === 'url' && (
            <input
              type="url"
              className="form-input"
              placeholder="https://restaurant.com/menu"
              value={sourceValue}
              onChange={(e) => setSourceValue(e.target.value)}
              autoFocus
            />
          )}
          
          {sourceType === 'image' && (
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // Convert to base64 for API
                    const reader = new FileReader();
                    reader.onload = () => setSourceValue(reader.result as string);
                    reader.readAsDataURL(file);
                  }
                }}
                style={{ display: 'none' }}
                id="image-upload"
              />
              <label 
                htmlFor="image-upload"
                className="btn btn-secondary"
                style={{ display: 'block', textAlign: 'center' }}
              >
                Select Image
              </label>
              {sourceValue && (
                <img 
                  src={sourceValue} 
                  alt="Selected menu" 
                  style={{ 
                    marginTop: 'var(--space-md)', 
                    maxWidth: '100%', 
                    borderRadius: 'var(--radius-md)' 
                  }} 
                />
              )}
            </div>
          )}
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={handleProcess}
          disabled={!sourceValue.trim() || isProcessing}
        >
          {isProcessing ? (
            <>
              <div className="spinner" />
              Processing...
            </>
          ) : (
            'Process Menu'
          )}
        </button>
      </Layout>
    );
  }

  // Step 3: Review and confirm
  if (step === 'review' && draft) {
    return (
      <Layout 
        title="Review Import"
        showBack
        onBack={() => setStep('input')}
      >
        {/* Restaurant Info */}
        <div className="card mb-md">
          <div className="form-group">
            <label className="form-label">Restaurant Name</label>
            <input
              type="text"
              className="form-input"
              value={draft.restaurantName}
              onChange={(e) => handleUpdateDraft('restaurantName', e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Cuisine</label>
            <select
              className="form-input form-select"
              value={draft.cuisine}
              onChange={(e) => handleUpdateDraft('cuisine', e.target.value)}
            >
              {CUISINES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Menu Items */}
        <div className="flex justify-between items-center mb-md">
          <h3>Menu Items ({draft.items.filter(i => i.selected).length}/{draft.items.length})</h3>
          <button
            className="btn btn-ghost"
            onClick={() => setDraft({
              ...draft,
              items: draft.items.map(i => ({ ...i, selected: true })),
            })}
          >
            Select All
          </button>
        </div>

        <div className="list mb-lg">
          {draft.items.map((item, index) => (
            <div 
              key={index}
              className={`card ${item.selected ? '' : 'opacity-50'}`}
              onClick={() => handleToggleItem(index)}
              style={{ cursor: 'pointer' }}
            >
              <div className="menu-item-card">
                <button
                  className={`toggle-tried ${item.selected ? 'tried' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleItem(index);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
                <div className="menu-item-content">
                  <div className="menu-item-name">{item.name}</div>
                  {item.price && (
                    <div className="menu-item-price">${item.price.toFixed(2)}</div>
                  )}
                  {item.description && (
                    <div className="menu-item-description">{item.description}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-md">
          <button
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={handleReset}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 2 }}
            onClick={handleCommit}
            disabled={isProcessing || draft.items.filter(i => i.selected).length === 0}
          >
            {isProcessing ? (
              <>
                <div className="spinner" />
                Saving...
              </>
            ) : (
              `Import ${draft.items.filter(i => i.selected).length} Items`
            )}
          </button>
        </div>
      </Layout>
    );
  }

  return null;
}
