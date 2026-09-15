# Implementation Plan

このドキュメントは `cue-align` の実装進捗と、次に着手する作業の順序を管理する。

仕様そのものは [`SPEC.md`](./SPEC.md)、ユビキタス言語は [`CONTEXT.md`](./CONTEXT.md) を正とする。このファイルでは仕様を再定義せず、実装をどの単位・順序で進めるかだけを扱う。

## Status

- [x] Phase 1: Domain Core
- [ ] Phase 2: Input Pipeline
- [ ] Phase 3: Audio Authoring
- [ ] Phase 4: Authoring Controls
- [ ] Phase 5: Export / Resume
- [ ] Phase 6: Video Support / v1 Polish

現在は **Phase 1 完了、Phase 2 着手前**。

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

目的: browser から入る JSON / File を Core が扱える型へ安全に変換する境界を作る。

### Next PR: Authoring input pipeline

想定タイトル:

`feat: add authoring input pipeline`

主な対象:

```text
src/features/alignment/
  errors.ts
  input.ts
  input.test.ts
```

実装内容:

- Cue JSON の file read
- optional Alignment JSON の file read
- `JSON.parse()` の例外を typed error に変換
- Cue JSON の structural validation
- Alignment JSON の structural validation
- JSON の primitive 値から branded type への変換
- Core の alignment validation との接続
- browser / file input 固有エラーと Core domain error の分離

最低限の error model:

- `InputReadError`
- `InputParseError`
- structural validation 用の input error
- Core から返る domain error

Acceptance criteria:

- Cue JSON を `Result` / `ResultAsync` 経由で読み込める。
- Alignment JSON を `Result` / `ResultAsync` 経由で読み込める。
- invalid JSON が uncaught exception にならない。
- malformed Cue / Alignment を明示的に拒否する。
- Cue ID や timestamp の primitive 値は validation 境界を通過してから branded type になる。
- browser/file 固有エラーが `src/core` に入らない。
- file read、parse、validation の失敗経路がテストされている。

この PR では UI を作り込まない。入力境界の API とテストに集中する。

## Phase 3: Audio Authoring

目的: ローカル音声を読み込み、Reference app 上で再生できる最小の authoring workflow を作る。

### PR: Setup and local audio playback

実装内容:

- `/` の Setup UI
- Cue JSON 選択
- Audio file 選択
- optional Alignment JSON 選択
- `URL.createObjectURL()` による local audio playback
- object URL cleanup
- Setup から Editor への遷移
- input pipeline error のユーザー向け表示

Acceptance criteria:

- サーバーへファイルを upload せず browser 内だけで動作する。
- Cue JSON + audio file から Editor を開始できる。
- optional Alignment を読み込んで Editor を開始できる。
- 入力エラーを uncaught exception にせず画面へ表示できる。

### PR: React integration for Alignment Session

実装内容:

- pure transition を利用する React state adapter / hook
- Current Cue / previous / next の表示
- mark 済み状態の表示
- progress 表示
- current playback time の表示

注意:

React state の current time は表示専用とし、Mark の source of truth には使わない。

## Phase 4: Authoring Controls

目的: 1パスの手動 alignment を実用可能にする。

### PR: Keyboard authoring controls

実装内容:

- `Space`: current Cue を mark
- `Backspace`: undo
- `ArrowLeft`: previous Cue
- `ArrowRight`: next Cue
- `event.repeat` の抑止
- editable element focus 時の shortcut 無効化
- handled shortcut の `preventDefault()`

Mark 時にはイベント発生時点の `HTMLMediaElement.currentTime` を直接読み、`TimelinePosition` に変換して Core へ渡す。

Acceptance criteria:

- Audio 再生中に Cue ごとに Space を押すだけで Alignment を作成できる。
- Mark 後に next Cue へ進む。
- Undo で直前の Mark 変更と cursor を戻せる。
- navigation のみでは Alignment が変更されない。
- 長押しによる意図しない連続 Mark が発生しない。

## Phase 5: Export / Resume

目的: 作業結果を保存し、後から再開できるようにする。

### PR: Alignment export and resume

実装内容:

- partial Alignment の JSON export
- complete Alignment の JSON export
- deterministic な Cue order での export
- export 済み Alignment の再 import
- re-mark による既存 Mark 修正

Acceptance criteria:

- 作業途中でも export できる。
- export → reload → import で同じ Alignment から再開できる。
- invalid Alignment は silent correction せず明示的に拒否する。

この時点で Audio を利用した v1 の主要 workflow は end-to-end で成立する。

## Phase 6: Video Support / v1 Polish

目的: Audio で確立した workflow を Video に拡張し、v1 として最低限の使い勝手を整える。

### PR: Local video support

- `<video>` で local file を再生
- Audio と同じ `HTMLMediaElement` ベースの clock handling を再利用
- Audio / Video の分岐を Core へ持ち込まない

### PR: v1 UX polish

候補:

- current / previous / next Cue の視認性改善
- `label ?? id` の primary display
- Cue の追加 metadata 表示
- keyboard shortcut guide
- empty / loading / error state の整理
- completed state の表示

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
