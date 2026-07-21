import { spawn } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const gameDirectory = resolve('src', 'app', 'play', 'game')
const testFiles = (await readdir(gameDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
  .map((entry) => resolve(gameDirectory, entry.name))
  .sort()

if (testFiles.length === 0) {
  throw new Error(`No game tests found in ${gameDirectory}`)
}

const testProcess = spawn(process.execPath, ['--import', 'tsx', '--test', ...testFiles], {
  stdio: 'inherit',
})

const exitCode = await new Promise((resolveExit) => {
  testProcess.once('exit', (code) => resolveExit(code ?? 1))
  testProcess.once('error', () => resolveExit(1))
})

process.exitCode = exitCode
