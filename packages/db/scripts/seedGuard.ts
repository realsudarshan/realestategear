const OPT_IN_ENV_VAR = 'CONFIRM_DEMO_SEED';

export function getDatabaseTarget(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required before running a demo seed.');
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid URL before running a demo seed.');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!url.host || !database) {
    throw new Error('DATABASE_URL must identify a database host and name.');
  }

  const schema = url.searchParams.get('schema');
  return `${url.host}/${database}${schema ? `?schema=${schema}` : ''}`;
}

export function requireDemoSeedOptIn(env: NodeJS.ProcessEnv = process.env): string {
  if (env.NODE_ENV?.toLowerCase() === 'production') {
    throw new Error('Demo and destructive seed scripts are disabled in production.');
  }

  const target = getDatabaseTarget(env.DATABASE_URL);
  if (env[OPT_IN_ENV_VAR] !== target) {
    throw new Error(
      `Refusing to seed ${target}. Set ${OPT_IN_ENV_VAR}=${target} to confirm this exact database.`,
    );
  }

  return target;
}
