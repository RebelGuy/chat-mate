export default class ConsoleOutput {
  private _stdout: string = ''
  public get stdout () { return this._stdout.length === 0 ? null : this._stdout }

  private _stderr: string = ''
  public get stderr () { return this._stderr.length === 0 ? null : this._stderr }

  public onStdoutData (data: string) {
    this._stdout += data
  }

  public onStderrData (data: string) {
    this._stderr += data
  }

  public printStdout () {
    process.stdout.write(this._stdout)
  }
}