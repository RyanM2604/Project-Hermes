# Project Hermes Branching Strategy

Project Hermes uses `dev` as the integration and development-environment branch
and `main` as the production-ready branch.

## Promotion Flow

```text
feature/* or fix/* -> dev -> main
```

- Create feature and fix branches from the latest `dev`.
- Open pull requests from feature and fix branches into `dev`.
- Test the integrated application from `dev`.
- Promote releases with a pull request from `dev` into `main`.
- Keep `main` production-ready. Do not merge feature branches directly into
  `main`.

## Current Private-Repository Controls

This private repository does not currently have access to GitHub branch
protection or repository rulesets.

The repository uses two workflows as non-enforceable safeguards:

- `CI` runs lint and build checks for pushes and pull requests involving `dev`
  or `main`.
- `Main Promotion Policy` fails pull requests into `main` unless they originate
  from this repository's `dev` branch.

These checks communicate and validate the intended workflow, but they cannot
prevent administrators or contributors with write access from pushing directly
to `main`.

## Enable When Protection Becomes Available

When the repository becomes public or gains a GitHub plan that supports branch
protection, configure these rules.

### Protect `main`

- Require a pull request before merging.
- Require at least one approving review.
- Dismiss stale approvals when new commits are pushed.
- Require conversation resolution before merging.
- Require the `Lint and build` and `Require dev as source branch` status checks.
- Require branches to be up to date before merging.
- Block force pushes and branch deletion.
- Do not allow bypassing the rules.

The required `Require dev as source branch` check makes pull requests from any
branch other than `dev` ineligible to merge into `main`.

### Protect `dev`

- Require a pull request before merging.
- Require the `Lint and build` status check.
- Require branches to be up to date before merging.
- Block force pushes and branch deletion.

## Keeping `dev` Current

After each release promotion, `dev` and `main` should point to the same commit.
If an emergency change is ever applied to `main`, immediately merge or rebase
that change back into `dev` before starting more feature work.

