export interface AuthStrategy {
  getAuthHeaders(): Promise<Record<string, string>>;
}
