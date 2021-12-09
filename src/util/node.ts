import ConsoleOutput from './ConsoleOutput'
import { exec } from 'child_process'

export async function execAsync(command: string, consoleOutput?: ConsoleOutput): Promise<void> {
  const child = exec(command)
  child.stdout!.on('data', msg => consoleOutput ? consoleOutput.onStdoutData(msg) : process.stdout.write(msg))
  child.stderr!.on('data', msg => consoleOutput ? consoleOutput.onStderrData(msg) : process.stderr.write(msg))

  return new Promise<void>((resolve, reject) => {
    child.on('exit', code => code === 0 ? resolve() : reject())
  })
}
