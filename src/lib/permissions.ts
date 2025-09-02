export type UserRole = 'ADMIN'|'VENDOR'|'DESIGNER'|'HOMEOWNER'|'STUDENT'|null;

export function normalizeRole(r: any) {
  const R = String(r || '').toUpperCase();
  return ['ADMIN', 'VENDOR', 'DESIGNER', 'HOMEOWNER', 'STUDENT'].includes(R) ? R : null;
}

export function canCreateProject(role: any) {
  const R = normalizeRole(role);
  return R === 'ADMIN' || R === 'DESIGNER';
}

export function canAccessAdmin(role: any) {
  const R = normalizeRole(role);
  return R === 'ADMIN';
}

export function canAccessVendor(role: any) {
  const R = normalizeRole(role);
  return R === 'VENDOR' || R === 'ADMIN';
}

export function canAccessDesigner(role: any) {
  const R = normalizeRole(role);
  return R === 'DESIGNER' || R === 'ADMIN';
}

export function getCreateTarget(role: any): { href: string; label: string } | null {
  const R = normalizeRole(role);
  switch (R) {
    case 'ADMIN':    return { href: '/admin/create-project', label: 'Create Project' };
    case 'VENDOR':   return { href: '/vendor/create-project', label: '+ Create' };
    case 'DESIGNER': return { href: '/designer/create', label: 'Create' };
    case 'STUDENT':  return { href: '/student/create', label: 'Create' };
    case 'HOMEOWNER':return { href: '/homeowner/folders', label: 'Create Folder' };
    default:         return null;
  }
}

// Compatibility alias for existing imports
export { canCreateProject as canCreate };
