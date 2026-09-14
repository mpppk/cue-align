# cue-align Specification

Status: Draft for v1

## 1. Overview

`cue-align` is a general-purpose tool and headless TypeScript library for aligning a pre-defined ordered sequence of cues to a media timeline by marking timestamps during playback.

The core problem is:

> Given an ordered sequence of known cues and a clock, assign each cue a timestamp as a human listens to or watches the media.

A typical workflow is:

1. Prepare an ordered list of cues.
2. Load audio or video in an authoring UI.
3. Start playback.
4. Press Space whenever the current cue begins.
5. `cue-align` records the current playback time for that cue and advances to the next cue.
6. Export the resulting alignment.
7. A downstream consumer interprets the alignment for rendering, subtitles, slides, animation, video generation, or another domain-specific purpose.

`cue-align` does not decide what a cue means visually or semantically. It only records the relationship between cue IDs and time.

## 2. Goals

The v1 design MUST support the following:

- Align a known, ordered sequence of cues to a timeline in real time.
- Keep the core library independent of React, the DOM, browser media elements, and any particular rendering system.
- Allow arbitrary application-specific data to be attached to cues.
- Treat recorded timestamps as the canonical alignment data.
- Support fast keyboard-driven authoring.
- Support undo and cue navigation during an authoring session.
- Allow a partially completed alignment to be exported and resumed.
- Make the output easy to consume from TypeScript and easy to serialize as JSON.

## 3. Non-goals for v1

The following are explicitly out of scope for v1:

- Speech recognition or automatic transcription.
- Forced alignment from audio and text.
- Automatic beat detection.
- Waveform rendering or drag-based waveform editing.
- Rendering videos, subtitles, slides, or animations.
- Remotion-specific APIs.
- Domain-specific concepts such as lyrics, wine classifications, presentation slides, or chapters.
- Multiple simultaneous tracks.
- Cue graphs, branching scripts, or unordered cue collections.
- Recording separate canonical start and end timestamps for every cue.
- Collaborative or multi-user editing.

These may be implemented later without changing the fundamental Cue -> Mark alignment model.

## 4. Terminology

### Cue

A `Cue` is an item that should be assigned a time.

A cue has a stable unique ID and an opaque application-specific payload.

```ts
type CueId = string;

type Cue<T = unknown> = {
  id: CueId;
  data: T;
};
```

Examples of cue payloads include:

```ts
{ text: "Hello, world" }
```

```ts
{ slideId: "architecture" }
```

```ts
{ label: "Chateau Margaux", grade: 1 }
```

The core library MUST NOT inspect or assign semantics to `data`.

### Mark

A `Mark` associates a cue with a point on the timeline.

```ts
type Mark = {
  cueId: CueId;
  at: number;
};
```

`at` is measured in seconds from the beginning of the media or external clock.

For example:

```json
[
  { "cueId": "a", "at": 12.314 },
  { "cueId": "b", "at": 15.821 },
  { "cueId": "c", "at": 17.082 }
]
```

### Alignment

An `Alignment` is the serializable result produced by an authoring session.

```ts
type Alignment = {
  version: 1;
  marks: Mark[];
};
```

The cue definitions are intentionally separate from the alignment. An alignment refers to cues by stable IDs so the same cue sequence can be reused with different media or different takes.

### Session

An `AlignmentSession` is mutable authoring state used while creating or editing an alignment.

It combines:

- an ordered cue sequence;
- zero or more existing marks;
- a current cue cursor;
- operation history required for undo.

The session is not itself the persisted file format.

## 5. Core invariants

### 5.1 Cue IDs

Within one cue sequence:

- cue IDs MUST be unique;
- cue IDs MUST be non-empty strings;
- cue order is defined only by the order of the input array.

### 5.2 Time values

A mark timestamp MUST be:

- finite;
- greater than or equal to `0`;
- expressed in seconds.

The library MUST NOT round timestamps. Precision is determined by the clock supplied by the caller.

### 5.3 One mark per cue

v1 permits at most one canonical mark per cue.

Re-marking a cue is therefore an update to its existing mark, not the creation of another mark.

### 5.4 Ordered alignment

v1 is designed for ordered cues. For marked cues, timestamps MUST preserve cue order.

Given cues `[A, B, C]`, a valid complete alignment satisfies:

```text
A.at <= B.at <= C.at
```

Equal timestamps MAY be accepted because two logical cues can intentionally begin at the same instant.

An operation that would make the alignment non-monotonic MUST fail without mutating the session.

### 5.5 Partial alignments

An alignment MAY be incomplete. This is required for save/resume workflows.

A session therefore MUST NOT require every cue to have a mark before export.

## 6. Canonical data model

The canonical timing information is the cue start mark:

```ts
{ cueId, at }
```

The canonical format MUST NOT store a derived `end` value for each cue in v1.

