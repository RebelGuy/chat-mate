# Prisma Cheat Sheet

For new projects: https://www.prisma.io/docs/getting-started/setup-prisma/start-from-scratch/relational-databases-typescript-mysql

## Commands
- `prisma db push` is useful for prototyping database changes without creating any migrations (i.e. "play around"). See https://www.prisma.io/docs/concepts/components/prisma-migrate/db-push

- `prisma db pull`: "introspect" a database, that is, create a Prisma Schema File from the database. Note: any formatting/comments will be overwritten.

- `prisma migrate resolve --applied "20201127134938_my_migration"`: marks the provided migration as "applied", e.g. if the SQL instructions were manually run

- logging queries for performance debugging: https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/logging#event-based-logging


## Schema
https://www.prisma.io/docs/concepts/components/prisma-schema/data-model
- can create and use `enum`s in the `schema.prisma` file

## Querying
Create a type that only `select`s certain columns of a table:
```typescript
const userPersonalData = Prisma.validator<Prisma.UserArgs>()({
  select: { email: true, name: true },
})
type UserPersonalData = Prisma.UserGetPayload<typeof userPersonalData>
```

`include` relations of a model:
```typescript
async function getUsersWithPosts() {
  const users = await prisma.user.findMany({ include: { posts: true } })
  return users
}
```

Using nested queries to create objects is recommended as they operate on an all-or-none basis.
See https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries for examples.


## Migration problems and resolutions

### Renaming a table
When renaming a table (for example by changing `@@map("x")` to `@@map("y")`), Prisma will delete and re-add the table in the migration. The automatic migration will be structured as follows:
1. Remove all foreign keys of table `x`
2. Drop table `x`
3. Create table `y` - note that this also automatically recreates any indexes, though with a slightly different name
4. Re-add the foreign keys to table `y` - these will have a slightly different name

To prevent data loss, manually modify steps 2 and 3 above as follows:
```SQL
RENAME TABLE `x` TO `y`;
ALTER TABLE `y` RENAME INDEX `old_index_name` TO `new_index_name`;
```

where `new_index_name` can be found by looking at the automatic `CREATE` statement (step 3).

