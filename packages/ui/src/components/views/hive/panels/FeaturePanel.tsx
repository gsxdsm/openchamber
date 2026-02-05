import React, { useState, useCallback, useMemo } from 'react';
import { useHiveStore, type HivePlanComment } from '@/stores/useHiveStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useUIStore } from '@/stores/useUIStore';
import { useEffectiveDirectory } from '@/hooks/useEffectiveDirectory';
import { StatusBadge } from '../sidebar/StatusBadge';
import {
  RiFileTextLine,
  RiListCheck2,
  RiArticleLine,
  RiLinkM,
  RiChat3Line,
  RiDeleteBinLine,
  RiSendPlaneLine,
  RiCheckLine,
  RiEditLine,
  RiSaveLine,
  RiArrowRightSLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui';
import { SimpleMarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { useInlineCommentDraftStore } from '@/stores/useInlineCommentDraftStore';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const formatTimestamp = (ts: string) => {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const FeaturePanel: React.FC = () => {
  const directory = useEffectiveDirectory();
  const detail = useHiveStore((s) => s.featureDetail);
  const selectedFeature = useHiveStore((s) => s.selectedFeatureName);
  const setActivePanel = useHiveStore((s) => s.setActivePanel);
  const fetchFeatureDetail = useHiveStore((s) => s.fetchFeatureDetail);
  const linkSession = useHiveStore((s) => s.linkSession);
  const savePlan = useHiveStore((s) => s.savePlan);
  const approvePlan = useHiveStore((s) => s.approvePlan);
  const syncTasks = useHiveStore((s) => s.syncTasks);
  const addComment = useHiveStore((s) => s.addComment);
  const deleteComment = useHiveStore((s) => s.deleteComment);
  const isLoading = useHiveStore((s) => s.isLoadingDetail);
  const addDraft = useInlineCommentDraftStore((s) => s.addDraft);

  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const setCurrentSession = useSessionStore((state) => state.setCurrentSession);
  const setActiveMainTab = useUIStore((state) => state.setActiveMainTab);

  // Plan editing state
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [editContent, setEditContent] = useState('');

  // Comment state
  const [showAddComment, setShowAddComment] = useState(false);
  const [newCommentLine, setNewCommentLine] = useState<number>(1);
  const [newCommentBody, setNewCommentBody] = useState('');

  React.useEffect(() => {
    if (directory && selectedFeature) {
      fetchFeatureDetail(directory, selectedFeature);
    }
  }, [directory, selectedFeature, fetchFeatureDetail]);

  const plan = detail?.plan;
  const comments = useMemo(() => detail?.comments ?? [], [detail?.comments]);
  const hasComments = comments.length > 0;

  // Plan actions
  const handleSavePlan = useCallback(async () => {
    if (!directory || !selectedFeature) return;
    await savePlan(directory, selectedFeature, editContent);
    setIsEditingPlan(false);
    toast.success('Plan saved');
  }, [directory, selectedFeature, editContent, savePlan]);

  const handleApprovePlan = useCallback(async () => {
    if (!directory || !selectedFeature) return;
    await approvePlan(directory, selectedFeature);
    toast.success('Plan approved');
  }, [directory, selectedFeature, approvePlan]);

  const handleSyncTasks = useCallback(async () => {
    if (!directory || !selectedFeature) return;
    await syncTasks(directory, selectedFeature);
    toast.success('Tasks synced from plan');
  }, [directory, selectedFeature, syncTasks]);

  // Comment actions
  const handleAddComment = useCallback(async () => {
    if (!directory || !selectedFeature || !newCommentBody.trim()) return;
    await addComment(directory, selectedFeature, newCommentLine, newCommentBody.trim());
    setNewCommentBody('');
    setShowAddComment(false);
    toast.success('Comment added');
  }, [directory, selectedFeature, newCommentLine, newCommentBody, addComment]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!directory || !selectedFeature) return;
    await deleteComment(directory, selectedFeature, commentId);
    toast.success('Comment deleted');
  }, [directory, selectedFeature, deleteComment]);

  const handleSendToChat = useCallback((comment: HivePlanComment) => {
    const lines = (plan?.content ?? '').split('\n');
    const contextLine = lines[comment.line - 1] || '';
    addDraft({
      sessionKey: 'draft',
      source: 'plan',
      fileLabel: `plan (${selectedFeature})`,
      startLine: comment.line,
      endLine: comment.line,
      code: contextLine,
      language: 'markdown',
      text: comment.body,
    });
    toast.success('Comment added to chat draft');
  }, [plan?.content, selectedFeature, addDraft]);

  const handleSendAllToChat = useCallback(() => {
    const lines = (plan?.content ?? '').split('\n');
    comments.forEach((comment) => {
      const contextLine = lines[comment.line - 1] || '';
      addDraft({
        sessionKey: 'draft',
        source: 'plan',
        fileLabel: `plan (${selectedFeature})`,
        startLine: comment.line,
        endLine: comment.line,
        code: contextLine,
        language: 'markdown',
        text: comment.body,
      });
    });
    toast.success('All comments added to chat draft');
  }, [plan?.content, selectedFeature, comments, addDraft]);

  if (!selectedFeature) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground typography-ui">
        Select a feature from the sidebar
      </div>
    );
  }

  if (isLoading || !detail) {
    return (
      <div className="p-4 text-muted-foreground typography-ui">Loading...</div>
    );
  }

  const { feature, tasks, contextFiles, sessions } = detail;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;

  const handleLinkSession = async () => {
    if (!directory || !selectedFeature || !currentSessionId) return;
    await linkSession(directory, selectedFeature, currentSessionId);
    toast.success('Session linked to feature');
    await fetchFeatureDetail(directory, selectedFeature);
  };

  const handleSessionClick = (sessionId: string) => {
    setCurrentSession(sessionId);
    setActiveMainTab('chat');
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="typography-ui-header text-foreground">{feature.name}</h2>
        <StatusBadge status={feature.status} />
        {feature.ticket && (
          <span className="typography-micro text-muted-foreground">
            {feature.ticket}
          </span>
        )}
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setActivePanel('tasks')}
          className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-interactive-hover text-left"
        >
          <RiListCheck2 size={20} className="text-muted-foreground shrink-0" />
          <div>
            <div className="typography-ui">Tasks</div>
            <div className="typography-micro text-muted-foreground">
              {doneTasks}/{tasks.length} completed
            </div>
          </div>
        </button>

        <button
          onClick={() => setActivePanel('context')}
          className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-interactive-hover text-left"
        >
          <RiArticleLine size={20} className="text-muted-foreground shrink-0" />
          <div>
            <div className="typography-ui">Context</div>
            <div className="typography-micro text-muted-foreground">
              {contextFiles.length} file(s)
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 p-3 rounded-lg border border-border text-left">
          <RiLinkM size={20} className="text-muted-foreground shrink-0" />
          <div>
            <div className="typography-ui">Sessions</div>
            <div className="typography-micro text-muted-foreground">
              {sessions.length} linked
            </div>
          </div>
        </div>
      </div>

      {/* Plan Preview — inline markdown + comments */}
      <div className="border border-border rounded-lg">
        {/* Plan header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <RiFileTextLine size={16} className="text-muted-foreground" />
            <span className="typography-ui-label">Plan</span>
            {plan?.isApproved && (
              <span className="px-1.5 py-0.5 rounded typography-micro bg-status-success-background text-status-success">
                Approved
              </span>
            )}
            {plan && !plan.isApproved && (
              <span className="px-1.5 py-0.5 rounded typography-micro bg-surface-muted text-muted-foreground">
                Draft
              </span>
            )}
            {hasComments && (
              <span className="px-1.5 py-0.5 rounded typography-micro bg-status-warning-background text-status-warning">
                {comments.length} comment{comments.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isEditingPlan ? (
              <Button size="sm" onClick={handleSavePlan}>
                <RiSaveLine size={14} className="mr-1" /> Save
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsEditingPlan(true);
                    setEditContent(plan?.content ?? '');
                  }}
                >
                  <RiEditLine size={14} className="mr-1" />{' '}
                  {plan ? 'Edit' : 'Create'}
                </Button>
                {plan && !plan.isApproved && (
                  <Button
                    size="sm"
                    onClick={handleApprovePlan}
                    disabled={hasComments}
                    title={hasComments ? 'Resolve all comments before approving' : undefined}
                  >
                    <RiCheckLine size={14} className="mr-1" /> Approve
                  </Button>
                )}
                {plan?.isApproved && (
                  <Button size="sm" variant="outline" onClick={handleSyncTasks}>
                    Sync Tasks
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Plan content */}
        <div className="p-4">
          {!plan && !isEditingPlan ? (
            <div className="text-muted-foreground typography-ui">
              No plan yet. Click Create to write one.
            </div>
          ) : isEditingPlan ? (
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[300px] font-mono text-sm resize-none"
              placeholder="# Feature Plan&#10;&#10;## Discovery&#10;&#10;..."
            />
          ) : (
            <SimpleMarkdownRenderer
              content={plan?.content ?? ''}
              className="typography-markdown-body"
            />
          )}
        </div>

        {/* Comments section (only when not editing and plan exists) */}
        {plan && !isEditingPlan && (
          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="typography-micro text-muted-foreground font-medium">
                  Comments ({comments.length})
                </span>
              </div>
              <div className="flex items-center gap-1">
                {comments.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={handleSendAllToChat}>
                    <RiSendPlaneLine size={14} className="mr-1" /> Send All to Chat
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAddComment(!showAddComment)}
                >
                  <RiChat3Line size={14} className="mr-1" /> Add
                </Button>
              </div>
            </div>

            {/* Add comment form */}
            {showAddComment && (
              <div className="mb-3 p-3 rounded border border-border bg-surface-muted space-y-2">
                <div>
                  <label className="typography-micro text-muted-foreground block mb-1">
                    Line Number
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newCommentLine}
                    onChange={(e) => setNewCommentLine(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 px-2 py-1 rounded border border-border bg-background text-foreground typography-ui"
                  />
                </div>
                <div>
                  <label className="typography-micro text-muted-foreground block mb-1">
                    Comment
                  </label>
                  <Textarea
                    value={newCommentBody}
                    onChange={(e) => setNewCommentBody(e.target.value)}
                    placeholder="Write your comment..."
                    className="w-full min-h-[60px] resize-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAddComment(false);
                      setNewCommentBody('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAddComment} disabled={!newCommentBody.trim()}>
                    Submit
                  </Button>
                </div>
              </div>
            )}

            {/* Comments list */}
            {comments.length > 0 && (
              <div className="space-y-2">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-2 rounded border border-border bg-surface-muted"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="typography-micro font-medium text-foreground">
                            {comment.author}
                          </span>
                          <span className="typography-micro text-muted-foreground">
                            {formatTimestamp(comment.timestamp)}
                          </span>
                          <span className="px-1 py-0.5 rounded typography-micro bg-interactive-hover text-muted-foreground">
                            L{comment.line}
                          </span>
                        </div>
                        <p className="typography-ui text-foreground whitespace-pre-wrap text-sm">
                          {comment.body}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => handleSendToChat(comment)}
                          className="p-1 rounded hover:bg-interactive-hover text-muted-foreground hover:text-foreground"
                          title="Send to chat"
                        >
                          <RiSendPlaneLine size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="p-1 rounded hover:bg-interactive-hover text-muted-foreground hover:text-foreground"
                          title="Delete comment"
                        >
                          <RiDeleteBinLine size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sessions section — collapsible */}
      <Collapsible defaultOpen={sessions.length > 0}>
        <CollapsibleTrigger className="flex items-center gap-1 w-full text-left typography-ui-label text-muted-foreground hover:text-foreground">
          <RiArrowRightSLine
            size={14}
            className="shrink-0 transition-transform [[data-state=open]>&]:rotate-90"
          />
          Linked Sessions ({sessions.length})
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="flex items-center justify-end mb-2">
            {currentSessionId && (
              <Button size="sm" variant="outline" onClick={handleLinkSession}>
                <RiLinkM size={14} className="mr-1" /> Link Current Session
              </Button>
            )}
          </div>
          {sessions.length > 0 ? (
            <div className="space-y-1">
              {sessions.map((s) => (
                <button
                  key={s.sessionId}
                  onClick={() => handleSessionClick(s.sessionId)}
                  className="flex items-center justify-between w-full px-2 py-1.5 rounded bg-surface-muted typography-micro hover:bg-interactive-hover text-left"
                >
                  <span className="truncate font-mono">{s.sessionId}</span>
                  {s.taskFolder && (
                    <span className="text-muted-foreground ml-2 shrink-0">
                      {s.taskFolder}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="typography-micro text-muted-foreground">
              No sessions linked yet.
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Timestamps */}
      <div className="typography-micro text-muted-foreground space-y-0.5 pt-2 border-t border-border">
        <div>Created: {new Date(feature.createdAt).toLocaleString()}</div>
        {feature.approvedAt && (
          <div>Approved: {new Date(feature.approvedAt).toLocaleString()}</div>
        )}
        {feature.completedAt && (
          <div>Completed: {new Date(feature.completedAt).toLocaleString()}</div>
        )}
      </div>
    </div>
  );
};
