# Security Policy

## Supported versions

SemaGraph is pre-1.0. Security fixes are applied to the latest released version
on the `main` branch only.

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue.

- Preferred: use GitHub's **"Report a vulnerability"** (Security → Advisories) at
  https://github.com/andycruccas92/semagraph/security/advisories/new
- Or email: **a.cruccas92@yahoo.it** with the subject `SEMAGRAPH SECURITY`.

Include a description, affected version/commit, and a minimal reproduction.
You can expect an acknowledgement within a reasonable timeframe, and coordinated
disclosure once a fix is available.

## Scope note

The kernel is deterministic, dependency-free, and performs no network access or
persistence. The most relevant classes of issue are therefore input handling
(malformed trajectories, out-of-range state codes) and any deviation from the
documented deterministic behaviour.
