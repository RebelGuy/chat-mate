import { Dependencies } from '@rebel/context/context'
import { GenericObject } from '@rebel/types'
import * as fs from 'fs'
import path from 'node:path'

export default class FileService {
  private readonly dataPath: string

  constructor (deps: Dependencies) {
    this.dataPath = deps.resolve<string>('dataPath')
  }

  public getDataFilePath (fileName: string) {
    return path.resolve(this.dataPath, fileName)
  }

  public save (filePath: string, contents: string) {
    const directory = path.dirname(filePath)
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true })
    }
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
}
