import { loadAppConfig } from './app-config';

describe('loadAppConfig', () => {
  it('resolves configured paths from the project root', () => {
    const config = loadAppConfig({
      NODE_ENV: 'test',
      PORT: '3100',
      DATABASE_PATH: 'data/test.sqlite',
      SOURCE_ROOT: 'pnarmacy',
    });

    expect(config).toMatchObject({
      nodeEnv: 'test',
      port: 3100,
    });
    expect(config.databasePath).toMatch(/data\/test\.sqlite$/);
    expect(config.sourceRoot).toMatch(/pnarmacy$/);
  });

  it('rejects a non-numeric port', () => {
    expect(() => loadAppConfig({ PORT: 'zero' })).toThrow(
      'PORT must be an integer between 1 and 65535',
    );
  });

  it.each(['0', '65536'])('rejects port outside the TCP range: %s', (port) => {
    expect(() => loadAppConfig({ PORT: port })).toThrow(
      'PORT must be an integer between 1 and 65535',
    );
  });
});
