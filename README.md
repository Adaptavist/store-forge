# Pluggable Storage Modules for Atlassian Forge

This library provides
[StorageModule](https://jsr.io/@storage/common/doc/types/~/StorageModule)
implementations for Atlassian's
[Forge](https://developer.atlassian.com/platform/forge/) platform.

See [Pluggable Storage Modules](https://jsr.io/@storage/main) on which this is
built.

## Contributing

Minimal Requirements:

- [Deno 2.4.5+](https://docs.deno.com/runtime/getting_started/installation/)

Testing in Forge:

- [Node 22](https://nodejs.org/)
- [pnpm](https://pnpm.io/)

Or, use
[pkgx](https://github.com/pkgxdev/pkgx)+[dev](https://github.com/pkgxdev/dev).

## Format/lint/typecheck

Before committing:

```sh
$ deno task ok
```

## Testing

As these storage API are designed to work in a Forge app, the most reliable way
to test is within a Forge app itself.

`forge-test-app` contains a minimal Forge app, that has a webtrigger that runs a
test suite directly inside the Forge environment. It's a node project, first
you'll need to set that up:

```sh
$ deno task pnpm install
```

and setup a Forge account and login, you can use the following deno tasks to
perform `pnpm` and `forge` commands within the test app...

```sh
$ deno task pnpm ...
$ deno task forge ...
```

The `manifest.yml` has a hardcode id, that is (or will be) used for CI testing,
if you don't have permission to deploy this, then you need to register it as a
new app.

```sh
$ deno task forge register
```

For the app to consume the `store-forge-kv` package, we must build a temporary
local npm package...

```sh
$ deno task build
```

Then we can build and deploy the Forge app:

```sh
$ deno task forge deploy
```

Then you'll need to install the Forge on a Jira site that you are an admin of...

```sh
$ deno task forge install
```

Once it's installed you need to get a URL to the webtrigger:

```sh
$ deno task forge webtrigger
```

Select your installation, and web trigger when prompted, and a URL will be
returned.

Either open this URL in a browser or `curl` it.

The test suite should run and return either `Success` or `Fail`, you'll have to
look at the
[Atlassian developer console](https://developer.atlassian.com/console) for any
log messages if it fails.

After the first time you can use the following shortcut to rebuild, deploy and
upgrade:

```sh
$ deno task forge-deploy
```

## TODO

- _report failures directly from payload_
- _task to find the web trigger URL, hit it, and console log the result, with an
  appropriate exit code_
- _run in CI_
