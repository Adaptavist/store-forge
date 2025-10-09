# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.3]

### Changed

- update to `@storage/common` 0.8.0
- update other deps

## [0.0.2]

### Fixed

- [store-forge-kv] leave number segments that don't round-trip exactly as
  strings, eg. stop zero-padded number from being converted to numbers
- [store-forge-kv] fix encoding of blank space segments
- run all unit tests (which were mistakenly filtered out before)

### Changed

- update store deps to 0.7.0

## [0.0.1]

### Added

- [store-forge-kv] Storage module for Forge KV
