import ContextClass from '@rebel/shared/context/ContextClass'

type FetchOptions = {
  body?: Record<any, any>
  headers?: Record<string, string>
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT'
}

export default class WebService extends ContextClass {
  public async fetch (url: string, options?: FetchOptions): Promise<Response> {
    return fetch(url, {
      method: options?.method,
      headers: options?.headers,
      body: options?.body != null ? JSON.stringify(options.body) : undefined
    })
  }
}