Consumers may derive intervals when their semantics allow it:

```ts
const intervals = marks.map((mark, index) => ({
  cueId: mark.cueId,
  start: mark.at,
  end: marks[index + 1]?.at,
}));
```

However, `cue-align` MUST NOT assume that the next cue starting means the previous cue remains active until that point. A consumer may need to represent silence, an interlude, or another state between cues.

This separation avoids encoding rendering semantics into the alignment format.

## 7. Headless core API

The exact implementation names may evolve, but v1 SHOULD expose an API equivalent to the following.

```ts
type CreateAlignmentSessionOptions<T> = {
  cues: readonly Cue<T>[];
  alignment?: Alignment;
  initialCueId?: CueId;
};

interface AlignmentSession<T> {
  readonly cues: readonly Cue<T>[];
  readonly currentCue: Cue<T> | undefined;
  readonly currentIndex: number;

  markCurrent(at: number): void;
  mark(cueId: CueId, at: number): void;

  undo(): boolean;

  seekCue(cueId: CueId): void;
  seekIndex(index: number): void;
  nextCue(): void;
  previousCue(): void;

  getMark(cueId: CueId): Mark | undefined;
  getAlignment(): Alignment;
  isComplete(): boolean;
}

function createAlignmentSession<T>(
  options: CreateAlignmentSessionOptions<T>,
): AlignmentSession<T>;
```

### 7.1 `markCurrent(at)`

`markCurrent(at)` MUST:

1. validate the timestamp;
2. associate the current cue with `at`;
3. reject the operation if it would violate ordering invariants;
4. record enough history for `undo()`;
5. advance the cursor to the next cue when one exists.

If the current cue already has a mark, the operation updates that mark subject to the same ordering constraints.

### 7.2 `mark(cueId, at)`

`mark` is the non-UI primitive for assigning or updating a cue timestamp.

It MUST NOT implicitly change the current cue unless the implementation documents such behavior. The recommended v1 behavior is to leave the cursor unchanged.

### 7.3 `undo()`

`undo()` reverts the most recent successful mark mutation performed in the current session.

For the normal real-time workflow:

```text
mark A -> mark B -> undo
```

results in B returning to its previous state and the current cursor returning to B.

It returns `false` when there is nothing to undo.

Cursor-only navigation does not need to be part of the undo history in v1.

### 7.4 Cue navigation

`seekCue`, `seekIndex`, `nextCue`, and `previousCue` change only the current cursor. They MUST NOT modify alignment data.

This allows an author to inspect earlier or later cues without changing timestamps.

## 8. Clock and media independence

The core package MUST NOT own or control media playback.

The caller supplies the current time explicitly:

```ts
session.markCurrent(audio.currentTime);
```

This boundary allows the same core library to work with:

- `HTMLAudioElement`;
- `HTMLVideoElement`;
- Web Audio API clocks;
- custom media players;
- YouTube or other embedded players;
- Remotion Player;
- MIDI or external timecode;
- tests using a deterministic fake clock.

A future adapter package MAY provide clock integrations, but media control is not part of the headless core contract.

## 9. Reference authoring tool

The repository SHOULD include a small reference browser application built on the headless core.

The v1 authoring flow is intentionally simple.

### Inputs

The tool accepts:

1. an ordered cue definition;
2. an audio or video source;
3. optionally, an existing alignment to resume or edit.

The initial generic interchange format for cues SHOULD be JSON.

Example:

```json
[
  { "id": "a", "data": { "text": "First cue" } },
  { "id": "b", "data": { "text": "Second cue" } },
  { "id": "c", "data": { "text": "Third cue" } }
]
```

The media file may be loaded locally in the browser. Uploading media to a server is not required for v1.

### Primary UI

The tool SHOULD prominently show:

- current playback position;
- previous cue;
- current cue;
- next cue;
- progress through the cue sequence;
- whether the current cue already has a mark.

A minimal representation is:

```text
00:42.381

Previous
A

Current
B

Next
C

[ Space: Mark current cue ]
```

The UI may display cue `data` using a configurable formatter. The core library does not define how arbitrary cue data is rendered.

## 10. Default keyboard workflow

The reference authoring tool SHOULD provide the following default bindings:

| Key | Action |
| --- | --- |
| `Space` | Mark the current cue at the current playback time and advance |
| `Backspace` | Undo the most recent mark mutation |
| `ArrowLeft` | Move the cue cursor to the previous cue |
| `ArrowRight` | Move the cue cursor to the next cue |

Keyboard handlers belong to the authoring UI, not the core package.

The tool MUST prevent browser defaults such as page scrolling when a shortcut is handled and focus is not inside an editable control.

## 11. Save, resume, and export

The authoring tool SHOULD allow the current `Alignment` to be exported as JSON at any time, including when incomplete.

Example:

