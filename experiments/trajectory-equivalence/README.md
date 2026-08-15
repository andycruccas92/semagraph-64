# Trajectory equivalence

Runs the real Q3 trajectory API over declared paths and counts how many distinct
exact trajectories collapse together under:

- endpoint identity;
- net mutation;
- run-collapsed shape;
- exact path identity.

It also records the comparison cascade, including same-form/different-duration
cases. The fixture is [`scenarios.json`](scenarios.json).
