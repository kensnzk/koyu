# Preserve canonical format 2.0 for Muro 1.6

## Context

The unreleased Muro 1.6 implementation in ADR-0077 raised every canonical document's
format to 2.1. Downstream consumers that require 2.0 then reject ordinary building
documents even though no existing field changed. A package or language release does
not require changing the format version.

## Decision

Release Koyu 0.29.0 with Muro 1.6 and canonical format 2.0. This supersedes only the
canonical format bump in ADR-0077; 2.1 was never published. Restore the existing
format literal and preserve canonical bytes for unchanged building sources.

Keep the optional `mode: "spatial"` field after `muro`. It is emitted only for the
new explicit Muro 1.6 spatial opt-in, so it changes no existing document. This is a
language-gated extension: a consumer must support both the declared language and
mode before interpreting it. Format acceptance alone is insufficient. Unsupported
consumers must reject spatial mode rather than drop it or infer physical boundaries.
The IFC exporter continues to reject spatial documents before creating IFC data.

## Verification and scope

Existing canonical conformance cases keep their pre-1.6 bytes. Example fingerprints
change only where the source version declaration changes; all existing Form hashes
remain unchanged. Spatial conformance retains its mode under format 2.0.

Architype and other downstream spatial integrations are separate work. This release
does not claim that their strict schemas, renderers or assessments support the mode.
