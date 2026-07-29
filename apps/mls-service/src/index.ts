/**
 * MLS ETL Service — entry point.
 *
 * The legacy multi-provider sync framework was removed (decision D1; see
 * docs/mlsgrid-implementation-plan.md). This path wires a generic RESO Web
 * API connector (MLS Grid, Trestle, Bridge Interactive, Spark API, and any
 * other RESO Web API vendor) into the streaming sync orchestrator — see
 * docs/MLS_BOARD_SETUP.md for how to configure your own board/vendor.
 *
 * mls-service is a data-tier backend worker: it reads/writes Postgres directly via
 * `db` (per the project's DB-access boundary — only consumer-facing apps must go
 * through apps/api). If MLS_AUTH_TYPE is unset, the service boots idle.
 */

import cron, { type ScheduledTask } from 'node-cron';
import logger from './utils/logger.js';
import { loadMlsConfig } from './config/mls.js';
import { ResoWebApiConnector } from './connectors/reso/ResoWebApiConnector.js';
import { runSync, type SyncConfig, type SyncConnector } from './sync/runSync.js';
import type { ResoResource } from './connectors/reso/types.js';

const tasks: ScheduledTask[] = [];

function scheduleSync(connector: SyncConnector, config: SyncConfig): void {
  const deps = { connector };

  const run = async (resource: ResoResource, fullSync: boolean): Promise<void> => {
    try {
      const stats = await runSync(resource, { fullSync }, config, deps);
      logger.info('[mls] sync result', stats);
    } catch (err) {
      logger.error('[mls] sync crashed', {
        resource,
        fullSync,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Property: incremental every 10 minutes, full reconcile nightly at 2am.
  tasks.push(cron.schedule('*/10 * * * *', () => void run('Property', false)));
  tasks.push(cron.schedule('0 2 * * *', () => void run('Property', true)));
  // Member/Office roster: slow-changing, daily at 3am (decision D8).
  tasks.push(
    cron.schedule('0 3 * * *', async () => {
      await run('Member', false);
      await run('Office', false);
    }),
  );

  logger.info('MLS sync scheduled', {
    board: config.mlsBoardId,
    schedules: { propertyIncremental: '*/10 * * * *', propertyFull: '0 2 * * *', roster: '0 3 * * *' },
  });
}

function startMlsService(): void {
  logger.info('MLS ETL Service starting...');

  let settings;
  try {
    settings = loadMlsConfig();
  } catch (err) {
    logger.error('MLS configuration error — service cannot start', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
  if (!settings) {
    logger.warn('MLS_AUTH_TYPE not set — MLS sync disabled; service idle');
    return;
  }

  const connector = new ResoWebApiConnector(settings.connector, { logger });
  scheduleSync(connector, settings.sync);

  logger.info('MLS ETL Service started', { nodeVersion: process.version, pid: process.pid });
}

function shutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down...`);
  for (const task of tasks) task.stop();
  // In-flight runs are idempotent and resume via the watermark / dead-letter.
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Rejection', { reason });
  process.exit(1);
});

startMlsService();
