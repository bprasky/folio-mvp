# Prisma Generate Permission Error (Windows)

## Problem
```
EPERM: operation not permitted, rename '...query_engine-windows.dll.node.tmp...'
```

This happens when the Prisma query engine DLL is locked by a running process.

## Solutions (try in order)

### 1. Stop Running Node Processes
- Stop your Next.js dev server (`npm run dev` / `next dev`)
- Close any other Node.js processes
- Check Task Manager for `node.exe` processes and end them

### 2. Close and Restart IDE
- Sometimes IDEs lock files
- Close VS Code/Cursor completely
- Try generating again

### 3. Retry
- Simply run `npx prisma generate` again - sometimes it works on retry

### 4. Kill Node Processes (if needed)
```powershell
# Find and kill all node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

### 5. Run as Administrator (last resort)
- Right-click PowerShell/Terminal
- "Run as Administrator"
- Navigate to project and run `npx prisma generate`

### 6. Manual Clean (if still failing)
```powershell
# Delete the .prisma folder and regenerate
Remove-Item -Recurse -Force node_modules\.prisma
npx prisma generate
```








