# Project Instructions

## Git / Version Control

- always use conventional commit messages in the format:
  ```
  <type>[optional scope]: <description>

  [optional body]

  [optional footer(s)]
  ```
- use clear, concise commit descriptions
- use SemVer for versioning and prefix version tags always with `v`, e.g. `v1.2.1`

## Branch Workflow

- do active development on the local `dev` branch
- keep `main` aligned with the remote `origin/main` unless explicitly asked to change it
- when a feature or improvement is ready, merge or pull `dev` into `main`
- after merging a finished feature into `main`, continue future work on `dev`
- prefer treating `dev` as the long-lived working branch for the next improvement
