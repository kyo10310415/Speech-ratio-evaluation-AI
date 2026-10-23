export function readJwtSecret(env = process.env) {
  const secret = env.JWT_SECRET;
  if (typeof secret !== 'string' || secret.trim().length < 32 || /change-in-production|your-shared-secret/i.test(secret)) {
    throw new Error('JWT_SECRET must be a configured shared secret of at least 32 characters');
  }
  return secret;
}
