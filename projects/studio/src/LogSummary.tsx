import { PublicLogTimestamps } from '@rebel/server/controllers/public/log/PublicLogTimestamps'
import { formatTime } from '@rebel/server/util/datetime'
import { getLogTimestamps } from '@rebel/studio/api'
import ApiRequest from '@rebel/studio/ApiRequest'

export default function LogSummary() {
  return <div style={{ height: '3em' }}>
    <ApiRequest onDemand={false} repeatInterval={5000} onRequest={getLogTimestamps}>
      {data => data && renderTimestamps(data!.timestamps)}
    </ApiRequest>
  </div>
}

function renderTimestamps (timestamps: PublicLogTimestamps) {
  const renderLast = (timestamps: number[]) => {
    if (timestamps.length === 0) {
      return null
    } else {
      const last = timestamps.at(-1)!
      return ` (last at ${formatTime(new Date(last))})`
    }
  }

  return <div style={{ display: 'block' }}>
    <div>Errors: {timestamps.errors.length}{renderLast(timestamps.errors)}</div>
    <div>Warnings: {timestamps.warnings.length}{renderLast(timestamps.warnings)}</div>
  </div>
}
