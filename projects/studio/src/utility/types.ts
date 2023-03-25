// stolen from the `generatePath` signature
type _PathParam<Path extends string> = Path extends `${infer L}/${infer R}` ? _PathParam<L> | _PathParam<R> : Path extends `:${infer Param}` ? Param extends `${infer Optional}?` ? Optional : Param : never
export type PathParam<Path extends string> = Path extends '*' ? '*' : Path extends `${infer Rest}/*` ? '*' | _PathParam<Rest> : _PathParam<Path>
