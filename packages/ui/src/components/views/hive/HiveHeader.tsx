import React from 'react';
import { RiRefreshLine, RiAddLine } from '@remixicon/react';

interface HiveHeaderProps {
  onRefresh: () => void;
  onCreateFeature: () => void;
  isLoading: boolean;
}

export const HiveHeader: React.FC<HiveHeaderProps> = ({ onRefresh, onCreateFeature, isLoading }) => (
  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
    <span className="typography-ui-label text-muted-foreground">Features</span>
    <div className="flex items-center gap-1">
      <button
        onClick={onRefresh}
        className="p-1 rounded hover:bg-interactive-hover text-muted-foreground"
        disabled={isLoading}
        title="Refresh"
      >
        <RiRefreshLine size={16} className={isLoading ? 'animate-spin' : ''} />
      </button>
      <button
        onClick={onCreateFeature}
        className="p-1 rounded hover:bg-interactive-hover text-muted-foreground"
        title="Create Feature"
      >
        <RiAddLine size={16} />
      </button>
    </div>
  </div>
);
