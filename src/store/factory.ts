import type { NautalisConfig } from '../types/config.js';
import type { Store } from './interface.js';
import { PostgresStore } from './postgres/store.js';
import { SupabaseStore } from './supabase/store.js';

let storeInstance: Store | null = null;

export async function getStore(config: NautalisConfig): Promise<Store> {
  if (!storeInstance) {
    storeInstance = await initStore(config);
  }
  return storeInstance;
}

export async function initStore(config: NautalisConfig): Promise<Store> {
  const driver = config.database.driver;

  switch (driver) {
    case 'postgres':
      return new PostgresStore(config.database.postgres!.url);
    case 'supabase':
      return new SupabaseStore(config.database.supabase!);
    default:
      throw new Error(`Unknown database driver: ${driver}. Supported: postgres, supabase`);
  }
}

export async function closeStore(): Promise<void> {
  if (storeInstance) {
    await storeInstance.close();
    storeInstance = null;
  }
}
