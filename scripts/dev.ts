const processes = [
  Bun.spawn(['bun', '--watch', 'server/index.ts'], {
    cwd: import.meta.dir + '/..',
    stdout: 'inherit',
    stderr: 'inherit'
  }),
  Bun.spawn(['bun', 'x', 'vite', '--host', '0.0.0.0'], {
    cwd: import.meta.dir + '/..',
    stdout: 'inherit',
    stderr: 'inherit'
  })
]

const stop = () => {
  for (const process of processes) process.kill()
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)

const exitCode = await Promise.race(processes.map((process) => process.exited))
stop()
process.exit(exitCode)
