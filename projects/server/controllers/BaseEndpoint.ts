import { Request, Response } from 'express'
import { URLSearchParams } from 'url'

export const BASE_PATH = '/api'

export function buildPath (...pathParts: string[]) {
  return BASE_PATH + pathParts.map(p => '/' + p).join()
}

export type EndpointResponse = Record<string, any>

export type QueryParams = {
  [p: string]: string | undefined;
}

export default function Endpoint<Q extends QueryParams, R extends EndpointResponse> (handler: (queryParams: Q) => R | null) {
  return (req: Request, res: Response) => {
    const urlParams = new URLSearchParams(req.url)
    const params = Object.fromEntries(urlParams) as Q
    const response = handler(params)
    return res.send(response)
  }
}