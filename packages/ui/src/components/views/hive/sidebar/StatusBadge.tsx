import React from 'react';
import { cn } from '@/lib/utils';
import type { FeatureStatus, TaskStatusType } from '@/stores/useHiveStore';

const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-status-info-background text-status-info',
  approved: 'bg-status-success-background text-status-success',
  executing: 'bg-status-warning-background text-status-warning',
  completed: 'bg-surface-muted text-muted-foreground',
  pending: 'bg-surface-muted text-muted-foreground',
  in_progress: 'bg-status-warning-background text-status-warning',
  done: 'bg-status-success-background text-status-success',
  cancelled: 'bg-surface-muted text-muted-foreground line-through',
  blocked: 'bg-status-error-background text-status-error',
  failed: 'bg-status-error-background text-status-error',
  partial: 'bg-status-warning-background text-status-warning',
};

export const StatusBadge: React.FC<{ status: FeatureStatus | TaskStatusType }> = ({ status }) => (
  <span
    className={cn(
      'px-1.5 py-0.5 rounded typography-micro whitespace-nowrap',
      STATUS_COLORS[status] || 'bg-surface-muted text-muted-foreground'
    )}
  >
    {status.replace('_', ' ')}
  </span>
);
