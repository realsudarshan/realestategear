declare global {
  const expect: any;

  interface Error {
    status?: number;
    details?: unknown;
    body?: unknown;
    data?: unknown;
  }

  interface Body {
    json(): Promise<any>;
  }

  interface Response {
    json(): Promise<any>;
  }
}

export {};
