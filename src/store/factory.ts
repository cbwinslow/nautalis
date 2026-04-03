import type { NautalisConfig } from '../types/config.js';
import type { Store } from './interface.js';
import { SqliteStore } from './sqlite/store.js';

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
    case 'sqlite':
      return new SqliteStore(config.database.sqlite!.path);
    case 'postgres':
      // TODO: Implement PostgresStore
      throw new Error('PostgreSQL store not yet implemented');
    case 'supabase':
      // TODO: Implement SupabaseStore
      throw new Error('Supabase store not yet implemented');
    default:
      throw new Error(`Unknown database driver: ${driver}`);
  }
}

export async function closeStore(): Promise<void> {
  if (storeInstance) {
    await storeInstance.close();
    storeInstance = null;
  }
}
