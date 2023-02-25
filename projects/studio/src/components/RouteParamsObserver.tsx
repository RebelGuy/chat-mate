import { useParams } from 'react-router-dom'

export let routeParams: Record<string, string | undefined> = {}

export default function RouteParamsObserver () {
  const params = useParams()

  routeParams = params
  
  return null
}
