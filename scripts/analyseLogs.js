const loggers = [] // the names of the loggers to retrieve. leave blank to match all
const levels = [] // the log levels to retrieve ('info' | 'api' | 'debug' | 'warning' | 'error'). leave blank to match all
const ignoreIfContains = [] // words or phrases to filter out
const mustContain = [] // any words or phrases that must be present. ignored if empty, otherwise, at least one match must be found.

const logPath = '/home/rebel/Documents/temp-logs' // it is assumed that there are no other text files on this path other than the log files to analyse

//// SCRIPT START ////

const fs = require('fs')
const path = require('path')

const loggersLowercase = loggers.map(l => l.toLowerCase())

let matches = []
for (const dirent of fs.readdirSync(logPath, { withFileTypes: true })) {
  if (!dirent.isFile() || !dirent.name.startsWith('log_') || !dirent.name.endsWith('.txt')) {
    continue
  }

  // get the list of individual log entries in this file. note that some entries are broken into several lines (e.g. error messages)
  // and must be combined manually.
  const contents = fs.readFileSync(path.join(logPath, dirent.name)).toString()
  let logEntries = []
  let currentEntry = []
  for (const line of contents.split('\n')) {
    if (isBeginningOfLogEntry(line) && currentEntry.length > 0) {
        logEntries.push(currentEntry.join('\n'))
        currentEntry = []
      }

      currentEntry.push(line)
  }

  if (currentEntry.length > 0) {
    logEntries.push(currentEntry.join('\n'))
  }

  // filter each log entry by the user query
  logEntries = logEntries.filter(entry => {
    if (levels.length > 0) {
    const level = getLevel(entry)
    if (!levels.includes(level)) {
      return false
    }
    }

    if (loggersLowercase.length > 0) {
      const logger = getLogger(entry)
      if (!loggersLowercase.includes(logger)) {
        return false
      }
    }

    for (const blacklist of ignoreIfContains) {
      if (entry.includes(blacklist)) {
        return false
      }
    }

    if (mustContain.length > 0) {
      let containsAnyRequired = false
      for (const required of mustContain) {
        if (entry.includes(required)) {
          containsAnyRequired = true
          break
        }
      }

      if (!containsAnyRequired) {
        return false
      }
    }

    return true
  })

  // ensure we prepend the data to each entry
  const date = dirent.name.substring(4, 14)
  logEntries = logEntries.map(entry => `${date} ${entry}`)

  // done
  matches.push(...logEntries)
}

const outputFileName = 'filteredLogs.txt'
console.log(`Found ${matches.length} matching log entries.. Writing to file ${outputFileName}.`)
fs.writeFileSync(path.join(logPath, outputFileName), matches.join('\n'))

//// HELPERS ////

function isBeginningOfLogEntry (line) {
  return line.length > 12 && line.substring(0, 12).match(/\d\d:\d\d:\d\d\.\d\d\d/g) != null
}

function getLevel (entry) {
  return entry.split(' ')[1].toLowerCase()
}

function getLogger (entry) {
  const loggerWithBrackets = entry.split(' ')[3]
  return loggerWithBrackets.substring(1, loggerWithBrackets.length - 1).toLowerCase()
}
