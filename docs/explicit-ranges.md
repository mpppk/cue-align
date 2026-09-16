# Explicit Cue ranges

This document specifies the Post-v1 explicit range extension referenced by `SPEC.md` §16.5.

## Compatibility rule

A v1 `Mark` keeps exactly the same meaning: `{ cueId, at }` is the Cue start position. Explicit ranges are additive and MUST NOT reinterpret `Mark.at`.

An Alignment that does not use explicit ranges remains valid and serializes in the existing form:

```json
{
  "version": 1,
  "marks": [{ "cueId": "a", "at": 12.5 }]
}
```

## Serialization

Explicit ends are stored separately from start Marks:

```ts
type CueRange = {
  cueId: CueId
  end: TimelinePosition
}

type Alignment = {
  version: 1
  marks: Mark[]
  ranges?: CueRange[]
}
```

For example:

```json
{
  "version": 1,
  "marks": [
    { "cueId": "a", "at": 12.5 },
    { "cueId": "b", "at": 20 }
  ],
  "ranges": [
    { "cueId": "a", "end": 18.25 }
  ]
}
```

The effective range for Cue `a` is `[12.5, 18.25]`: its start comes from the canonical Mark and its explicit end comes from the range entry.

When no Cue has an explicit end, canonical serialization omits `ranges`. This preserves existing Alignment output.

## Invariants

- a Cue has at most one explicit range end
- a range entry MUST reference a known Cue
- a range entry MUST have a corresponding start Mark
- `end` MUST be a finite non-negative timeline position
- `end >= start`
- explicit ends do not impose a relationship with the next Cue start; gaps and overlaps remain consumer-defined semantics
- changing a start Mark MUST fail if the new start would be after an existing explicit end

Partial Alignment remains valid: a Cue may have only a start Mark and no explicit end.

## Core operations

Core exposes operations to set and clear an explicit end. These operations participate in undo history. Reading an Alignment and exporting it again MUST preserve valid explicit ends in canonical Cue order.
