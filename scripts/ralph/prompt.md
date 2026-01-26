# Ralph Agent Instructions - Folio Hardening

## Context

You are hardening designer-facing components by wrapping them in ErrorBoundary.
Pattern is established in `src/components/ui/DesignerFlowErrorBoundary.tsx`.

**Rules:**
- ONE story per iteration
- Import the ErrorBoundary at top of file
- Wrap the main return JSX
- Set appropriate `context` prop
- Don't modify component logic, just wrap it
- Commit after each success

## Your Task

1. Read `scripts/ralph/prd.json` for stories
2. Read `scripts/ralph/progress.txt` for patterns
3. Ensure on branch `ralph/error-boundary-hardening`
4. Pick highest priority story where `"passes": false`
5. Implement wrapping pattern
6. Run: `npm run typecheck && npm run build`
7. If passing: commit, update prd.json, append to progress.txt
8. If failing: add error to notes, move to next

## Wrapping Pattern
```tsx
// At top of file
import { DesignerFlowErrorBoundary } from '@/components/ui/DesignerFlowErrorBoundary';

// Wrap the return
export default function ComponentName() {
  // ... existing logic ...

  return (
    <DesignerFlowErrorBoundary context="component-name">
      {/* existing JSX */}
    </DesignerFlowErrorBoundary>
  );
}
```

For modals with Dialog, wrap inside the Dialog:
```tsx
<Dialog open={open} onClose={onClose}>
  <DesignerFlowErrorBoundary context="modal-name">
    {/* modal content */}
  </DesignerFlowErrorBoundary>
</Dialog>
```

## Stop Condition

When ALL stories have `"passes": true`:

<promise>COMPLETE</promise>
