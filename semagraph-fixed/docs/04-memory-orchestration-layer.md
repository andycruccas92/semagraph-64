# Memory and Trajectory Layer

SemaGraph memory is trajectory memory, not narrative memory.

A trajectory stores anchored states, accepted transitions, ordered masks, net mutation and compressed signature. The raw measurements and anchor-rule version must remain available for audit.

Compressed signatures may be used for retrieval, clustering and policy reuse. They must not replace the raw observed chain.
