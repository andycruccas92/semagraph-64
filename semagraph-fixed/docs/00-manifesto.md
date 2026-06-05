# Manifesto

SemaGraph exists to make state change computable, replayable and compressible.

The project treats observed change as a chain of finite transitions. Domain observations are first anchored through declared parameters and deterministic rules. Once a state is anchored, the transition chain is processed through finite algebraic operations, not linguistic inference.

SemaGraph is not a model of reality. It is an intermediate representation for change: compact enough for computation, explicit enough for audit and stable enough for policy resolution.

A valid SemaGraph system must answer four questions:

1. Which observations or parameters produced this state?
2. Which anchor-rule version produced this bit vector?
3. Which finite transition connects two observed states?
4. Which compressed signature is used for policy lookup or policy drafting?

The canonical v0.5 architecture separates observation, transition processing and policy. LLMs may help draft policy text after deterministic processing, but they do not determine observed states or transition chains.
