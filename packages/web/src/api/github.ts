import type {
  GitHubAPI,
  GitHubAuthStatus,
  GitHubDeviceFlowComplete,
  GitHubDeviceFlowStart,
  GitHubUserSummary,
} from '@openchamber/ui/lib/api/types';

const jsonOrNull = async <T>(response: Response): Promise<T | null> => {
  return (await response.json().catch(() => null)) as T | null;
};

export const createWebGitHubAPI = (): GitHubAPI => ({
  async authStatus(): Promise<GitHubAuthStatus> {
    const response = await fetch('/api/github/auth/status', { method: 'GET', headers: { Accept: 'application/json' } });
    const payload = await jsonOrNull<GitHubAuthStatus & { error?: string }>(response);
    if (!response.ok || !payload) {
      throw new Error(payload?.error || response.statusText || 'Failed to load GitHub status');
    }
    return payload;
  },

  async authStart(): Promise<GitHubDeviceFlowStart> {
    const response = await fetch('/api/github/auth/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({}),
    });
    const payload = await jsonOrNull<GitHubDeviceFlowStart & { error?: string }>(response);
    if (!response.ok || !payload || !('deviceCode' in payload)) {
      throw new Error((payload as { error?: string } | null)?.error || response.statusText || 'Failed to start GitHub auth');
    }
    return payload;
  },

  async authComplete(deviceCode: string): Promise<GitHubDeviceFlowComplete> {
    const response = await fetch('/api/github/auth/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ deviceCode }),
    });
    const payload = await jsonOrNull<GitHubDeviceFlowComplete & { error?: string }>(response);
    if (!response.ok || !payload) {
      throw new Error((payload as { error?: string } | null)?.error || response.statusText || 'Failed to complete GitHub auth');
    }
    return payload;
  },

  async authDisconnect(): Promise<{ removed: boolean }> {
    const response = await fetch('/api/github/auth', { method: 'DELETE', headers: { Accept: 'application/json' } });
    const payload = await jsonOrNull<{ removed?: boolean; error?: string }>(response);
    if (!response.ok) {
      throw new Error(payload?.error || response.statusText || 'Failed to disconnect GitHub');
    }
    return { removed: Boolean(payload?.removed) };
  },

  async me(): Promise<GitHubUserSummary> {
    const response = await fetch('/api/github/me', { method: 'GET', headers: { Accept: 'application/json' } });
    const payload = await jsonOrNull<GitHubUserSummary & { error?: string }>(response);
    if (!response.ok || !payload) {
      throw new Error(payload?.error || response.statusText || 'Failed to fetch GitHub user');
    }
    return payload;
  },
});
