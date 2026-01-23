import type {
  GitHubAPI,
  GitHubAuthStatus,
  GitHubDeviceFlowComplete,
  GitHubDeviceFlowStart,
  GitHubUserSummary,
} from '@openchamber/ui/lib/api/types';

export const createDesktopGitHubAPI = (): GitHubAPI => ({
  async authStatus(): Promise<GitHubAuthStatus> {
    const { safeInvoke } = await import('../lib/tauriCallbackManager');
    return safeInvoke<GitHubAuthStatus>('github_auth_status', {}, { timeout: 8000 });
  },

  async authStart(): Promise<GitHubDeviceFlowStart> {
    const { safeInvoke } = await import('../lib/tauriCallbackManager');
    return safeInvoke<GitHubDeviceFlowStart>('github_auth_start', {}, { timeout: 8000 });
  },

  async authComplete(deviceCode: string): Promise<GitHubDeviceFlowComplete> {
    const { safeInvoke } = await import('../lib/tauriCallbackManager');
    return safeInvoke<GitHubDeviceFlowComplete>('github_auth_complete', { deviceCode }, { timeout: 12000 });
  },

  async authDisconnect(): Promise<{ removed: boolean }> {
    const { safeInvoke } = await import('../lib/tauriCallbackManager');
    const result = await safeInvoke<{ removed: boolean }>('github_auth_disconnect', {}, { timeout: 8000 });
    return { removed: Boolean(result?.removed) };
  },

  async me(): Promise<GitHubUserSummary> {
    const { safeInvoke } = await import('../lib/tauriCallbackManager');
    return safeInvoke<GitHubUserSummary>('github_me', {}, { timeout: 8000 });
  },
});
