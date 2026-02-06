import React from 'react';
import {
  RiGitMergeLine,
  RiGitBranchLine,
  RiArrowDownSLine,
  RiLoader4Line,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface BranchIntegrationSectionProps {
  currentBranch: string | null | undefined;
  localBranches: string[];
  remoteBranches: string[];
  onMerge: (branch: string) => void;
  onRebase: (branch: string) => void;
  disabled?: boolean;
  isOperating?: boolean;
}

export const BranchIntegrationSection: React.FC<BranchIntegrationSectionProps> = ({
  currentBranch,
  localBranches,
  remoteBranches,
  onMerge,
  onRebase,
  disabled = false,
  isOperating = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [selectedBranch, setSelectedBranch] = React.useState<string | null>(null);

  const filteredLocal = React.useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return localBranches;
    return localBranches.filter((b) => b.toLowerCase().includes(term));
  }, [search, localBranches]);

  const filteredRemote = React.useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return remoteBranches;
    return remoteBranches.filter((b) => b.toLowerCase().includes(term));
  }, [search, remoteBranches]);

  const handleSelectBranch = (branch: string) => {
    if (branch === currentBranch) {
      setIsOpen(false);
      return;
    }
    setSelectedBranch(branch);
    setIsOpen(false);
    setSearch('');
  };

  const handleMerge = () => {
    if (!selectedBranch) return;
    onMerge(selectedBranch);
  };

  const handleRebase = () => {
    if (!selectedBranch) return;
    onRebase(selectedBranch);
  };

  React.useEffect(() => {
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  const isDisabled = disabled || isOperating;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip delayDuration={1000}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 px-2 py-1 h-8"
                disabled={isDisabled}
              >
                <RiGitBranchLine className="size-4" />
                <span className="max-w-[140px] truncate">
                  {selectedBranch || 'Select branch'}
                </span>
                <RiArrowDownSLine className="size-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent sideOffset={8}>
            Select branch to merge or rebase onto
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="start" className="w-72 p-0 max-h-[60vh] flex flex-col">
          <Command className="h-full min-h-0">
            <CommandInput
              placeholder="Search branches..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList
              scrollbarClassName="overlay-scrollbar--flush overlay-scrollbar--dense overlay-scrollbar--zero"
              disableHorizontal
            >
              <CommandEmpty>No branches found.</CommandEmpty>

              <CommandGroup heading="Local branches">
                {filteredLocal.map((branch) => (
                  <CommandItem
                    key={`local-${branch}`}
                    onSelect={() => handleSelectBranch(branch)}
                  >
                    <span className="typography-ui-label text-foreground">
                      {branch}
                    </span>
                    {currentBranch === branch && (
                      <span className="typography-micro text-primary ml-auto">Current</span>
                    )}
                  </CommandItem>
                ))}
                {filteredLocal.length === 0 && (
                  <CommandItem disabled className="justify-center">
                    <span className="typography-meta text-muted-foreground">
                      No local branches
                    </span>
                  </CommandItem>
                )}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Remote branches">
                {filteredRemote.map((branch) => (
                  <CommandItem
                    key={`remote-${branch}`}
                    onSelect={() => handleSelectBranch(branch)}
                  >
                    <span className="typography-ui-label text-foreground">{branch}</span>
                  </CommandItem>
                ))}
                {filteredRemote.length === 0 && (
                  <CommandItem disabled className="justify-center">
                    <span className="typography-meta text-muted-foreground">
                      No remote branches
                    </span>
                  </CommandItem>
                )}
              </CommandGroup>

            </CommandList>
          </Command>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip delayDuration={1000}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={handleMerge}
            disabled={isDisabled || !selectedBranch}
          >
            {isOperating ? (
              <RiLoader4Line className="size-4 animate-spin" />
            ) : (
              <RiGitMergeLine className="size-4" />
            )}
            <span className="hidden sm:inline">Merge</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent sideOffset={8}>
          Merge selected branch into {currentBranch || 'current branch'}
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={1000}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={handleRebase}
            disabled={isDisabled || !selectedBranch}
          >
            {isOperating ? (
              <RiLoader4Line className="size-4 animate-spin" />
            ) : (
              <RiGitBranchLine className="size-4" />
            )}
            <span className="hidden sm:inline">Rebase</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent sideOffset={8}>
          Rebase {currentBranch || 'current branch'} onto selected branch
        </TooltipContent>
      </Tooltip>
    </div>
  );
};
