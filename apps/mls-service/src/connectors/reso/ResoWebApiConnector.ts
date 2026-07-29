import axios, { type AxiosInstance } from 'axios';
import type {
  FetchOptions,
  HttpClient,
  Logger,
  ODataResponse,
  ResoConnectorConfig,
  ResoResource,
} from './types.js';

const DEFAULT_PAGE_SIZE = 5000;
const noopLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Narrow an unknown error to its HTTP status, if any. */
function httpStatus(err: unknown): number | undefined {
  const resp = (err as { response?: { status?: number } } | undefined)?.response;
  return resp?.status;
}

/**
 * RESO Web API (OData v4) connector — the NAR-mandated standard implemented
 * by MLS Grid, Trestle, Bridge Interactive, Spark API, and others. Not
 * specific to any one vendor: auth (static bearer vs. OAuth2 client-
 * credentials), base URL, board-scope filter, and viewable-flag field are all
 * injected as config. OData query building, `@odata.nextLink` pagination
 * streamed page-by-page (D3/D15), exponential-backoff retry, and a request
 * throttle are the parts that are genuinely standard across vendors.
 */
export class ResoWebApiConnector {
  private readonly http: HttpClient;
  private readonly logger: Logger;
  private readonly authStrategy: ResoConnectorConfig['authStrategy'];
  private readonly boardScopeField?: string;
  private readonly boardScopeValue?: string;
  private readonly viewableFlagField?: string;
  private readonly pageSize: number;
  private readonly minRequestIntervalMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private lastRequestAt = 0;

  constructor(config: ResoConnectorConfig, deps: { httpClient?: HttpClient; logger?: Logger } = {}) {
    this.authStrategy = config.authStrategy;
    this.boardScopeField = config.boardScopeField;
    this.boardScopeValue = config.boardScopeValue;
    this.viewableFlagField = config.viewableFlagField;
    this.pageSize = config.pageSize ?? DEFAULT_PAGE_SIZE;
    this.minRequestIntervalMs = config.minRequestIntervalMs ?? 0;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? 1000;
    this.logger = deps.logger ?? noopLogger;
    this.http = deps.httpClient ?? this.defaultClient(config);
  }

  private defaultClient(config: ResoConnectorConfig): HttpClient {
    const instance: AxiosInstance = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs ?? 30000,
      headers: {
        Accept: 'application/json',
        // Harmless/beneficial against any HTTP API; MLS Grid specifically
        // hard-rejects requests without it (HTTP 400 "COMPRESSION REQUIRED").
        // axios auto-decompresses the response.
        'Accept-Encoding': 'gzip',
      },
    });
    return {
      get: <T,>(url: string, headers?: Record<string, string>) =>
        instance.get<T>(url, { headers }).then((r) => ({ data: r.data, status: r.status })),
    };
  }

  /**
   * The `$filter` value for a resource query. Board-scoped only when both
   * `boardScopeField` and `boardScopeValue` are configured — omitted entirely
   * when a vendor's credential implies the board scope on its own (common for
   * a single-board Trestle/Bridge/Spark license). Adds the incremental
   * watermark when `since` is set, and the viewable-flag clause ONLY for full
   * imports (`requireViewable`) — incremental must see the flag flip to
   * detect removals (D5) — and only when `viewableFlagField` is configured.
   */
  buildFilter(_resource: ResoResource, opts: FetchOptions = {}): string {
    const parts: string[] = [];
    if (this.boardScopeField && this.boardScopeValue) {
      parts.push(`${this.boardScopeField} eq '${this.boardScopeValue}'`);
    }
    if (opts.requireViewable && this.viewableFlagField) {
      parts.push(`${this.viewableFlagField} eq true`);
    }
    if (opts.since) parts.push(`ModificationTimestamp gt ${opts.since.toISOString()}`);
    return parts.join(' and ');
  }

  /** Initial request path. `$orderby=ModificationTimestamp` keeps paging stable so
   *  page boundaries don't shift mid-sync (Codex #7); nextLink carries it forward.
   *  Omits `$filter=` entirely when there's nothing to filter on (e.g. a vendor
   *  with no board-scope field and no viewable flag, on a full sync with no
   *  watermark) — an empty `$filter=` param is invalid OData. */
  buildPath(resource: ResoResource, opts: FetchOptions = {}): string {
    const filter = this.buildFilter(resource, opts);
    const query = [`$top=${this.pageSize}`, '$orderby=ModificationTimestamp'];
    if (filter) query.unshift(`$filter=${encodeURIComponent(filter)}`);
    if (opts.expandMedia) query.push('$expand=Media');
    return `/${resource}?${query.join('&')}`;
  }

  /**
   * Stream a resource's records page-by-page. Yields one page (array) at a time
   * by following `@odata.nextLink` until it is absent — bounded memory regardless
   * of board size (D15). The caller advances its watermark from the records it
   * receives (D4); this connector does not track cursors.
   */
  async *fetchResource<T>(resource: ResoResource, opts: FetchOptions = {}): AsyncGenerator<T[]> {
    let url: string | null = this.buildPath(resource, opts);
    let page = 0;
    while (url) {
      const { data } = await this.executeWithRetry(() => this.throttledGet<ODataResponse<T>>(url as string));
      const records = data.value ?? [];
      page += 1;
      this.logger.info(`[reso] ${resource}: page ${page}, ${records.length} records`);
      yield records;
      url = data['@odata.nextLink'] ?? null;
    }
  }

  private async throttledGet<T>(url: string): Promise<{ data: T; status: number }> {
    if (this.minRequestIntervalMs > 0) {
      const wait = this.minRequestIntervalMs - (Date.now() - this.lastRequestAt);
      if (wait > 0) await delay(wait);
      this.lastRequestAt = Date.now();
    }
    // Computed fresh on every request (not baked into the client at
    // construction) so a refreshing OAuth2 token is always current.
    const headers = await this.authStrategy.getAuthHeaders();
    return this.http.get<T>(url, headers);
  }

  /** Exponential backoff. Retries network/5xx errors; never retries 4xx (D2). */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err;
        const status = httpStatus(err);
        if (status !== undefined && status >= 400 && status < 500) throw err;
        if (attempt < this.maxRetries) {
          const backoff = this.retryBaseDelayMs * 2 ** (attempt - 1);
          this.logger.warn(`[reso] request failed (attempt ${attempt}/${this.maxRetries}), retrying in ${backoff}ms`, {
            status,
          });
          await delay(backoff);
        }
      }
    }
    throw lastError;
  }
}
