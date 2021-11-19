export type GenericObject = { [key: string]: any };

// to ensure that the type definitions across different consumers are synced, any changes
// to the api response schema should be accompanied by a bump of the schema version -
// this way the consumers can easily detect potential bugs.
export type ApiSchema<Schema extends number, T> = T & { schema: Schema }
