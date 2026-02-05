# OpenChamber UI Architecture

## Tab System
- State-driven via Zustand: MainTab = 'chat' | 'plan' | 'git' | 'diff' | 'terminal' | 'files'
- Header.tsx renders TabConfig[] → setActiveMainTab()
- MainLayout.tsx: switch(activeMainTab) → render view
- ChatView always mounted (CSS hidden), others mount/unmount

## View Patterns: Simple delegator, Self-contained, Sidebar+Content, Composite

## State: Zustand stores in packages/ui/src/stores/
## API: SDK client + HTTP /api/* + RuntimeAPIs abstraction
## Components: Radix UI + custom (packages/ui/src/components/ui/)
## Theme: CSS variables → semantic Tailwind classes
