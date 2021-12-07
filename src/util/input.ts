// note: this only works when the process is run manually in the terminal, NOT when using the VSCode debugger
export function listenForUserInput(callback: (input: string) => void) {
  const stdin = process.stdin;
  stdin.resume();
  stdin.on('data', data => {
    const msg = data.toString()
    callback(msg.replace("\r\n", ""))
  })
}
