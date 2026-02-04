export type NtfyPriority = 1 | 2 | 3 | 4 | 5;

export interface NtfyNotificationPayload {
  topic: string;
  title?: string;
  message: string;
  priority?: NtfyPriority;
  tags?: string[];
}

export interface NtfyConfig {
  serverUrl: string;
  topic: string;
}

const DEFAULT_PRIORITY: NtfyPriority = 3;

/**
 * Send a notification to ntfy.sh
 * @param config - ntfy configuration (server URL and topic)
 * @param payload - Notification payload
 * @returns Promise resolving to true if successful
 */
export async function sendNtfyNotification(
  config: NtfyConfig,
  payload: NtfyNotificationPayload
): Promise<boolean> {
  const { serverUrl, topic } = config;
  const { title, message, priority = DEFAULT_PRIORITY, tags } = payload;

  const url = `${serverUrl.replace(/\/$/, '')}/${encodeURIComponent(topic)}`;

  const headers: Record<string, string> = {
    'Content-Type': 'text/plain',
    'Priority': String(priority),
  };

  if (title) {
    headers['Title'] = title;
  }

  if (tags && tags.length > 0) {
    headers['Tags'] = tags.join(',');
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: message,
    });

    if (!response.ok) {
      console.error('[ntfy] Notification failed:', response.status, response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[ntfy] Error sending notification:', error);
    return false;
  }
}

/**
 * Test ntfy configuration by sending a test notification
 * @param config - ntfy configuration
 * @returns Promise resolving to true if successful
 */
export async function testNtfyConfig(config: NtfyConfig): Promise<boolean> {
  return sendNtfyNotification(config, {
    topic: config.topic,
    title: 'OpenChamber Test',
    message: 'Your ntfy.sh notifications are configured correctly!',
    priority: 3,
    tags: ['white_check_mark'],
  });
}

/**
 * Map notification type to default priority
 */
export function getDefaultPriority(type: 'completion' | 'error' | 'question'): NtfyPriority {
  switch (type) {
    case 'error':
      return 4;
    case 'question':
      return 4;
    case 'completion':
    default:
      return 3;
  }
}

/**
 * Get priority label for display
 */
export function getPriorityLabel(priority: NtfyPriority): string {
  switch (priority) {
    case 1:
      return 'Min';
    case 2:
      return 'Low';
    case 3:
      return 'Default';
    case 4:
      return 'High';
    case 5:
      return 'Urgent';
    default:
      return 'Default';
  }
}
