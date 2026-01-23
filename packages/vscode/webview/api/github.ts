import type {
  GitHubAPI,
  GitHubAuthStatus,
  GitHubDeviceFlowComplete,
  GitHubDeviceFlowStart,
  GitHubUserSummary,
} from '@openchamber/ui/lib/api/types';

import { sendBridgeMessage } from './bridge';

export const createVSCodeGitHubAPI = (): GitHubAPI => ({
  authStatus: async () => sendBridgeMessage<GitHubAuthStatus>('api:github/auth:status'),
  authStart: async () => sendBridgeMessage<GitHubDeviceFlowStart>('api:github/auth:start'),
  authComplete: async (deviceCode: string) =>
    sendBridgeMessage<GitHubDeviceFlowComplete>('api:github/auth:complete', { deviceCode }),
  authDisconnect: async () => sendBridgeMessage<{ removed: boolean }>('api:github/auth:disconnect'),
  me: async () => sendBridgeMessage<GitHubUserSummary>('api:github/me'),
});
