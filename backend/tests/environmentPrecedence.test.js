'use strict';

// environment.ts ends with `module.exports = env`; helpers that must remain
// reachable from require() are re-attached onto env before export.
const env = require('../src/config/environment');
const { applyRuntimeEnvPrecedence } = env;

describe('applyRuntimeEnvPrecedence', () => {
  it('preserves real runtime env values over dotenv-loaded values', () => {
    const runtimeEnv = {
      ALLOWED_ORIGINS: 'http://192.168.1.201:7076,http://localhost:7076',
      CLIENT_ORIGINS: 'http://192.168.1.201:7076,http://localhost:7076',
      PORT: '7076',
    };

    const loadedEnv = {
      ALLOWED_ORIGINS: 'http://localhost:7076',
      CLIENT_ORIGINS: 'http://localhost:7076',
      PORT: '7177',
      SESSION_SECRET: 'from-env-local',
    };

    const merged = applyRuntimeEnvPrecedence(runtimeEnv, loadedEnv);

    expect(merged.ALLOWED_ORIGINS).toBe(runtimeEnv.ALLOWED_ORIGINS);
    expect(merged.CLIENT_ORIGINS).toBe(runtimeEnv.CLIENT_ORIGINS);
    expect(merged.PORT).toBe(runtimeEnv.PORT);
    expect(merged.SESSION_SECRET).toBe('from-env-local');
  });

  it('leaves dotenv-loaded values intact when the runtime env did not provide them', () => {
    const runtimeEnv = {
      ALLOWED_ORIGINS: 'http://192.168.1.201:7076',
      CLIENT_ORIGINS: undefined,
    };

    const loadedEnv = {
      ALLOWED_ORIGINS: 'http://localhost:7076',
      CLIENT_ORIGINS: 'http://localhost:7076',
      ENABLE_DEV_LOGIN: 'true',
    };

    const merged = applyRuntimeEnvPrecedence(runtimeEnv, loadedEnv);

    expect(merged.ALLOWED_ORIGINS).toBe('http://192.168.1.201:7076');
    expect(merged.CLIENT_ORIGINS).toBe('http://localhost:7076');
    expect(merged.ENABLE_DEV_LOGIN).toBe('true');
  });
});
