I'm so sick of looking these up every time there's a nontrivial migration so let's just note them down here.

# Rename a table
`RENAME TABLE old_table_name TO new_table_name;`

# Rename a column
`ALTER TABLE table_name RENAME COLUMN old_column_name TO new_column_name;`

Don't forget to remove/re-add foreign keys if required or rename indexes.

# Add an index
`ALTER TABLE table_name ADD INDEX index_name (column_name ASC) VISIBLE;`

# Rename an index
`ALTER TABLE table_name RENAME INDEX old_index_name TO new_index_name;`

# Delete an index
`DROP INDEX index_name ON table_name;`

If it's a unique index that we are deleting:
`ALTER TABLE table_name DROP INDEX index_name;`

However, if the index is required in a foreign key constraint, you must first delete the foreign key constraint, then re-add it after (see below).

# Drop and add a foreign key
It is not possible to rename a foreign key. Instead, you must drop and re-add it:

`ALTER TABLE table_name DROP FOREIGN KEY fkey_name;`

`ALTER TABLE table_name ADD CONSTRAINT fkey_name FOREIGN KEY (current_table_column) REFERENCES foreign_table_name (foreign_table_column) ON DELETE RESTRICT ON UPDATE CASCADE;`

# Add a non-null column with default values
`ALTER TABLE table_name ADD COLUMN column_name data_type NULL;`
`UPDATE table_name SET column_name = value WHERE id > 0;`
`ALTER TABLE table_name MODIFY COLUMN column_name data_type NOT NULL;`

# Update a column
`UPDATE table_name SET column_name = value WHERE condition;`

Note that `value` can be a sub-query that returns a single column.

We can also update multiple columns at once, for example:
(todo: this is incorrect syntax but i don't know why lol)
`UPDATE table_name SET (column1_name, column2_name) = (value1, value2) WHERE condition;`

Note that, again, `(value1, value2)` could be replaced with a subquery that returns two columns.

# Add entries
`INSERT INTO table_name (column1_name, column2_name) query`

where `query` must return the correct number of columns.
