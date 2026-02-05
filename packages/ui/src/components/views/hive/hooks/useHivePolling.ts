import { useEffect } from 'react';
import { useHiveStore } from '@/stores/useHiveStore';

export function useHivePolling(directory: string | null | undefined) {
  const startPolling = useHiveStore((s) => s.startPolling);
  const stopPolling = useHiveStore((s) => s.stopPolling);
  const refresh = useHiveStore((s) => s.refresh);

  useEffect(() => {
    if (!directory) return;

    // Full initial fetch (status, features, summaries, selected detail)
    refresh(directory);

    // Start polling
    startPolling(directory);

    return () => stopPolling();
  }, [directory, refresh, startPolling, stopPolling]);
}
