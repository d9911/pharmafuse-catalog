import { loadAppConfig } from './app-config'

describe('loadAppConfig', () => {
  it('resolves configured paths from the project root', () => {
    const config = loadAppConfig({
      NODE_ENV: 'test',
      HOST: '0.0.0.0',
      PORT: '3100',
      DATABASE_PATH: 'data/test.sqlite',
      SOURCE_ROOT: 'pnarmacy',
    })

    expect(config).toMatchObject({
      nodeEnv: 'test',
      host: '0.0.0.0',
      port: 3100,
    })
    expect(config.databasePath).toMatch(/data\/test\.sqlite$/)
    expect(config.sourceRoot).toMatch(/pnarmacy$/)
  })

  it('rejects a non-numeric port', () => {
    expect(() => loadAppConfig({ PORT: 'zero' })).toThrow('PORT must be an integer between 1 and 65535')
  })

  it.each(['0', '65536'])('rejects port outside the TCP range: %s', (port) => {
    expect(() => loadAppConfig({ PORT: port })).toThrow('PORT must be an integer between 1 and 65535')
  })

  it('enables GraphiQL by default outside production', () => {
    expect(loadAppConfig({ NODE_ENV: 'development' }).graphiqlEnabled).toBe(true)
  })

  it('disables GraphiQL by default in production', () => {
    expect(loadAppConfig({ NODE_ENV: 'production' }).graphiqlEnabled).toBe(false)
  })

  it('allows an explicit GraphiQL override', () => {
    expect(loadAppConfig({ NODE_ENV: 'production', GRAPHIQL_ENABLED: 'true' }).graphiqlEnabled).toBe(true)
    expect(loadAppConfig({ NODE_ENV: 'development', GRAPHIQL_ENABLED: 'false' }).graphiqlEnabled).toBe(false)
  })

  it('rejects an invalid GraphiQL boolean', () => {
    expect(() => loadAppConfig({ GRAPHIQL_ENABLED: 'yes' })).toThrow('GRAPHIQL_ENABLED must be true or false')
  })
})
