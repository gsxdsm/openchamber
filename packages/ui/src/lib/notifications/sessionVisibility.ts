import { useSessionStore } from '@/stores/useSessionStore';
import { useDirectoryStore } from '@/stores/useDirectoryStore';
import type { Session } from '@opencode-ai/sdk/v2';

/**
 * Check if a session would be visible in the sidebar
 * A session is visible if it would appear as a root-level item
 * 
 * @param sessionId - The session ID to check
 * @returns boolean indicating if the session is visible
 */
export function isSessionVisible(sessionId: string): boolean {
  const { sessions } = useSessionStore.getState();
  const { currentDirectory } = useDirectoryStore.getState();

  const session = sessions.find(s => s.id === sessionId);
  if (!session) {
    return false;
  }

  // Sessions with a [hidden] title prefix are internal (e.g. summarization,
  // title generation) and should never produce user-facing notifications.
  if (session.title?.startsWith('[hidden]')) {
    return false;
  }

  // Check if session has a parentID (would be nested under parent in sidebar)
  const sessionWithParent = session as Session & { parentID?: string | null };
  if (sessionWithParent.parentID) {
    // This is a subtask - it's not visible as a root item
    // unless its parent is not in the current context
    const parent = sessions.find(s => s.id === sessionWithParent.parentID);
    if (parent) {
      // Parent exists, so this session would be nested
      return false;
    }
  }

  // Check if session is in the current directory context
  // Sessions are grouped by directory in the sidebar
  const sessionDirectory = (session as Session & { directory?: string }).directory;
  if (currentDirectory && sessionDirectory) {
    // Normalize paths for comparison
    const normalizedCurrent = currentDirectory.replace(/\/$/, '');
    const normalizedSession = sessionDirectory.replace(/\/$/, '');
    
    // Session is visible if it's in the current directory
    // or if we're showing all sessions (no current directory filter)
    return normalizedSession === normalizedCurrent || 
           normalizedSession.startsWith(normalizedCurrent + '/');
  }

  // If no directory context, session is visible
  return true;
}

/**
 * Check if a session is a subtask (has a parent)
 * @param sessionId - The session ID to check
 * @returns boolean indicating if the session is a subtask
 */
export function isSubtask(sessionId: string): boolean {
  const { sessions } = useSessionStore.getState();
  const session = sessions.find(s => s.id === sessionId);
  
  if (!session) {
    return false;
  }

  const sessionWithParent = session as Session & { parentID?: string | null };
  return Boolean(sessionWithParent.parentID);
}
