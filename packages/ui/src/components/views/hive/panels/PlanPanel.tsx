import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useHiveStore, type HivePlanComment } from '@/stores/useHiveStore';
import { useEffectiveDirectory } from '@/hooks/useEffectiveDirectory';
import {
  RiArrowLeftLine,
  RiCheckLine,
  RiEditLine,
  RiSaveLine,
  RiChat3Line,
  RiDeleteBinLine,
  RiSendPlaneLine,
} from '@remixicon/react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui';
import { SimpleMarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { useInlineCommentDraftStore } from '@/stores/useInlineCommentDraftStore';

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

export const PlanPanel: React.FC = () => {
  const directory = useEffectiveDirectory();
  const detail = useHiveStore((s) => s.featureDetail);
  const selectedFeature = useHiveStore((s) => s.selectedFeatureName);
  const setActivePanel = useHiveStore((s) => s.setActivePanel);
  const savePlan = useHiveStore((s) => s.savePlan);
  const approvePlan = useHiveStore((s) => s.approvePlan);
  const syncTasks = useHiveStore((s) => s.syncTasks);
  const addComment = useHiveStore((s) => s.addComment);
  const deleteComment = useHiveStore((s) => s.deleteComment);
  const addDraft = useInlineCommentDraftStore((s) => s.addDraft);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showAddComment, setShowAddComment] = useState(false);
  const [newCommentLine, setNewCommentLine] = useState<number>(1);
  const [newCommentBody, setNewCommentBody] = useState('');

  const plan = detail?.plan;
  const comments = useMemo(() => detail?.comments ?? [], [detail?.comments]);
  const hasComments = comments.length > 0;

  useEffect(() => {
    if (plan) setEditContent(plan.content);
    else setEditContent('');
  }, [plan]);

  const handleSave = useCallback(async () => {
    if (!directory || !selectedFeature) return;
    await savePlan(directory, selectedFeature, editContent);
    setIsEditing(false);
    toast.success('Plan saved');
  }, [directory, selectedFeature, editContent, savePlan]);

  const handleApprove = useCallback(async () => {
    if (!directory || !selectedFeature) return;
    await approvePlan(directory, selectedFeature);
    toast.success('Plan approved');
  }, [directory, selectedFeature, approvePlan]);

  const handleSyncTasks = useCallback(async () => {
    if (!directory || !selectedFeature) return;
    await syncTasks(directory, selectedFeature);
    toast.success('Tasks synced from plan');
  }, [directory, selectedFeature, syncTasks]);

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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActivePanel('feature')}
            className="p-1 rounded hover:bg-interactive-hover text-muted-foreground"
          >
            <RiArrowLeftLine size={16} />
          </button>
          <span className="typography-ui-label">Plan</span>
          {plan?.isApproved && (
            <span className="px-1.5 py-0.5 rounded typography-micro bg-status-success-background text-status-success">
              Approved
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isEditing ? (
            <Button size="sm" onClick={handleSave}>
              <RiSaveLine size={14} className="mr-1" /> Save
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditing(true);
                  if (!plan) setEditContent('');
                }}
              >
                <RiEditLine size={14} className="mr-1" />{' '}
                {plan ? 'Edit' : 'Create'}
              </Button>
              {plan && !plan.isApproved && (
                <Button
                  size="sm"
                  onClick={handleApprove}
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {!plan && !isEditing ? (
          <div className="text-muted-foreground typography-ui">
            No plan yet. Click Create to write one.
          </div>
        ) : isEditing ? (
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-full min-h-[400px] font-mono text-sm resize-none"
            placeholder="# Feature Plan&#10;&#10;## Discovery&#10;&#10;..."
          />
        ) : (
          <div className="space-y-6">
            {/* Markdown Plan */}
            <SimpleMarkdownRenderer
              content={plan?.content ?? ''}
              className="typography-markdown-body"
            />

            {/* Comments Section */}
            <div className="border-t border-border pt-4">
              {/* Comments Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="typography-ui-label">Comments</span>
                  <span className="px-1.5 py-0.5 rounded typography-micro bg-surface-muted text-muted-foreground">
                    {comments.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {comments.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSendAllToChat}
                    >
                      <RiSendPlaneLine size={14} className="mr-1" />
                      Send All to Chat
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAddComment(!showAddComment)}
                  >
                    <RiChat3Line size={14} className="mr-1" />
                    Add Comment
                  </Button>
                </div>
              </div>

              {/* Add Comment Form */}
              {showAddComment && (
                <div className="mb-4 p-3 rounded border border-border bg-surface-muted space-y-3">
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
                      className="w-full min-h-[80px] resize-none"
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
                    <Button
                      size="sm"
                      onClick={handleAddComment}
                      disabled={!newCommentBody.trim()}
                    >
                      Submit
                    </Button>
                  </div>
                </div>
              )}

              {/* Comments List */}
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <div className="text-muted-foreground typography-ui text-sm">
                    No comments yet.
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-3 rounded border border-border bg-surface-muted"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
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
                          <p className="typography-ui text-foreground whitespace-pre-wrap">
                            {comment.body}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleSendToChat(comment)}
                            className="p-1.5 rounded hover:bg-interactive-hover text-muted-foreground hover:text-foreground"
                            title="Send to chat"
                          >
                            <RiSendPlaneLine size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="p-1.5 rounded hover:bg-interactive-hover text-muted-foreground hover:text-foreground"
                            title="Delete comment"
                          >
                            <RiDeleteBinLine size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
