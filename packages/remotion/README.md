# @mpppk/cue-align-remotion

Frame conversion helpers for consuming canonical `cue-align` Alignment data from a Remotion project.

```ts
import { alignmentToFrameMarks } from '@mpppk/cue-align-remotion'

const result = alignmentToFrameMarks(alignment, 30)
```

`TimelinePosition` values remain canonical seconds in Core. This adapter converts each start Mark to the nearest frame using `Math.round(at * fps)`.

The adapter intentionally does **not** infer an `endFrame` from the next Mark. The v1 Alignment model only states when a Cue starts; whether a Cue remains active until another Cue starts is a consumer-level rendering decision.
