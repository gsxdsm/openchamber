import React, { useState, useCallback, useEffect } from 'react';
import { useHiveStore } from '@/stores/useHiveStore';
import { useEffectiveDirectory } from '@/hooks/useEffectiveDirectory';
import {
  RiArrowLeftLine,
  RiAddLine,
  RiEditLine,
  RiSaveLine,
  RiDeleteBinLine,
} from '@remixicon/react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui';

export const ContextPanel: React.FC = () => {
  const directory = useEffectiveDirectory();
  const detail = useHiveStore((s) => s.featureDetail);
  const selectedFeature = useHiveStore((s) => s.selectedFeatureName);
  const selectedContext = useHiveStore((s) => s.selectedContextName);
  const contextContent = useHiveStore((s) => s.contextContent);
  const activePanel = useHiveStore((s) => s.activePanel);
  const setActivePanel = useHiveStore((s) => s.setActivePanel);
  const selectContext = useHiveStore((s) => s.selectContext);
  const fetchContextContent = useHiveStore((s) => s.fetchContextContent);
  const writeContext = useHiveStore((s) => s.writeContext);
  const deleteContext = useHiveStore((s) => s.deleteContext);
  const fetchFeatureDetail = useHiveStore((s) => s.fetchFeatureDetail);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const files = detail?.contextFiles || [];

  useEffect(() => {
    if (directory && selectedFeature && selectedContext) {
      fetchContextContent(directory, selectedFeature, selectedContext);
    }
  }, [directory, selectedFeature, selectedContext, fetchContextContent]);

  useEffect(() => {
    if (contextContent !== null) setEditContent(contextContent);
  }, [contextContent]);

  const handleFileClick = (name: string) => {
    selectContext(name);
    setActivePanel('context-detail');
    setIsEditing(false);
  };

  const handleSave = useCallback(async () => {
    if (!directory || !selectedFeature || !selectedContext) return;
    await writeContext(directory, selectedFeature, selectedContext, editContent);
    setIsEditing(false);
    toast.success('Context file saved');
  }, [directory, selectedFeature, selectedContext, editContent, writeContext]);

  const handleCreateNew = useCallback(async () => {
    if (!directory || !selectedFeature || !newFileName.trim()) return;
    const name = newFileName.trim().endsWith('.md')
      ? newFileName.trim()
      : newFileName.trim() + '.md';
    await writeContext(
      directory,
      selectedFeature,
      name,
      '# ' + newFileName.trim().replace(/\.md$/, '')
    );
    setNewFileName('');
    setShowCreate(false);
    await fetchFeatureDetail(directory, selectedFeature);
    selectContext(name);
    setActivePanel('context-detail');
    toast.success('Context file created');
  }, [
    directory,
    selectedFeature,
    newFileName,
    writeContext,
    fetchFeatureDetail,
    selectContext,
    setActivePanel,
  ]);

  const handleDelete = useCallback(async () => {
    if (!directory || !selectedFeature || !selectedContext) return;
    await deleteContext(directory, selectedFeature, selectedContext);
    selectContext(null);
    setActivePanel('context');
    await fetchFeatureDetail(directory, selectedFeature);
    toast.success('Context file deleted');
  }, [
    directory,
    selectedFeature,
    selectedContext,
    deleteContext,
    selectContext,
    setActivePanel,
    fetchFeatureDetail,
  ]);

  // Detail view
  if (activePanel === 'context-detail' && selectedContext) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActivePanel('context');
                selectContext(null);
              }}
              className="p-1 rounded hover:bg-interactive-hover text-muted-foreground"
            >
              <RiArrowLeftLine size={16} />
            </button>
            <span className="typography-ui-label truncate">
              {selectedContext}
            </span>
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
                  onClick={() => setIsEditing(true)}
                >
                  <RiEditLine size={14} className="mr-1" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDelete}
                  className="text-status-error hover:text-status-error"
                >
                  <RiDeleteBinLine size={14} />
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {isEditing ? (
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-full min-h-[300px] font-mono text-sm resize-none"
            />
          ) : (
            <pre className="whitespace-pre-wrap typography-ui font-mono text-sm leading-relaxed text-foreground">
              {contextContent || 'Empty file'}
            </pre>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActivePanel('feature')}
            className="p-1 rounded hover:bg-interactive-hover text-muted-foreground"
          >
            <RiArrowLeftLine size={16} />
          </button>
          <span className="typography-ui-label">
            Context Files ({files.length})
          </span>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="p-1 rounded hover:bg-interactive-hover text-muted-foreground"
        >
          <RiAddLine size={16} />
        </button>
      </div>

      {showCreate && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <Input
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="filename"
            className="flex-1"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreateNew()}
          />
          <Button
            size="sm"
            onClick={handleCreateNew}
            disabled={!newFileName.trim()}
          >
            Create
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {files.length === 0 ? (
          <div className="p-4 text-muted-foreground typography-ui">
            No context files yet.
          </div>
        ) : (
          files.map((f) => (
            <button
              key={f.name}
              onClick={() => handleFileClick(f.name)}
              className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-interactive-hover border-b border-border text-left"
            >
              <span className="typography-ui">{f.name}</span>
              <span className="typography-micro text-muted-foreground">
                {new Date(f.updatedAt).toLocaleDateString()}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
