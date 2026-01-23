import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components';
import { useAuth, useDebug } from '../context';
import { api, setApiContext } from '../services';
import type { MenuItem } from '../types';
import { QUICK_TAGS } from '../types';

export function MenuItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace, user } = useAuth();
  const { addEntry } = useDebug();
  
  const [item, setItem] = useState<MenuItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Set API context
  useEffect(() => {
    setApiContext(currentWorkspace?.id || null, user?.id || null, addEntry);
  }, [currentWorkspace?.id, user?.id, addEntry]);

  // Fetch menu item
  useEffect(() => {
    async function fetchItem() {
      if (!id) return;
      
      setIsLoading(true);
      const response = await api.getMenuItem(id);
      if (response.data) {
        setItem(response.data);
      }
      setIsLoading(false);
    }

    fetchItem();
  }, [id]);

  // Auto-save on changes
  const handleUpdate = async (updates: Partial<MenuItem>) => {
    if (!item || !id) return;
    
    setIsSaving(true);
    const response = await api.updateMenuItem(id, updates);
    if (response.data) {
      setItem(response.data);
    }
    setIsSaving(false);
  };

  const handleToggleTried = () => {
    if (!item) return;
    handleUpdate({ 
      tried: !item.tried, 
      lastTriedDate: !item.tried ? new Date().toISOString() : undefined 
    });
  };

  const handleRatingChange = (rating: number) => {
    handleUpdate({ rating: item?.rating === rating ? undefined : rating });
  };

  const handleNotesChange = (notes: string) => {
    handleUpdate({ notes });
  };

  const handleToggleTag = (tag: string) => {
    if (!item) return;
    const tags = item.tags.includes(tag)
      ? item.tags.filter(t => t !== tag)
      : [...item.tags, tag];
    handleUpdate({ tags });
  };

  if (isLoading) {
    return (
      <Layout title="Loading..." showBack onBack={() => navigate(-1)}>
        <div className="skeleton" style={{ height: 200 }} />
      </Layout>
    );
  }

  if (!item) {
    return (
      <Layout title="Not Found" showBack onBack={() => navigate(-1)}>
        <div className="empty-state">
          <h3 className="empty-state-title">Menu item not found</h3>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      title={item.name} 
      showBack 
      onBack={() => navigate(-1)}
      actions={
        isSaving && (
          <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
            Saving...
          </span>
        )
      }
    >
      {/* Tried Toggle - Large */}
      <div className="card mb-md" style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
        <button
          className={`toggle-tried ${item.tried ? 'tried' : ''}`}
          onClick={handleToggleTried}
          style={{ width: 80, height: 80, margin: '0 auto' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 40, height: 40 }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
        <p className="mt-md" style={{ color: 'var(--color-text-secondary)' }}>
          {item.tried ? 'You\'ve tried this!' : 'Not tried yet'}
        </p>
        {item.lastTriedDate && (
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
            Last tried: {new Date(item.lastTriedDate).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Rating */}
      <div className="card mb-md">
        <label className="form-label">Rating</label>
        <div className="rating" style={{ justifyContent: 'center' }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              className={`rating-star ${item.rating && star <= item.rating ? 'filled' : ''}`}
              onClick={() => handleRatingChange(star)}
              style={{ width: 44, height: 44 }}
            >
              <svg 
                viewBox="0 0 24 24" 
                fill={item.rating && star <= item.rating ? 'currentColor' : 'none'} 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Tags */}
      <div className="card mb-md">
        <label className="form-label">Quick Notes</label>
        <div className="chip-group">
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag}
              className={`chip ${item.tags.includes(tag) ? 'selected' : ''}`}
              onClick={() => handleToggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="card mb-md">
        <label className="form-label" htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          className="form-input"
          placeholder="Add your personal notes..."
          value={item.notes || ''}
          onChange={(e) => handleNotesChange(e.target.value)}
          onBlur={(e) => handleNotesChange(e.target.value)}
          rows={4}
        />
      </div>

      {/* Item Details */}
      <div className="card">
        <h4 className="mb-md">Details</h4>
        {item.category && (
          <p style={{ marginBottom: 'var(--space-sm)' }}>
            <strong>Category:</strong> {item.category}
          </p>
        )}
        {item.price && (
          <p style={{ marginBottom: 'var(--space-sm)' }}>
            <strong>Price:</strong> ${Number(item.price).toFixed(2)}
          </p>
        )}
        {item.description && (
          <p style={{ color: 'var(--color-text-secondary)' }}>
            {item.description}
          </p>
        )}
      </div>
    </Layout>
  );
}
