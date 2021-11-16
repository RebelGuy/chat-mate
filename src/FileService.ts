import * as fs from 'fs'

export default class FileService {
  save (fileName: string, contents: string) {
    fs.writeFileSync(fileName, contents)
  }

  load (fileName: string): string | null {
    if (fs.existsSync(fileName)) {
      return fs.readFileSync(fileName).toString()
    } else {
      return null
    }
  }
}