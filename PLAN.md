# Implementation Plan

このドキュメントは `cue-align` の実装進捗と、次に着手する作業の順序を管理する。

仕様そのものは [`SPEC.md`](./SPEC.md)、ユビキタス言語は [`CONTEXT.md`](./CONTEXT.md) を正とする。このファイルでは仕様を再定義せず、実装をどの単位・順序で進めるかだけを扱う。

## Status

- [x] Phase 1: Domain Core
- [x] Phase 2: Input Pipeline
- [x] Phase 3: Audio Authoring
- [x] Phase 4: Authoring Controls
- [x] Phase 5: Export / Resume
- [x] Phase 6: Video Support / v1 Polish

現在は **v1 implementation plan の全 Phase 完了**。

## Implementation principles

実装順序では以下を優先する。

1. Core の domain model と browser / React 固有処理を分離する。
2. 1つの PR では1つの明確な責務に集中する。
3. 外部入力は境界で parse / validate し、Core 内へ不正な値を持ち込まない。
4. expected failure は `@praha/byethrow` の `Result` / `ResultAsync` で扱う。
5. `CueId`、`TimelinePosition`、`CueIndex` などの branded type は境界で明示的に生成する。
6. Audio の end-to-end フローを先に完成させ、Video はその後に追加する。
7. 各フェーズで unit test または integration test を追加し、後続フェーズが前段の仕様を前提にできる状態にする。

## Phase 1: Domain Core

Status: **Done**

PR: #5 `feat: implement alignment domain model`

完了済み:

- Cue / Mark / Alignment / Alignment Session の domain model
- Pure transition
- Mutable session facade
- Cue / Alignment validation
- Undo / navigation
- Canonical Alignment export
- operation-specific Result error union
- `@praha/error-factory` ベースの domain error
- `CueId` / `TimelinePosition` / `CueIndex` の branded type
- Core unit test
- `CONTEXT.md` によるユビキタス言語管理

## Phase 2: Input Pipeline

Status: **Done**

PR: #12 `feat: add authoring input pipeline`

目的: browser から入る JSON / File を Core が扱える型へ安全に変換する境界を作る。

完了済み:

- Cue JSON の file read
- optional Alignment JSON の file read
- `JSON.parse()` の例外を typed error に変換
- Cue JSON / Alignment JSON の structural validation
- JSON の primitive 値から branded type への変換
- Core の alignment validation との接続
- browser / file input 固有エラーと Core domain error の分離
- file read、parse、validation の失敗経路のテスト

## Phase 3: Audio Authoring

Status: **Done**

PRs:

- #13 `feat: add setup and local audio playback`
- #14 `feat: integrate alignment session with React`

目的: ローカル音声を読み込み、Reference app 上で再生できる最小の authoring workflow を作る。

完了済み:

- `/` の Setup UI
- Cue JSON / Audio file / optional Alignment JSON の選択
- Phase 2 input pipeline と Setup UI の接続
- `URL.createObjectURL()` による local audio playback
- object URL cleanup
- Setup から Editor への遷移
- input pipeline error のユーザー向け表示
- pure transition を利用する React state adapter / hook
- Current Cue / previous / next の表示
- current Cue の mark 済み状態の表示
- progress 表示
- current playback time の表示

React state の current time は表示専用とし、Mark の source of truth には使用しない。

## Phase 4: Authoring Controls

Status: **Done**

PR: #15 `feat: add keyboard authoring controls`

目的: 1パスの手動 alignment を実用可能にする。

完了済み:

- `Space`: current Cue を mark
- `Backspace`: undo
- `ArrowLeft`: previous Cue
- `ArrowRight`: next Cue
- `event.repeat` の抑止
- editable element focus 時の shortcut 無効化
- handled shortcut の `preventDefault()`
- Mark 時にイベント発生時点の `HTMLMediaElement.currentTime` を直接読み、`TimelinePosition` に変換して Core へ渡す
- typed な Mark failure の Editor 表示
- shortcut routing / media time capture の unit test

## Phase 5: Export / Resume

Status: **Done**

PR: #16 `feat: add alignment export and resume`

目的: 作業結果を保存し、後から再開できるようにする。

完了済み:

- partial / complete Alignment の canonical JSON serialization
- deterministic な Cue order を保持した download
- export failure の typed Result 化
- export 済み Alignment の既存 import pipeline への round-trip test
- imported Alignment に対する既存 navigation + mark による re-mark

Audio を利用した v1 の主要 workflow はこの時点で end-to-end で成立する。

## Phase 6: Video Support / v1 Polish

Status: **Done**

目的: Audio で確立した workflow を Video に拡張し、v1 として最低限の使い勝手を整える。

PRs:

- #17 `feat: add local video support`
- #18 `feat: polish v1 authoring UX`

完了済み:

- Setup で audio / video file を選択可能
- `<audio>` / `<video>` の local playback
- Audio と同じ `HTMLMediaElement` ベースの clock handling
- keyboard Mark の media ref を `HTMLMediaElement` に一般化
- Audio / Video の分岐を Core へ持ち込まない
- MIME type / extension による media kind 判定テスト
- current / previous / next Cue の視認性改善
- `label ?? id` を primary display とし、label がある場合は Cue ID も表示
- Current Cue の追加 metadata 表示
- keyboard shortcut guide
- empty / error / completed state の明示
- 選択中 media file 名の表示
- responsive な editor actions と video 表示

## v1 Definition of Done

`SPEC.md` の v1 Acceptance Criteria を満たし、最低限以下の workflow が成立したら v1 完了とする。

```text
Cue JSON
   +
Audio or Video file
   +
optional Alignment JSON
   ↓
Setup
   ↓
Editor
   ↓
Play
   ↓
Space = mark current Cue
   ↓
Undo / Navigate / Re-mark
   ↓
Alignment JSON export
   ↓
Import and Resume
```

加えて以下を満たすこと。

- Core は DOM / React / media player に依存しない。
- File / JSON 境界の失敗が typed Result として処理される。
- canonical Alignment は `{ cueId, at }` のみを保持する。
- partial Alignment を正式な状態として扱える。
- Core と Reference app の主要ロジックに自動テストがある。
- `vp check`、`vp test`、`vp build` が成功する。

## Post-v1

以下は v1 を安定させた後に検討する。優先順位は固定しない。

- Waveform editor
- Mark のドラッグ微調整
- 自動 Alignment / ASR / forced alignment 支援
- React adapter のライブラリ化
- Remotion integration
- npm package としての Core 切り出し
- 任意 Cue 選択モード
- Explicit range
- Multiple tracks
- local autosave / recovery

## Updating this plan

- PR が merge されたら該当フェーズの status を更新する。
- 新しい仕様判断が必要になった場合は、先に `SPEC.md` または `CONTEXT.md` を更新し、このファイルには実装順序だけを反映する。
- 実装中に PR 分割を変更してよい。ただし次に着手する PR は常にこのファイルから判別できる状態を保つ。
