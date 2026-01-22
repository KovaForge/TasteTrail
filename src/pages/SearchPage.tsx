import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components';
import { useAuth, useDebug } from '../context';
import { api, setApiContext } from '../services';
import type { Restaurant, MenuItem, SearchFilters } from '../types';

export function SearchPage() {
  const navigate = useNavigate();
  const { currentWorkspace, user } = useAuth();
  const { addEntry } = useDebug();
  
  const [filters, setFilters] = useState<SearchFilters>({ query: '' });
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Set API context
  useEffect(() => {
    setApiContext(currentWorkspace?.id || null, user?.id || null, addEntry);
  }, [currentWorkspace?.id, user?.id, addEntry]);

  // Search when query changes (debounced)
  useEffect(() => {
    if (!filters.query.trim()) {
      setRestaurants([]);
      setMenuItems([]);
      setHasSearched(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      setHasSearched(true);
      
      const response = await api.search(filters);
      if (response.data) {
        setRestaurants(response.data.restaurants);
        setMenuItems(response.data.menuItems);
      }
      
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filters]);

  // Group menu items by restaurant
  const groupedResults = useMemo(() => {
    const restaurantMap = new Map(restaurants.map(r => [r.id, r]));
    const groups: { restaurant: Restaurant; items: MenuItem[] }[] = [];
    
    // Add restaurants with their items
    restaurants.forEach(r => {
      groups.push({
        restaurant: r,
        items: menuItems.filter(i => i.restaurantId === r.id),
      });
    });
    
    // Add orphan items (shouldn't happen but just in case)
    const restaurantIds = new Set(restaurants.map(r => r.id));
    menuItems
      .filter(i => !restaurantIds.has(i.restaurantId))
      .forEach(i => {
        const restaurant = restaurantMap.get(i.restaurantId);
        if (restaurant) {
          const existing = groups.find(g => g.restaurant.id === restaurant.id);
          if (existing) {
            existing.items.push(i);
          } else {
            groups.push({ restaurant, items: [i] });
          }
        }
      });
    
    return groups;
  }, [restaurants, menuItems]);

  return (
    <Layout title="Search">
      {/* Search Input */}
      <div className="search-bar mb-md">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          className="form-input search-input"
          placeholder="Search restaurants and menu items..."
          value={filters.query}
          onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
          autoFocus
        />
      </div>

      {/* Filter Chips */}
      <div className="chip-group mb-md">
        <button
          className={`chip ${filters.tried === true ? 'selected' : ''}`}
          onClick={() => setFilters(prev => ({ 
            ...prev, 
            tried: prev.tried === true ? undefined : true 
          }))}
        >
          ✓ Tried
        </button>
        <button
          className={`chip ${filters.tried === false ? 'selected' : ''}`}
          onClick={() => setFilters(prev => ({ 
            ...prev, 
            tried: prev.tried === false ? undefined : false 
          }))}
        >
          ○ Not tried
        </button>
        {[3, 4, 5].map(rating => (
          <button
            key={rating}
            className={`chip ${filters.minRating === rating ? 'selected' : ''}`}
            onClick={() => setFilters(prev => ({ 
              ...prev, 
              minRating: prev.minRating === rating ? undefined : rating 
            }))}
          >
            {rating}+ ★
          </button>
        ))}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="list">
          {[1, 2].map((i) => (
            <div key={i} className="card">
              <div className="skeleton" style={{ height: 80 }} />
            </div>
          ))}
        </div>
      ) : !hasSearched ? (
        <div className="empty-state">
          <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <h3 className="empty-state-title">Search TasteTrail</h3>
          <p className="empty-state-description">Find restaurants and menu items</p>
        </div>
      ) : groupedResults.length === 0 ? (
        <div className="empty-state">
          <h3 className="empty-state-title">No results found</h3>
          <p className="empty-state-description">Try different keywords or filters</p>
        </div>
      ) : (
        <div className="list">
          {groupedResults.map(({ restaurant, items }) => (
            <div key={restaurant.id} className="card">
              {/* Restaurant Header */}
              <div 
                className="restaurant-card card-interactive"
                onClick={() => navigate(`/restaurant/${restaurant.id}`)}
              >
                <div className="restaurant-avatar">
                  {restaurant.name.charAt(0).toUpperCase()}
                </div>
                <div className="restaurant-info">
                  <div className="restaurant-name">{restaurant.name}</div>
                  <span className="cuisine-badge">{restaurant.cuisine}</span>
                </div>
              </div>
              
              {/* Matching Menu Items */}
              {items.length > 0 && (
                <div style={{ paddingLeft: 'var(--space-lg)', marginTop: 'var(--space-sm)' }}>
                  {items.map(item => (
                    <div 
                      key={item.id}
                      className="flex items-center gap-sm"
                      onClick={() => navigate(`/menu-item/${item.id}`)}
                      style={{ 
                        padding: 'var(--space-sm)', 
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <span className={item.tried ? 'text-success' : ''}>
                        {item.tried ? '✓' : '○'}
                      </span>
                      <span>{item.name}</span>
                      {item.rating && (
                        <span style={{ color: 'var(--color-warning)' }}>
                          {'★'.repeat(item.rating)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
