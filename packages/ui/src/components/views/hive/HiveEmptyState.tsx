import React from 'react';
import { RiHexagonLine } from '@remixicon/react';

export const HiveEmptyState: React.FC = () => (
  <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground px-6">
    <RiHexagonLine size={48} className="opacity-40" />
    <p className="typography-ui-header">No Hive Detected</p>
    <p className="typography-ui text-center max-w-md">
      No <code className="px-1 py-0.5 rounded bg-surface-muted text-sm">.hive/</code> directory
      found in this project. Start a Hive session from your AI agent to initialize feature tracking.
    </p>
  </div>
);
