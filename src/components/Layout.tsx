import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: ReactNode;
}

export function Layout({ children, title, showBack, onBack, actions }: LayoutProps) {
  return (
    <div className="app-layout">
      {(title || showBack || actions) && (
        <header className="app-header">
          <div className="flex items-center gap-md">
            {showBack && (
              <button 
                className="btn btn-ghost btn-icon" 
                onClick={onBack}
                aria-label="Go back"
              >
                <svg 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  style={{ width: 24, height: 24 }}
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
            )}
            {title && <h1>{title}</h1>}
          </div>
          {actions && <div className="flex items-center gap-sm">{actions}</div>}
        </header>
      )}
      <main className="main-content">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
