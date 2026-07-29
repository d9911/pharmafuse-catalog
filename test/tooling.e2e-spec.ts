import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'

const projectRoot = resolve(__dirname, '..')

function runScript(script: string, env: NodeJS.ProcessEnv = {}) {
  return spawnSync('bash', [join(projectRoot, 'scripts', script)], {
    cwd: projectRoot,
    env: { ...process.env, NO_COLOR: '1', ...env },
    encoding: 'utf8',
  })
}

async function reservePort(): Promise<number> {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('Expected a TCP address')
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) rejectClose(error)
      else resolveClose()
    })
  })
  return address.port
}

async function waitForChildExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return

  await new Promise<void>((resolveExit, rejectExit) => {
    const timeout = setTimeout(() => rejectExit(new Error('Listener process did not exit')), 7_000)
    child.once('exit', () => {
      clearTimeout(timeout)
      resolveExit()
    })
  })
}

describe('project tooling', () => {
  it.each(['Darwin', 'Linux'])('plans environment initialization for %s', (platform) => {
    const result = runScript('init-environment.sh', {
      PHARMAFUSE_OS: platform,
      PHARMAFUSE_DISTRO: platform === 'Linux' ? 'ubuntu' : '',
      DRY_RUN: '1',
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('NVM')
    expect(result.stdout).toContain('Node.js 24.11.0')
    expect(result.stdout).toContain('npm 11.16.0')
  })

  it('rejects an unsupported operating system before mutation', () => {
    const result = runScript('init-environment.sh', {
      PHARMAFUSE_OS: 'Windows_NT',
      DRY_RUN: '1',
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Unsupported operating system')
  })

  it('runs npm ci only when dependencies are missing or the lockfile changes', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'pharmafuse-deps-'))
    const fakeBin = join(fixture, 'bin')
    const npmLog = join(fixture, 'npm.log')

    try {
      mkdirSync(fakeBin)
      writeFileSync(join(fixture, 'package-lock.json'), '{"lockfileVersion":3}\n')
      writeFileSync(
        join(fakeBin, 'npm'),
        `#!/bin/sh
printf '%s\n' "$*" >> "$NPM_LOG"
mkdir -p "$PROJECT_ROOT/node_modules"
`,
      )
      chmodSync(join(fakeBin, 'npm'), 0o755)

      const env = {
        PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
        PROJECT_ROOT: fixture,
        NPM_LOG: npmLog,
      }

      const first = runScript('ensure-dependencies.sh', env)
      const second = runScript('ensure-dependencies.sh', env)

      expect(first.status).toBe(0)
      expect(second.status).toBe(0)
      expect(readFileSync(npmLog, 'utf8').trim().split('\n')).toEqual(['ci'])

      writeFileSync(join(fixture, 'package-lock.json'), '{"lockfileVersion":3,"changed":true}\n')
      const changed = runScript('ensure-dependencies.sh', env)

      expect(changed.status).toBe(0)
      expect(readFileSync(npmLog, 'utf8').trim().split('\n')).toEqual(['ci', 'ci'])
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })

  it('terminates only the process listening on the configured port', async () => {
    const port = await reservePort()
    const portText = String(port)
    const listener = spawn(
      process.execPath,
      ['-e', `require('node:net').createServer().listen(${portText}, '127.0.0.1', () => process.stdout.write('ready\\n'))`],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    )

    try {
      await once(listener.stdout, 'data')
      const result = runScript('free-port.sh', { APP_PORT: String(port) })

      expect(result.status).toBe(0)
      await waitForChildExit(listener)

      const replacement = createServer()
      replacement.listen(port, '127.0.0.1')
      await once(replacement, 'listening')
      await new Promise<void>((resolveClose) => replacement.close(() => resolveClose()))
    } finally {
      if (listener.exitCode === null) listener.kill('SIGKILL')
    }
  })

  it('accepts an already free port and rejects an invalid port', async () => {
    const port = await reservePort()
    expect(runScript('free-port.sh', { APP_PORT: String(port) }).status).toBe(0)

    const invalid = runScript('free-port.sh', { APP_PORT: '0' })
    expect(invalid.status).not.toBe(0)
    expect(invalid.stderr).toContain('APP_PORT must be an integer between 1 and 65535')
  })

  it('prints the dashboard URL without opening a browser when disabled', () => {
    const result = runScript('open-dashboard.sh', { APP_PORT: '3008', OPEN_BROWSER: '0' })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('http://localhost:3008/graphiql')
  })

  it('falls back to printing the dashboard URL on headless Ubuntu', () => {
    const result = runScript('open-dashboard.sh', {
      PHARMAFUSE_OS: 'Linux',
      DISPLAY: '',
      WAYLAND_DISPLAY: '',
      OPEN_BROWSER: '1',
    })

    expect(result.status).toBe(0)
    expect(`${result.stdout}${result.stderr}`).toContain('http://localhost:3008/graphiql')
  })

  it('plans the complete local development lifecycle in order', () => {
    const result = runScript('start-local.sh', { DRY_RUN: '1' })

    expect(result.status).toBe(0)
    expect(result.stdout.split('\n').filter((line) => line.startsWith('+ '))).toEqual([
      '+ make docker-down (when Docker is running)',
      '+ make port-free',
      '+ make clean-build',
      '+ make deps-ensure',
      '+ make migrate',
      '+ make verify',
      '+ start readiness/import/browser helper',
      '+ make dev',
    ])
  })

  it('plans the complete Docker lifecycle in order', () => {
    const result = runScript('start-docker.sh', { DRY_RUN: '1' })

    expect(result.status).toBe(0)
    expect(result.stdout.split('\n').filter((line) => line.startsWith('+ '))).toEqual([
      '+ make docker-down',
      '+ make port-free',
      '+ make clean-build',
      '+ make deps-ensure',
      '+ make verify',
      '+ make docker-config',
      '+ make docker-build-clean',
      '+ make docker-up-ready',
      '+ make docker-health',
      '+ make docker-smoke',
      '+ open GraphiQL dashboard',
    ])
  })
})
