import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components';
import { useAuth, useDebug } from '../context';
import { api, setApiContext } from '../services';
import type { StatsScope, StatsCountBy, CuisineStats } from '../types';

// Pie chart colors
const CHART_COLORS = [
  '#ff6b35', '#f7c59f', '#2ec4b6', '#ff8c5a', '#25a89c',
  '#fbbf24', '#60a5fa', '#4ade80', '#f87171', '#a78bfa',
  '#fb7185', '#34d399', '#fcd34d', '#818cf8', '#f472b6',
];

export function StatisticsPage() {
  const navigate = useNavigate();
  const { currentWorkspace, user } = useAuth();
  const { addEntry } = useDebug();
  
  const [scope, setScope] = useState<StatsScope>('tried');
  const [countBy, setCountBy] = useState<StatsCountBy>('restaurants');
  const [stats, setStats] = useState<CuisineStats[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Set API context
  useEffect(() => {
    setApiContext(currentWorkspace?.id || null, user?.id || null, addEntry);
  }, [currentWorkspace?.id, user?.id, addEntry]);

  // Fetch stats
  useEffect(() => {
    async function fetchStats() {
      setIsLoading(true);
      const response = await api.getCuisineStats(scope, countBy);
      if (response.data) {
        setStats(response.data.rows);
        setTotalCount(response.data.totalCount);
      }
      setIsLoading(false);
    }

    fetchStats();
  }, [scope, countBy]);

  // Generate pie chart SVG paths
  const pieSlices = useMemo(() => {
    if (stats.length === 0) return [];
    
    const slices: { path: string; color: string; cuisine: string; percent: number }[] = [];
    let currentAngle = -90; // Start at top
    
    stats.forEach((stat, index) => {
      const angle = (stat.percent / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      
      // Convert to radians
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      
      // Calculate points
      const x1 = 50 + 40 * Math.cos(startRad);
      const y1 = 50 + 40 * Math.sin(startRad);
      const x2 = 50 + 40 * Math.cos(endRad);
      const y2 = 50 + 40 * Math.sin(endRad);
      
      // Large arc flag (1 if angle > 180)
      const largeArc = angle > 180 ? 1 : 0;
      
      // Create path
      const path = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
      
      slices.push({
        path,
        color: CHART_COLORS[index % CHART_COLORS.length]!,
        cuisine: stat.cuisine,
        percent: stat.percent,
      });
      
      currentAngle = endAngle;
    });
    
    return slices;
  }, [stats]);

  return (
    <Layout title="Statistics">
      {/* Filter Controls */}
      <div className="card mb-md">
        <div className="form-group">
          <label className="form-label">Show</label>
          <div className="chip-group">
            <button
              className={`chip ${scope === 'tried' ? 'selected' : ''}`}
              onClick={() => setScope('tried')}
            >
              Tried only
            </button>
            <button
              className={`chip ${scope === 'all' ? 'selected' : ''}`}
              onClick={() => setScope('all')}
            >
              All
            </button>
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Count by</label>
          <div className="chip-group">
            <button
              className={`chip ${countBy === 'restaurants' ? 'selected' : ''}`}
              onClick={() => setCountBy('restaurants')}
            >
              Restaurants
            </button>
            <button
              className={`chip ${countBy === 'items' ? 'selected' : ''}`}
              onClick={() => setCountBy('items')}
            >
              Menu Items
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="stats-card">
          <div className="skeleton" style={{ height: 200, borderRadius: '50%', margin: '0 auto', width: 200 }} />
        </div>
      ) : stats.length === 0 ? (
        <div className="empty-state">
          <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
            <path d="M22 12A10 10 0 0 0 12 2v10z" />
          </svg>
          <h3 className="empty-state-title">No data yet</h3>
          <p className="empty-state-description">
            Add some restaurants to see cuisine statistics
          </p>
        </div>
      ) : (
        <>
          {/* Pie Chart */}
          <div className="stats-card mb-md">
            <div className="pie-chart-container">
              <svg viewBox="0 0 100 100" style={{ width: 200, height: 200 }}>
                {pieSlices.map((slice, index) => (
                  <path
                    key={index}
                    d={slice.path}
                    fill={slice.color}
                    stroke="var(--color-bg-card)"
                    strokeWidth="1"
                  />
                ))}
                {/* Center circle for donut effect */}
                <circle cx="50" cy="50" r="25" fill="var(--color-bg-card)" />
                {/* Center text */}
                <text x="50" y="46" textAnchor="middle" fill="var(--color-text-primary)" fontSize="10" fontWeight="600">
                  {totalCount}
                </text>
                <text x="50" y="58" textAnchor="middle" fill="var(--color-text-secondary)" fontSize="5">
                  {countBy === 'restaurants' ? 'restaurants' : 'items'}
                </text>
              </svg>
            </div>
          </div>

          {/* Legend / List */}
          <div className="stats-card">
            <div className="stats-legend">
              {stats.map((stat, index) => (
                <div 
                  key={stat.cuisine}
                  className="legend-item"
                  onClick={() => navigate(`/?cuisine=${encodeURIComponent(stat.cuisine)}`)}
                >
                  <div 
                    className="legend-color" 
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  <span className="legend-label">{stat.cuisine}</span>
                  <span className="legend-value">{stat.count}</span>
                  <span className="legend-percent">{stat.percent.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
