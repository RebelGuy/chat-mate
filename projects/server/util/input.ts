import * as rl from 'readline'


// note: this only works when the process is run manually in the terminal, NOT when using the VSCode debugger
export function listenForUserInput (callback: (input: string) => void) {
  const stdin = process.stdin
  stdin.resume()
  stdin.on('data', data => {
    const msg = data.toString()
    callback(msg.replace('\r\n', ''))
  })
}

export async function promptInput (text: string): Promise<string> {
  const readline = rl.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise<string>(resolve => {
    readline.question(text.endsWith(' ') ? text : text + ' ', res => {
      readline.close()
      resolve(res)
    })
  })
}
