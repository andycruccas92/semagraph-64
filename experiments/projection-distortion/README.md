# Projection distortion

Treats every distinct six-number input as a richer formalized object and measures
what happens after projection into Q6:

- unordered rich-input collision rate;
- occupied State64 buckets and Shannon entropy;
- largest collision bucket;
- completeness of the bit -> predicate -> variable/relation -> binding ->
  evidence trace.

Trace completeness makes loss inspectable; it does not reconstruct distinctions
discarded by the projection.
