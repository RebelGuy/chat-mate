import { Dependencies } from '@rebel/context/context'
import { GenericObject } from '@rebel/types'
import * as fs from 'fs'
import path from 'node:path'

export default class FileService {
  private readonly disableSaving: boolean
  private readonly dataPath: string

  constructor (deps: Dependencies) {
    this.disableSaving = deps.resolve<boolean>('disableSaving')
    this.dataPath = deps.resolve<string>('dataPath')
    this.ensureDir(this.dataPath)

    if (this.disableSaving) {
      console.log('Using read-only FileService')
    }
  }

  public getDataFilePath (fileName: string) {
    return path.resolve(this.dataPath, fileName)
  }

  public getDataFiles (): string[] {
    return fs.readdirSync(this.dataPath)
  }

  public save (filePath: string, contents: string) {
    if (this.disableSaving) {
      return
    }

    const directory = path.dirname(filePath)
    this.ensureDir(directory)
    fs.writeFileSync(filePath, contents)
  }

  public saveObject<T extends GenericObject> (filePath: string, object: T) {
    this.save(filePath, JSON.stringify(object))
  }

  public load (filePath: string): string | null {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath).toString()
    } else {
      return null
    }
  }

  public loadObject<T extends GenericObject> (filePath: string): T | null {
    const contents = this.load(filePath)
    return contents ? JSON.parse(contents) as T : null
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
}
