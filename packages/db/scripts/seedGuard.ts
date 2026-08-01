const OPT_IN_ENV_VAR = 'CONFIRM_DEMO_SEED';

export function getDatabaseTarget(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required before running a demo seed.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid URL before running a demo seed.');
  }

  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
  if (!parsedUrl.host || !databaseName) {
    throw new Error('DATABASE_URL must identify a database host and name.');
  }

  const schema = parsedUrl.searchParams.get('schema');
  return `${parsedUrl.host}/${databaseName}${schema ? `?schema=${schema}` : ''}`;
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
