import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { DebugEntry } from '../types';

interface DebugContextType {
  entries: DebugEntry[];
  isDebugEnabled: boolean;
  addEntry: (entry: Omit<DebugEntry, 'id'>) => void;
  clearEntries: () => void;
  toggleDebug: () => void;
  copyDebugReport: () => Promise<void>;
}

const DebugContext = createContext<DebugContextType | null>(null);

const MAX_ENTRIES = 100;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function DebugProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<DebugEntry[]>([]);
  const [isDebugEnabled, setIsDebugEnabled] = useState(() => {
    // Check if in development mode
    const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    if (isDev) return true;
    return localStorage.getItem('tastetrail_debug') === 'true';
  });

  const addEntry = useCallback((entry: Omit<DebugEntry, 'id'>) => {
    setEntries(prev => {
      const newEntry: DebugEntry = { ...entry, id: generateId() };
      const updated = [newEntry, ...prev];
      return updated.slice(0, MAX_ENTRIES);
    });
  }, []);

  const clearEntries = useCallback(() => {
    setEntries([]);
  }, []);

  const toggleDebug = useCallback(() => {
    setIsDebugEnabled(prev => {
      const next = !prev;
      localStorage.setItem('tastetrail_debug', String(next));
      return next;
    });
  }, []);

  const copyDebugReport = useCallback(async () => {
    const report = entries.map(entry => {
      const lines = [
        `[${entry.timestamp}] ${entry.type.toUpperCase()}: ${entry.message}`,
      ];
      if (entry.correlationId) lines.push(`  Correlation ID: ${entry.correlationId}`);
      if (entry.apiRoute) lines.push(`  API Route: ${entry.apiRoute}`);
      if (entry.userId) lines.push(`  User ID: ${entry.userId}`);
      if (entry.workspaceId) lines.push(`  Workspace ID: ${entry.workspaceId}`);
      if (entry.stack) lines.push(`  Stack:\n${entry.stack.split('\n').map(l => '    ' + l).join('\n')}`);
      return lines.join('\n');
    }).join('\n\n---\n\n');

    const fullReport = `TasteTrail Debug Report\nGenerated: ${new Date().toISOString()}\nEntries: ${entries.length}\n\n${'='.repeat(50)}\n\n${report}`;

    try {
      await navigator.clipboard.writeText(fullReport);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = fullReport;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }, [entries]);

  // Listen for global errors
  useEffect(() => {
    const handleError = (event: CustomEvent) => {
      addEntry({
        timestamp: event.detail.timestamp || new Date().toISOString(),
        type: 'error',
        message: event.detail.message,
        stack: event.detail.stack,
        details: {
          source: event.detail.source,
          lineno: event.detail.lineno,
          colno: event.detail.colno,
        },
      });
    };

    window.addEventListener('tastetrail:error', handleError as EventListener);
    return () => {
      window.removeEventListener('tastetrail:error', handleError as EventListener);
    };
  }, [addEntry]);

  const value: DebugContextType = {
    entries,
    isDebugEnabled,
    addEntry,
    clearEntries,
    toggleDebug,
    copyDebugReport,
  };

  return (
    <DebugContext.Provider value={value}>
      {children}
    </DebugContext.Provider>
  );
}

export function useDebug() {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
}
