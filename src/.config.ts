// we can't use `env()` because it requires dependencies that use aliases
if (process.env.NODE_ENV === 'debug') {
  // webpack doesn't like this and handles the alias resolving itself, but in debug mode
  // the alias is defined manually (see the _moduleAliases entry in the package.json).
  // tslint:disable-next-line:no-var-requires
  require('module-alias/register')

  // if, in the future, we need separate alias paths for release, there is a way:
  // https://github.com/ilearnio/module-alias/issues/74#issuecomment-674397740
}
