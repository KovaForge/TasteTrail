import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components';
import { useAuth, useDebug } from '../context';
import { api, setApiContext } from '../services';
import type { Restaurant, MenuItem } from '../types';

export function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace, user } = useAuth();
  const { addEntry } = useDebug();
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Set API context
  useEffect(() => {
    setApiContext(currentWorkspace?.id || null, user?.id || null, addEntry);
  }, [currentWorkspace?.id, user?.id, addEntry]);

  // Fetch restaurant and menu items
  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      
      setIsLoading(true);
      
      const [restaurantRes, itemsRes] = await Promise.all([
        api.getRestaurant(id),
        api.getMenuItems(id),
      ]);
      
      if (restaurantRes.data) {
        setRestaurant(restaurantRes.data);
      }
      if (itemsRes.data) {
        setMenuItems(itemsRes.data.items);
      }
      
      setIsLoading(false);
    }

    fetchData();
  }, [id]);

  // Toggle tried status
  const handleToggleTried = useCallback(async (item: MenuItem) => {
    const response = await api.toggleTried(item.id, !item.tried);
    if (response.data) {
      setMenuItems(prev => 
        prev.map(i => i.id === item.id ? response.data! : i)
      );
    }
  }, []);

  if (isLoading) {
    return (
      <Layout title="Loading..." showBack onBack={() => navigate('/')}>
        <div className="skeleton" style={{ height: 100, marginBottom: 'var(--space-md)' }} />
        <div className="list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="skeleton" style={{ height: 60 }} />
            </div>
          ))}
        </div>
      </Layout>
    );
  }


  const handleShare = async () => {
    if (!id) return;
    try {
      const response = await api.createShareLink(id);
      if (response.data) {
        const link = `${window.location.origin}/share/${response.data.token}`;
        await navigator.clipboard.writeText(link);
        alert(`Share link copied to clipboard!\n\n${link}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate share link');
    }
  };

  if (!restaurant) {
    return (
      <Layout title="Not Found" showBack onBack={() => navigate('/')}>
        <div className="empty-state">
          <h3 className="empty-state-title">Restaurant not found</h3>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      title={restaurant.name} 
      showBack 
      onBack={() => navigate('/')}
      actions={
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          {!restaurant.isShared && (
            <>
              <button 
                className="btn btn-ghost btn-icon"
                onClick={handleShare}
                aria-label="Share restaurant"
                title="Share restaurant"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </button>
              <button 
                className="btn btn-ghost btn-icon"
                onClick={() => navigate(`/restaurant/${id}/edit`)}
                aria-label="Edit restaurant"
                title="Edit restaurant"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </button>
            </>
          )}
        </div>
      }
    >
      {/* Restaurant Info */}
      <div className="card mb-md">
        <div className="flex items-center gap-md mb-md flex-wrap">
          <span className="cuisine-badge">{restaurant.cuisine}</span>
          {restaurant.isShared && (
            <span className="badge badge-info flex items-center gap-xs">
              Shared by {restaurant.ownerName || 'another user'}
            </span>
          )}
          {restaurant.addressSuburb && (
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              📍 {restaurant.addressSuburb}
            </span>
          )}
        </div>
        {restaurant.notes && (
          <p style={{ color: 'var(--color-text-secondary)' }}>{restaurant.notes}</p>
        )}
        {!restaurant.isShared && (
          <button
            className="btn btn-secondary"
            onClick={handleShare}
            style={{ marginTop: 'var(--space-md)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-sm)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share Restaurant
          </button>
        )}
      </div>

      {/* Menu Items Section */}
      <div className="flex justify-between items-center mb-md">
        <h3>Menu Items ({menuItems.length})</h3>
        <button 
          className="btn btn-secondary"
          onClick={() => navigate(`/restaurant/${id}/menu-item/new`)}
        >
          Add Item
        </button>
      </div>

      {menuItems.length === 0 ? (
        <div className="empty-state">
          <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <h3 className="empty-state-title">No menu items yet</h3>
          <p className="empty-state-description">
            {restaurant.isShared 
              ? 'The owner hasn\'t added any items yet' 
              : 'Add items you want to try or have tried'}
          </p>
        </div>
      ) : (
        <div className="list">
          {menuItems.map((item) => (
            <div key={item.id} className="card">
              <div className="menu-item-card">
                {/* Tried Toggle */}
                <button
                  className={`toggle-tried ${item.tried ? 'tried' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleTried(item);
                  }}
                  aria-label={item.tried ? 'Mark as not tried' : 'Mark as tried'}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
                
                {/* Item Info */}
                <div 
                  className="menu-item-content"
                  onClick={() => navigate(`/menu-item/${item.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="menu-item-name">{item.name}</div>
                  {item.price && (
                    <div className="menu-item-price">${Number(item.price).toFixed(2)}</div>
                  )}
                  {item.description && (
                    <div className="menu-item-description">{item.description}</div>
                  )}
                  {item.rating && (
                    <div className="flex gap-xs mt-sm">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          viewBox="0 0 24 24"
                          fill={star <= item.rating! ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth="2"
                          style={{ 
                            width: 16, 
                            height: 16, 
                            color: star <= item.rating! ? 'var(--color-warning)' : 'var(--color-text-tertiary)'
                          }}
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </div>
                  )}
                </div>

                <svg 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  style={{ width: 20, height: 20, color: 'var(--color-text-tertiary)', flexShrink: 0 }}
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
