export interface GatewayConfig {
  port: number;
  appSecret: string;
  verifyToken: string;
  whatsappToken: string;
  phoneNumberId: string;
  redisUrl: string;
  internalToken: string;
  queueName: string;
  databaseUrl: string;
  sessionSecret: string;
  migrationsDir: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export function loadConfig(): GatewayConfig {
  return {
    port: Number(process.env.PORT ?? 3000),
    appSecret: required("WHATSAPP_APP_SECRET"),
    verifyToken: required("WHATSAPP_VERIFY_TOKEN"),
    whatsappToken: required("WHATSAPP_TOKEN"),
    phoneNumberId: required("WHATSAPP_PHONE_NUMBER_ID"),
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    internalToken: required("INTERNAL_TOKEN"),
    queueName: process.env.QUEUE_NAME ?? "recipe:jobs",
    databaseUrl: required("DATABASE_URL"),
    sessionSecret: required("SESSION_SECRET"),
    migrationsDir: process.env.MIGRATIONS_DIR ?? "migrations",
  };
}
