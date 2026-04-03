import { PostgresStore } from '../postgres/store.js';
import { logMessage } from '../../telemetry/api.js';

export interface SupabaseConfig {
  projectUrl: string;
  serviceKey: string;
}

export class SupabaseStore extends PostgresStore {
  private config: SupabaseConfig;

  constructor(config: SupabaseConfig) {
    const connectionString = `${config.projectUrl.replace('http', 'postgresql').replace('8000', '5432')}/postgres`;
    super(connectionString);
    this.config = config;
  }

  async init(): Promise<void> {
    await super.init();
    logMessage('info', `Supabase store initialized — ${this.config.projectUrl}`);
  }

  async createUserViaAuth(email: string, password: string) {
    const response = await fetch(`${this.config.projectUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.config.serviceKey,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(`Supabase auth error: ${response.status}`);
    }

    const data = await response.json();

    return super.createUser({
      email,
      authId: data.user?.id,
    });
  }

  subscribeToTeamActivity(teamId: string, callback: (payload: any) => void) {
    logMessage('warn', 'Realtime subscriptions not yet implemented');
    return { unsubscribe: () => {} };
  }
}
