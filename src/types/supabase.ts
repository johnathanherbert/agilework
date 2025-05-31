// typescript definitions for Supabase Realtime payloads
export type RealtimePostgresChangesPayload<T> = {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T;
  errors: any;
};

// Re-export types for easier imports
export * from './index';
