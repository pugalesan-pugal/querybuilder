export interface BasicResponse {
  patterns: RegExp[];
  response: string;
}

export interface CacheEntry {
  response: string;
  timestamp: number;
}

export interface QueuedRequest {
  execute: () => Promise<any>;
  retryCount: number;
  lastErrorTime?: number;
} 