# Codex task 03 — Validate schemas and fixtures

## Goal

Make JSON fixtures demonstrably conform to the v3 schema contracts.

## Scope

- add a dependency-light schema-validation test approach;
- validate `examples/kernel/pressure-cohesion-model.json` and `examples/kernel/trajectory.json`;
- validate optional adapter expressions independently.

## Boundary

Schemas must preserve transition authority and kernel/adapter separation.
