import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId?: string;
  isSuperAdmin?: boolean;
  userId?: string;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return tenantContext.getStore();
}

export function setTenantContext(context: TenantContext): void {
  const store = tenantContext.getStore();
  if (store) {
    Object.assign(store, context);
  }
}

export async function runWithTenantContext<T>(
  context: TenantContext,
  callback: () => Promise<T>,
): Promise<T> {
  return tenantContext.run(context, callback);
}