```json
{
  "version": 1,
  "marks": [
    { "cueId": "a", "at": 12.314 },
    { "cueId": "b", "at": 15.821 }
  ]
}
```

When an existing alignment is loaded, the core MUST validate that:

- the format version is supported;
- every referenced cue ID exists in the supplied cue sequence;
- no cue appears more than once;
- all timestamps are valid;
- marked cues preserve cue order.

Invalid input MUST produce an explicit validation error rather than silently dropping or rewriting data.

## 12. Error model

Expected user/data errors SHOULD be represented explicitly rather than relying on uncaught exceptions in the UI.

Examples include:

- duplicate cue ID;
- unknown cue ID in an imported alignment;
- invalid timestamp;
- non-monotonic timestamp assignment;
- unsupported alignment version;
- invalid cue index.

The exact TypeScript error representation is an implementation decision for v1, but error cases MUST be distinguishable programmatically.

## 13. Suggested repository architecture

A reasonable initial structure is:

```text
cue-align/
  packages/
    core/
      src/
  apps/
    web/
  examples/
  SPEC.md
```

Possible later packages include:

```text
packages/
  react/
  waveform/
  remotion/
```

These are not required for the first implementation.

## 14. Example use cases

The same core model should support all of the following without domain-specific changes.

### Lyrics or memorization video

Each cue represents a lyric fragment, vocabulary item, or named item. A downstream video renderer highlights the active item according to the marks.

### Slide synchronization

Each cue identifies a slide. Marks record when each slide should become active.

### Subtitle preparation

Each cue contains known transcript text. Marks provide manually authored start timestamps for later subtitle conversion.

### Product demo or screencast

Each cue describes a step in a scripted demonstration. Marks align those steps to a recorded video.

### Chapter or annotation timing

Each cue represents a chapter, annotation, or metadata event to be attached to a media timeline.

## 15. Example: rendering integration

Rendering is intentionally downstream of `cue-align`.

Given:

```ts
const cues = [
  { id: "a", data: { label: "Alpha" } },
  { id: "b", data: { label: "Beta" } },
];

const alignment = {
  version: 1 as const,
  marks: [
    { cueId: "a", at: 12.3 },
    { cueId: "b", at: 15.8 },
  ],
};
```

A renderer may determine the active cue for a given time and render anything it wants. For example, a video application might highlight `Alpha` from its mark until its own application-specific transition rule says otherwise.

That transition rule does not belong in `cue-align`.

## 16. Future extensions

The following extensions are compatible with the v1 model and may be explored later.

### Waveform editing

After a fast real-time marking pass, display marks over an audio waveform and allow millisecond-level drag adjustment.

The waveform implementation should consume and update the same `Mark` data rather than introducing a second timing format.

### Arbitrary cue selection

Provide an authoring mode where users select a cue before marking instead of always advancing sequentially.

### Automatic alignment assistance

ASR, forced alignment, beat detection, or other systems may propose initial marks. The human authoring tool can then correct those marks.

Automatic systems should therefore produce the same `Alignment` format as manual authoring.

### Framework integrations

Adapters may be provided for React, Remotion, media players, or other ecosystems while keeping `@cue-align/core` framework-independent.

### Explicit ranges

Some future use cases may require independently authored cue end times. If introduced, ranges should be an additive concept rather than changing the meaning of v1 start marks.

### Multiple tracks

Future versions may support multiple independent cue sequences aligned against the same clock, such as lyrics plus scene changes. This is deliberately not part of the v1 session model.

## 17. Design principles

Implementation decisions should preserve the following principles:

1. **Alignment, not rendering.** The library records when known cues occur; consumers decide what those cues mean.
2. **Headless core.** Core logic has no dependency on React, DOM events, or a specific media player.
3. **Stable IDs over positional coupling.** Marks reference cue IDs, while the cue array defines intended order.
4. **Minimal canonical data.** Store observed timestamps; derive presentation-specific intervals and states elsewhere.
5. **Fast human input first.** A complete real-time pass should require little more than listening and pressing one key per cue.
6. **Correction is expected.** Undo, navigation, resume, and later precision editing are first-class parts of the model.
7. **Automation is additive.** Future machine-generated marks should use the same format as human-generated marks.

## 18. v1 acceptance criteria

The first usable version is complete when all of the following are possible:

1. Create a session from an ordered array of generic cues.
2. Load audio or video in the reference browser tool.
3. Play the media and press Space once per cue.
4. Record each cue against the media's current time.
5. Undo an accidental mark.
6. Navigate backward and forward through cues without changing timing data.
7. Reject invalid or non-monotonic timing assignments.
8. Export a partial or complete versioned alignment as JSON.
9. Reload the cue list plus exported alignment and continue editing.
10. Use the exported alignment from application code without depending on the authoring UI.

This is the v1 contract. Features beyond these criteria should not be allowed to complicate the core data model before the basic workflow is implemented and validated.
