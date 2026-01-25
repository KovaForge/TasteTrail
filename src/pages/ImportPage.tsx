import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components';
import { useAuth, useDebug } from '../context';
import { api, setApiContext } from '../services';
import type { ImportSourceType, ImportDraft, Restaurant } from '../types';
import { CUISINES } from '../types';

type ImportStep = 'select' | 'input' | 'review';

const JSON_TEMPLATE = {
  "restaurant": {
    "name": "Pizzeria Tiramisu",
    "cuisine": "Italian",
    "addressSuburb": "Melbourne CBD",
    "notes": "Wood-fired pizza, dine-in and takeaway"
  },
  "items": [
    {
      "name": "Margherita",
      "category": "Pizza",
      "price": 18.50,
      "description": "San Marzano tomato, fior di latte, fresh basil",
      "tags": ["vegetarian"],
      "tried": false,
      "notes": ""
    },
    {
      "name": "Pepperoni",
      "category": "Pizza",
      "price": 22.00,
      "description": "Tomato base, mozzarella, spicy pepperoni",
      "tags": [],
      "tried": false,
      "notes": ""
    },
    {
      "name": "Quattro Formaggi",
      "category": "Pizza",
      "price": 24.00,
      "description": "Mozzarella, gorgonzola, parmesan, provolone",
      "tags": ["vegetarian"],
      "tried": false,
      "notes": ""
    },
    {
      "name": "Bruschetta",
      "category": "Entree",
      "price": 14.00,
      "description": "Toasted sourdough, diced tomato, garlic, basil, olive oil",
      "tags": ["vegetarian"],
      "tried": false,
      "notes": ""
    },
    {
      "name": "Arancini",
      "category": "Entree",
      "price": 12.00,
      "description": "Fried risotto balls with mozzarella, served with napoli sauce",
      "tags": ["vegetarian"],
      "tried": false,
      "notes": ""
    },
    {
      "name": "Spaghetti Bolognese",
      "category": "Pasta",
      "price": 22.00,
      "description": "Slow-cooked beef ragu, parmesan",
      "tags": [],
      "tried": false,
      "notes": ""
    },
    {
      "name": "Penne Arrabiata",
      "category": "Pasta",
      "price": 19.00,
      "description": "Spicy tomato sauce, chilli, garlic, fresh parsley",
      "tags": ["vegetarian", "spicy"],
      "tried": false,
      "notes": ""
    },
    {
      "name": "Tiramisu",
      "category": "Dessert",
      "price": 14.00,
      "description": "Classic Italian dessert with mascarpone, espresso, cocoa",
      "tags": ["vegetarian"],
      "tried": false,
      "notes": ""
    },
    {
      "name": "Panna Cotta",
      "category": "Dessert",
      "price": 12.00,
      "description": "Vanilla bean panna cotta with berry coulis",
      "tags": ["vegetarian"],
      "tried": false,
      "notes": ""
    }
  ],
  "warnings": []
};

const PROMPT_INSTRUCTIONS = `Transform the menu content above into the provided JSON template.
Use only the information in the menu.
Do not invent items or prices.
If a value is unclear set it to null.
Preserve item names exactly as written.
Return JSON only with no explanation.`;

