import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components';
import { useAuth, useDebug } from '../context';
import { api, setApiContext } from '../services';
import type { Restaurant } from '../types';

export function RestaurantsPage() {
  const navigate = useNavigate();
  const { currentWorkspace, user } = useAuth();
  const { addEntry } = useDebug();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'mine' | 'shared'>('all');

  // Set API context
  useEffect(() => {
    setApiContext(currentWorkspace?.id || null, user?.id || null, addEntry);
  }, [currentWorkspace?.id, user?.id, addEntry]);

  // Fetch restaurants (Combined list)
  useEffect(() => {
    async function fetchRestaurants() {
      // We don't need currentWorkspace check anymore as the API returns all for the user
      if (!user) return;
      
      setIsLoading(true);
      // We pass the workspace ID just to satisfy the method signature if strictly typed, 
      // but the backend ignores it for the global list. 
      // However, api.getRestaurants currently expects an argument. 
      // Let's pass 'global' or currentWorkspace.id if available.
      const response = await api.getRestaurants(currentWorkspace?.id || 'global');
      if (response.data) {
        setRestaurants(response.data.restaurants);
      }
      setIsLoading(false);
    }

    fetchRestaurants();
  }, [user, currentWorkspace?.id]); // Re-fetch if user changes. kept workspace dep to be safe but logically it's user-bound now.

  // Filter and sort restaurants
  const filteredRestaurants = useMemo(() => {
    let result = [...restaurants];
    
    // Apply Ownership Filter
    if (filterMode === 'mine') {
      result = result.filter(r => !r.isShared);
    } else if (filterMode === 'shared') {
      result = result.filter(r => r.isShared);
    }
    
    // Apply Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        r => r.name.toLowerCase().includes(query) || 
             r.cuisine.toLowerCase().includes(query)
      );
    }
    
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [restaurants, searchQuery, filterMode]);

  return (
    <Layout title="TasteTrail">
      <div className="mb-md">
        {/* Search Bar */}
        <div className="search-bar mb-sm">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            className="form-input search-input"
            placeholder="Search restaurants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Toggles */}
        <div className="flex gap-xs overflow-x-auto pb-xs">
          <button 
            className={`btn btn-sm ${filterMode === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilterMode('all')}
          >
            All
          </button>
          <button 
            className={`btn btn-sm ${filterMode === 'mine' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilterMode('mine')}
          >
            My Restaurants
          </button>
          <button 
            className={`btn btn-sm ${filterMode === 'shared' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilterMode('shared')}
          >
            Shared with me
          </button>
        </div>
      </div>

      {/* Restaurant List */}
      {isLoading ? (
        <div className="list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="restaurant-card">
                <div className="skeleton" style={{ width: 48, height: 48 }} />
                <div className="restaurant-info">
                  <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 16, width: '40%' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredRestaurants.length === 0 ? (
        <div className="empty-state">
          <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
            <path d="M7 2v20" />
            <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
          </svg>
          <h3 className="empty-state-title">
            {searchQuery 
              ? 'No restaurants found' 
              : filterMode === 'shared' 
                ? 'No shared restaurants yet' 
                : 'No restaurants yet'}
          </h3>
          <p className="empty-state-description">
            {searchQuery 
              ? 'Try a different search term' 
              : filterMode === 'shared'
                ? 'Ask a family member to invite you to their workspace'
                : 'Add your first restaurant to get started'
            }
          </p>
        </div>
      ) : (
        <div className="list">
          {filteredRestaurants.map((restaurant) => (
            <div
              key={restaurant.id}
              className="card card-interactive"
              onClick={() => navigate(`/restaurant/${restaurant.id}`)}
              style={{ position: 'relative' }}
            >
              <div className="restaurant-card">
                <div className="restaurant-avatar">
                  {restaurant.name.charAt(0).toUpperCase()}
                </div>
                <div className="restaurant-info">
                  <div className="flex items-center gap-sm">
                    <div className="restaurant-name">{restaurant.name}</div>
                    {restaurant.isShared && (
                      <span className="badge badge-info flex items-center gap-xs" style={{ fontSize: '10px', padding: '2px 6px', height: 'auto' }}>
                         Shared
                      </span>
                    )}
                  </div>
                  <div className="restaurant-meta">
                    <span className="cuisine-badge">{restaurant.cuisine}</span>
                    {restaurant.triedCount !== undefined && restaurant.menuItemCount !== undefined && (
                      <span>
                        {restaurant.triedCount}/{restaurant.menuItemCount} tried
                      </span>
                    )}
                    {restaurant.isShared && restaurant.ownerName && (
                       <span style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)' }}>
                         by {restaurant.ownerName}
                       </span>
                    )}
                  </div>
                </div>
                <svg 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  style={{ width: 20, height: 20, color: 'var(--color-text-tertiary)' }}
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
