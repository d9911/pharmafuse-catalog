import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const projectRoot = resolve(__dirname, '..')

function runScript(script: string, env: NodeJS.ProcessEnv = {}) {
  return spawnSync('bash', [join(projectRoot, 'scripts', script)], {
    cwd: projectRoot,
    env: { ...process.env, NO_COLOR: '1', ...env },
    encoding: 'utf8',
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
})