export function ImportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const restaurantIdParam = searchParams.get('restaurantId');
  const { currentWorkspace, user } = useAuth();
  const { addEntry } = useDebug();
  
  const [step, setStep] = useState<ImportStep>('select');
  const [sourceType, setSourceType] = useState<ImportSourceType>('text');
  const [sourceValue, setSourceValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importId, setImportId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [existingRestaurants, setExistingRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>('');

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

    const settingsResponse = await api.getAISettings();
    if (!settingsResponse.data?.hasOpenAi && !settingsResponse.data?.hasGemini) {
      addEntry({
        type: 'error',
        message: 'AI provider not configured. Please add your API key in Settings.',
        timestamp: new Date().toISOString(),
      });
      alert('You need to configure an AI Provider (OpenAI or Gemini) in Settings to import menus.');
      return;
    }

    // Determine the provider to use: respect user selection, or auto-detect if only one is available
    let providerToUse = selectedProvider;
    if (!providerToUse) {
      if (settingsResponse.data.hasOpenAi && !settingsResponse.data.hasGemini) {
        providerToUse = 'openai';
      } else if (settingsResponse.data.hasGemini && !settingsResponse.data.hasOpenAi) {
        providerToUse = 'gemini';
      }
      // If both are available and none selected, prompt via the UI (handled below)
    }

    // Update available providers for UI
    const providers: string[] = [];
    if (settingsResponse.data.hasOpenAi) providers.push('openai');
    if (settingsResponse.data.hasGemini) providers.push('gemini');
    setAvailableProviders(providers);

    // If multiple providers are available and none selected, default to first and let user choose
    if (providers.length > 1 && !providerToUse) {
      setSelectedProvider(providers[0] || '');
      return;
    }

    setIsProcessing(true);

    // For images, we need to ensure we send just the base64 data if it has a prefix
    let processedValue = sourceValue;
    if (sourceType === 'image' && sourceValue.includes('base64,')) {
      processedValue = sourceValue.split('base64,')[1] || sourceValue;
    }

    setParseError(null);

    const response = await api.parseImport({
      sourceType: sourceType === 'json' ? 'text' : sourceType,
      sourceValue: processedValue,
      provider: providerToUse || undefined,
    });

    if (response.data) {
      setImportId(response.data.id);
      setDraft({
        restaurantName: response.data.restaurant.name,
        cuisine: response.data.restaurant.cuisine,
        items: response.data.items.map((item: any) => ({
          ...item,
          selected: true,
        })),
      });
      // Fetch existing restaurants for the selector
      if (currentWorkspace?.id) {
        const restResponse = await api.getRestaurants(currentWorkspace.id);
        if (restResponse.data) {
          setExistingRestaurants(restResponse.data.restaurants);
          // Pre-select restaurant if restaurantId was passed via query param
          if (restaurantIdParam) {
            const match = restResponse.data.restaurants.find(r => r.id === restaurantIdParam);
            if (match) {
              setSelectedRestaurantId(match.id);
              setDraft(prev => prev ? { ...prev, restaurantName: match.name, cuisine: match.cuisine } : prev);
            }
          }
        }
      }
      if (!restaurantIdParam) {
        setSelectedRestaurantId('');
      }
      setStep('review');
    } else if (response.error) {
      const detail = (response.error.details?.message as string) || response.error.message;
      setParseError(detail);
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
          <div className="card" style={{ display: 'flex', alignItems: 'center', padding: 0, overflow: 'hidden', cursor: 'pointer' }} onClick={() => handleSourceSelect('json')}>
             <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-md)' }}>
              <div style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ width: 24, height: 24 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M10 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />
                  <path d="M10 16c0-2 4-2 4 0" />
                </svg>
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>Paste JSON string</div>
                <div style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                  (Recommended)
                </div>
              </div>
            </div>
             <button 
                className="btn btn-secondary"
                style={{ margin: 'var(--space-md)', pointerEvents: 'auto' }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(JSON.stringify(JSON_TEMPLATE, null, 2));
                  alert('JSON template copied to clipboard!');
                }}
              >
                Copy Template
              </button>
          </div>

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
                  Import from a restaurant website <span style={{ opacity: 0.7 }}>(experimental)</span>
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
                  Scan a menu image <span style={{ opacity: 0.7 }}>(experimental)</span>
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
        title={sourceType === 'text' ? 'Paste Menu' : sourceType === 'url' ? 'Enter URL' : sourceType === 'json' ? 'Paste JSON' : 'Upload Image'}
        showBack
        onBack={() => setStep('select')}
      >
        <div className="form-group">
          {sourceType === 'json' && (
             <div className="card mb-md text-sm" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                <p className="mb-sm"><strong>How to convert a restaurant menu into JSON using AI</strong></p>
                <ol className="pl-lg mb-md space-y-sm">
                  <li>Open <strong>ChatGPT</strong> or <strong>Gemini</strong>.</li>
                  <li>Copy the JSON template you want to use.</li>
                  <li>
                    Go to the restaurant menu.<br/>
                    <span style={{ opacity: 0.8 }}>This can be a website, screenshot, photo, or PDF.</span>
                  </li>
                  <li>
                    Copy the menu text.<br/>
                    <span style={{ opacity: 0.8 }}>If it is an image or PDF, upload it to the AI instead.</span>
                  </li>
                  <li>Paste the menu content into ChatGPT or Gemini.</li>
                  <li>Paste the JSON template and then give this exact instruction:
                    <div className="p-sm bg-bg-primary rounded border border-border mt-xs mb-xs italic relative">
                      “{PROMPT_INSTRUCTIONS}”
                      <button 
                        className="btn btn-xs btn-secondary absolute top-xs right-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(PROMPT_INSTRUCTIONS);
                          alert('Instructions copied to clipboard!');
                        }}
                        title="Copy instructions"
                      >
                        Copy Instructions
                      </button>
                    </div>
                  </li>
                  <li>Review the generated JSON and correct anything that looks wrong.</li>
                  <li><strong>Save the final JSON output.</strong></li>
                </ol>
             </div>
          )}

          {(sourceType === 'text' || sourceType === 'json') && (
            <textarea
              className="form-input"
              placeholder={sourceType === 'json' ? 'Paste the JSON output from AI here...' : "Paste menu text here...\n\nExample:\nMargherita Pizza - $14.99\nClassic tomato and mozzarella"}
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

        {availableProviders.length > 1 && (
          <div className="form-group">
            <label className="form-label">AI Provider</label>
            <select
              className="form-input form-select"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
            >
              {availableProviders.map(p => (
                <option key={p} value={p}>{p === 'openai' ? 'OpenAI' : 'Gemini'}</option>
              ))}
            </select>
          </div>
        )}

        {parseError && (
          <div className="p-sm rounded bg-error-subtle text-error" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-sm)' }}>
            {parseError}
          </div>
        )}

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
          {existingRestaurants.length > 0 && (
            <div className="form-group">
              <label className="form-label">Restaurant</label>
              <select
                className="form-input form-select"
                value={selectedRestaurantId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedRestaurantId(id);
                  if (id) {
                    const existing = existingRestaurants.find(r => r.id === id);
                    if (existing) {
                      setDraft({ ...draft, restaurantName: existing.name, cuisine: existing.cuisine });
                    }
                  }
                }}
              >
                <option value="">-- Create New Restaurant --</option>
                {existingRestaurants.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.cuisine})</option>
                ))}
              </select>
            </div>
          )}
          {!selectedRestaurantId && (
            <>
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
            </>
          )}
          {selectedRestaurantId && (
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              Items will be added to the existing restaurant.
            </div>
          )}
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
                    <div className="menu-item-price">${Number(item.price).toFixed(2)}</div>
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
