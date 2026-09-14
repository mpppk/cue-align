# cue-align 仕様書

ステータス: v1 Draft

## 1. 概要

`cue-align` は、あらかじめ定義された順序付きの Cue 列を、音声・動画などのメディアのタイムラインへ手動で対応付けるための汎用ツールおよび headless TypeScript ライブラリである。

解決する中心的な問題は次のとおり。

> 既知の順序付き Cue 列と時刻を取得できるクロックが与えられたとき、人がメディアを聴く・見る操作に合わせて各 Cue に時刻を割り当てる。

典型的な利用フローは以下。

1. 順序付き Cue 列を用意する。
2. オーサリング UI で音声または動画を読み込む。
3. メディアを再生する。
4. 現在の Cue が始まった瞬間に Space を押す。
5. `cue-align` がその Cue と現在の再生時刻を対応付け、次の Cue へ進む。
6. 作成された Alignment を出力する。
7. 下流のアプリケーションが Alignment を解釈し、動画、字幕、スライド、アニメーションなどを生成する。

`cue-align` 自体は Cue が映像上・意味上で何を表すかを解釈しない。責務は **Cue ID とタイムライン上の時刻との対応付け**に限定する。

---

## 2. v1 の目標

v1 は以下を満たさなければならない。

- 既知の順序付き Cue 列をタイムラインへリアルタイムにアラインできる。
- Core ライブラリを React、DOM、ブラウザの media element、特定レンダリングシステムから独立させる。
- Core が要求する Cue の契約を `id` のみに限定し、利用側が任意の追加プロパティを持つ Cue 型を使用できる。
- Core の状態遷移を純粋関数としてテスト可能にする。
- React 等から利用しやすい session facade を提供できる設計にする。
- 記録された時刻を canonical な Alignment データとして扱う。
- キーボードを中心とした高速なオーサリングを可能にする。
- オーサリング中の undo と Cue 移動を可能にする。
- Alignment が未完成でも保存・出力でき、後から再開できる。
- 想定内の入力エラーを型で識別可能にする。
- TypeScript から扱いやすく、JSON に容易にシリアライズできる形式とする。

---

## 3. v1 の非目標

以下は v1 の対象外とする。

- 音声認識、自動文字起こし
- 音声とテキストによる forced alignment
- ビート自動検出
- 波形描画および波形上でのドラッグ編集
- 動画、字幕、スライド、アニメーションのレンダリング
- Remotion 固有 API
- 歌詞、ワイン格付け、プレゼンテーション、章などのドメイン固有概念
- 複数タイムライン / 複数トラックの同時編集
- Cue graph、分岐 script、順序のない Cue 集合
- すべての Cue に対する独立した start/end 時刻の canonical 保存
- 共同編集・複数ユーザー編集
- サーバーへのメディア upload やクラウド保存

これらは将来的に追加可能だが、基本となる **Cue → Mark** の Alignment モデルは維持する。

---

## 4. 用語とデータモデル

### 4.1 Cue

`Cue` はタイムライン上の時刻を割り当てたい対象を表す。

Core が Cue に要求するのは、安定した一意 ID のみである。

```ts
type CueId = string

type Cue = {
  id: CueId
}
```

アプリケーションは `Cue` を満たす任意の型を使用できる。

```ts
type LyricCue = Cue & {
  text: string
  speaker?: string
}
```

```ts
type SlideCue = Cue & {
  slideId: string
  title: string
}
```

例えば実際の Cue は次のように表現できる。

```ts
{
  id: 'line-1',
  text: 'Hello, world',
  speaker: 'Alice',
}
```

Core は `id` 以外のプロパティを解釈してはならない。ただし、入力された Cue オブジェクト自体はそのまま保持し、`currentCue` や `cues` を通じて同じ具体型のまま呼び出し側へ返す。

このため、利用側は `data` のようなラッパープロパティを用意する必要がない。

### 4.2 Mark

`Mark` は Cue とタイムライン上の一点を対応付ける。

```ts
type Mark = {
  cueId: CueId
  at: number
}
```

`at` はメディア、または外部クロックの開始時点からの秒数とする。

例:

```json
[
  { "cueId": "a", "at": 12.314 },
  { "cueId": "b", "at": 15.821 },
  { "cueId": "c", "at": 17.082 }
]
```

### 4.3 Alignment

`Alignment` はオーサリングセッションによって生成される、永続化可能な結果である。

```ts
type Alignment = {
  version: 1
  marks: Mark[]
}
```

Cue 定義そのものは Alignment から分離する。

Alignment は安定した `cueId` のみを参照するため、同じ Cue 列を別の音源、別テイク、別動画に対して再利用できる。また、Cue にアプリケーション固有プロパティを追加しても Alignment format は変化しない。

### 4.4 AlignmentState

`AlignmentState` は編集中の Core 内部状態であり、永続化フォーマットではない。

概念上、以下の情報を保持する。

```ts
type AlignmentState = {
  marksByCueId: ReadonlyMap<CueId, number>
  currentIndex: number
  history: readonly MarkHistoryEntry[]
}
```

`marksByCueId` は編集操作を効率よく行うための内部表現である。外部へ永続化するときは必ず `Alignment` の `Mark[]` に変換する。

Cue ID から配列 index を引く lookup table を初期化時に構築してよい。

### 4.5 AlignmentSession

`AlignmentSession` は Alignment を作成・編集するための ergonomic な mutable facade である。

Session は Core の canonical なロジックそのものではなく、後述する pure transition を包む利用者向け API と位置付ける。

Session 自体は永続化フォーマットではなく、React の state management 機構でもない。

---

## 5. Core invariant

### 5.1 Cue ID

1つの Cue 列において以下を満たすこと。

- Cue ID は一意でなければならない。
- Cue ID は空文字列であってはならない。
- Cue の順序は入力配列の順序のみで定義する。

### 5.2 時刻

Mark の `at` は以下を満たさなければならない。

- finite number である。
- `0` 以上である。
- 単位は秒である。

Core は時刻を丸めてはならない。精度は呼び出し側から渡されるクロックに依存する。

### 5.3 1 Cue につき 1 Mark

v1 では各 Cue に対して canonical な Mark は最大1つとする。

すでに Mark 済みの Cue を再度 mark した場合、新しい Mark を追加するのではなく既存 Mark の更新として扱う。

### 5.4 順序制約

v1 は順序付き Cue を対象とする。

Mark 済み Cue の時刻は Cue の順序と矛盾してはならない。

Cue が `[A, B, C]` の場合、有効な Alignment は次を満たす。

```text
A.at <= B.at <= C.at
```

同じ瞬間に複数の論理 Cue が開始するケースを許容するため、同一時刻は許可する。

ある Cue を mark / re-mark するときは、その Cue より前にある最も近い Mark と、その Cue より後ろにある最も近い Mark を境界として検証すればよい。

順序制約を破る操作は、状態を変更せず失敗しなければならない。

### 5.5 部分 Alignment

Alignment は未完成でもよい。

すべての Cue に Mark が付いていなくても export 可能でなければならない。

これにより保存・再開フローを実現する。

---

## 6. Canonical timing data

v1 における canonical なタイミング情報は Cue の開始点を表す Mark のみとする。

```ts
{ cueId, at }
```

`end` は canonical データとして保存しない。

必要な consumer は次のように区間へ変換できる。

```ts
const intervals = marks.map((mark, index) => ({
  cueId: mark.cueId,
  start: mark.at,
  end: marks[index + 1]?.at,
}))
```

ただし `cue-align` は「次の Cue が始まるまで前の Cue が active である」と仮定してはならない。

例えば以下のようなケースがある。

```text
Cue A ──────       Cue B ──────
            ↑
         無音・間奏
```

Cue A の意味上の終了時刻と Cue B の開始時刻が一致するとは限らない。

そのため表示状態や区間の意味は consumer 側の責務とする。

---

## 7. Headless Core の技術設計

### 7.1 Pure transition を中核とする

Core の状態変更ロジックは、現在状態と操作を受け取り、新しい状態を返す純粋関数として実装する。

概念例:

```ts
function markCurrent<TCue extends Cue>(
  state: AlignmentState,
  cues: readonly TCue[],
  at: number,
): Result<AlignmentState, AlignmentError>
```

同様に、少なくとも以下の transition を用意する。

```ts
markCurrent(state, cues, at)
mark(state, cues, cueId, at)
undo(state)
seekCue(state, cues, cueId)
seekIndex(state, cues, index)
nextCue(state, cues)
previousCue(state, cues)
```

Pure transition は React、DOM、browser API、global state に依存してはならない。

この構造により、Core の invariant と undo behavior を deterministic な unit test で検証できる。

### 7.2 Session facade

利用側の記述量を減らすため、pure transition の上に `AlignmentSession` facade を提供してよい。

概ね以下と同等の API とする。

```ts
type CreateAlignmentSessionOptions<TCue extends Cue> = {
  cues: readonly TCue[]
  alignment?: Alignment
  initialCueId?: CueId
}

interface AlignmentSession<TCue extends Cue> {
  readonly cues: readonly TCue[]
  readonly currentCue: TCue | undefined
  readonly currentIndex: number

  markCurrent(at: number): Result<void, AlignmentError>
  mark(cueId: CueId, at: number): Result<void, AlignmentError>

  undo(): boolean

  seekCue(cueId: CueId): Result<void, AlignmentError>
  seekIndex(index: number): Result<void, AlignmentError>
  nextCue(): void
  previousCue(): void

  getMark(cueId: CueId): Mark | undefined
  getAlignment(): Alignment
  isComplete(): boolean
}

function createAlignmentSession<TCue extends Cue>(
  options: CreateAlignmentSessionOptions<TCue>,
): Result<AlignmentSession<TCue>, AlignmentError>
```

この generic により、Core は `id` のみを利用しながら、アプリケーション固有の Cue 型を失わずに保持できる。

Session facade の mutable state は pure transition の結果によってのみ更新する。

### 7.3 React との境界

Reference app では Session facade の mutation を React が自動検知するとは仮定しない。

React adapter / hook は次のいずれかで状態変更を React に伝播する。

- pure transition の `AlignmentState` を React state として保持する。
- Session facade を包み、mutation 後に snapshot を更新する。

Core に React subscription API を導入しない。

### 7.4 `markCurrent(at)`

`markCurrent(at)` は以下を行う。

1. timestamp を検証する。
2. current Cue と `at` を対応付ける。
3. 順序制約に違反する場合は `Result` の error を返す。
4. `undo()` に必要な履歴を記録する。
5. 次の Cue が存在すれば cursor を次へ進める。

current Cue がすでに Mark 済みの場合は、同じ制約のもと既存 Mark を更新する。

### 7.5 `mark(cueId, at)`

任意 Cue に timestamp を割り当てる headless primitive とする。

`mark` 自体は current cursor を暗黙に移動しない。

### 7.6 `undo()`

undo history は v1 では Mark mutation のみを対象とする。

履歴は少なくとも次を保持する。

```ts
type MarkHistoryEntry = {
  type: 'mark'
  cueId: CueId
  previousAt: number | undefined
  previousCursorIndex: number
}
```

通常フローで、

```text
mark A -> mark B -> undo
```

とした場合、B の Mark は変更前の状態へ戻り、current cursor も B へ戻る。

undo 対象がない場合は `false` を返す。

v1 では cursor 移動のみの操作は undo 履歴へ含めない。

### 7.7 Cue navigation

`seekCue`、`seekIndex`、`nextCue`、`previousCue` は cursor のみを変更する。

Alignment データを変更してはならない。

---

## 8. クロック・メディアからの独立

Core はメディア再生を所有・制御してはならない。

現在時刻は呼び出し側から明示的に渡す。

```ts
session.markCurrent(audio.currentTime)
```

この境界により同じ Core を以下と組み合わせられる。

- `HTMLAudioElement`
- `HTMLVideoElement`
- Web Audio API の clock
- 独自 media player
- YouTube 等の embedded player
- Remotion Player
- MIDI / 外部 timecode
- deterministic fake clock を用いたテスト

Reference app で mark する際の source of truth は、React state に複製された再生時刻ではなく、Space 等の操作イベントが発生した瞬間の `HTMLMediaElement.currentTime` とする。

画面表示用の current time は React state に保持してよいが、mark の timestamp には使用しない。

---

## 9. Reference authoring tool

リポジトリには headless core を利用する小さなブラウザ向け reference app を含める。

v1 ではサーバー側 persistence を持たず、ブラウザ内で完結する。

### 9.1 入力

Reference app は以下を入力として扱う。

1. 順序付き Cue 定義
2. 音声または動画
3. 任意で既存 Alignment

Cue の初期 interchange format は JSON とする。

Core の必須フィールドは `id` のみであり、それ以外のプロパティはアプリケーション側で自由に追加できる。

Reference app 固有の convention として、optional な `label` を primary display text として扱う。

```ts
type ReferenceCue = Cue & {
  label?: string
  [key: string]: unknown
}
```

表示時は次の優先順位とする。

```text
cue.label ?? cue.id
```

`label` は Core の契約ではなく Reference app の UI convention である。

例:

```json
[
  { "id": "a", "label": "First cue", "speaker": "Alice" },
  { "id": "b", "label": "Second cue", "speaker": "Bob" },
  { "id": "c", "label": "Third cue" }
]
```

メディアはブラウザ上でローカルファイルとして読み込む。`URL.createObjectURL()` を利用し、不要になった URL は revoke する。

Cue / Alignment JSON は `File.text()` 等でローカルに読み込む。

### 9.2 主画面

最低限、次の情報を表示する。

- メディア player
- 現在の再生時刻
- 前の Cue
- 現在の Cue
- 次の Cue
- Cue 全体に対する進捗
- current Cue がすでに Mark 済みかどうか
- export 操作

例:

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

`label` 以外の追加プロパティは詳細表示してよいが、Core はその意味や表示方法を定義しない。

### 9.3 Route

v1 は `/` の単一 route でよい。

画面内部を概念的に以下の2状態として扱う。

```text
Setup
  ↓
Editor
```

Setup で Cue JSON / media / optional Alignment を読み込み、Editor で同期作業を行う。

---

## 10. デフォルトのキーボード操作

Reference app は以下の shortcut を提供する。

| Key | Action |
| --- | --- |
| `Space` | current Cue を現在の再生時刻で mark し、次の Cue へ進む |
| `Backspace` | 直近の Mark 変更を undo |
| `ArrowLeft` | 前の Cue へ移動 |
| `ArrowRight` | 次の Cue へ移動 |

Keyboard handling は Core ではなく UI の責務とする。

以下を満たすこと。

- handled shortcut では browser default behavior を `preventDefault()` する。
- `event.repeat` による連続 mark を防止する。
- `input`、`textarea`、`select`、`contenteditable` 等の編集可能要素に focus がある場合は global shortcut を処理しない。

---

## 11. 保存・再開・Export

Reference app は未完成の Alignment を含め、いつでも JSON export できるようにする。

```json
{
  "version": 1,
  "marks": [
    { "cueId": "a", "at": 12.314 },
    { "cueId": "b", "at": 15.821 }
  ]
}
```

既存 Alignment を読み込む際は最低限以下を検証する。

- format version がサポート対象である。
- 参照される Cue ID が Cue 列に存在する。
- 同じ Cue が複数回出現していない。
- timestamp が有効である。
- Mark 済み Cue の時刻が Cue 順序と矛盾しない。

不正データを黙って削除・修正してはならず、明示的な validation error とする。

---

## 12. Error model

入力・ユーザー操作によって通常発生し得るエラーは、exception のみで表現せず、discriminated union と `Result` でプログラムから識別可能にする。

```ts
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E }
```

概念上のエラー型は以下。

```ts
type AlignmentError =
  | {
      type: 'duplicate-cue-id'
      cueId: CueId
    }
  | {
      type: 'unknown-cue-id'
      cueId: CueId
    }
  | {
      type: 'invalid-time'
      at: number
    }
  | {
      type: 'non-monotonic-time'
      cueId: CueId
      at: number
      min?: number
      max?: number
    }
  | {
      type: 'unsupported-alignment-version'
      version: unknown
    }
  | {
      type: 'invalid-cue-index'
      index: number
    }
```

Validation、mark、seek 等の expected failure は `Result` で返す。

ライブラリ内部の programming error や invariant violation まで必ず `Result` 化する必要はない。

---

## 13. リポジトリ構成

現在の bootstrap は Bun + Vite+ + TanStack Start + React + Cloudflare Workers の単一アプリ構成である。

v1 初期実装では monorepo 化せず、以下の構成を推奨する。

```text
cue-align/
  src/
    core/
      types.ts
      errors.ts
      validation.ts
      state.ts
      transitions.ts
      selectors.ts
      session.ts
      index.ts
      *.test.ts

    features/
      alignment/
        components/
          MediaPlayer.tsx
          CueViewer.tsx
          CueNavigation.tsx
          Progress.tsx
          ExportButton.tsx
        useAlignmentSession.ts
        useAlignmentShortcuts.ts
        useMedia.ts

    routes/
      __root.tsx
      index.tsx

  SPEC.md
```

`src/core/**` は React、DOM、TanStack、Cloudflare、`HTMLMediaElement` に依存してはならない。

将来 npm package として独立させる必要が生じた場合、`src/core` を `packages/core` へ移動する。

現在の test configuration は将来の `packages/*/src/**/*.test.*` も扱えるため、初期段階で workspace 化する必要はない。

---

## 14. ユースケース例

Core のデータモデルを変更せず、以下のような用途を扱えることを目標とする。

### 14.1 歌詞・暗記動画

Cue が歌詞断片、単語、固有名詞などを表す。

下流の動画レンダラーが Mark に応じて現在の項目をハイライトする。

ボルドー・メドック格付け銘柄の暗記動画はこの一例であり、Core にワイン固有の概念は導入しない。

### 14.2 スライド同期

各 Cue が slide を識別し、その slide が有効になる時刻を Mark として記録する。

### 14.3 字幕作成

各 Cue が既知の transcript text などの追加プロパティを持ち、手動で開始時刻を割り当てる。

### 14.4 Product demo / screencast

各 Cue が scripted demo のステップを表し、録画された動画上の時刻へ対応付ける。

### 14.5 Chapter / annotation

Cue が chapter、annotation、metadata event を表し、メディアタイムラインへ配置する。

---

## 15. Rendering integration の例

Rendering は意図的に `cue-align` の下流へ分離する。

```ts
const cues = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
]

const alignment = {
  version: 1 as const,
  marks: [
    { cueId: 'a', at: 12.3 },
    { cueId: 'b', at: 15.8 },
  ],
}
```

Renderer は `cueId` から Cue を参照し、任意時刻に active な Cue を独自ルールで決定して、Cue の追加プロパティを利用した任意の UI や映像を描画できる。

例えば動画アプリケーションは `Alpha` の Mark から独自の transition rule で終了と判断するまで `Alpha` をハイライトできる。

その transition rule は `cue-align` の責務ではない。

---

## 16. 将来拡張

### 16.1 波形編集

リアルタイム打刻を一度完了した後、音声波形上へ Mark を表示し、ミリ秒単位でドラッグ調整できるようにする。

波形 editor は新しい timing format を導入せず、同じ `Mark` データを編集する。

### 16.2 任意 Cue 選択

常に順番に進むモードに加え、ユーザーが任意 Cue を選択して mark できるモードを追加できる。

### 16.3 自動 Alignment 支援

ASR、forced alignment、beat detection、その他の自動処理が初期 Mark を提案し、人間が修正するワークフローを追加できる。

自動生成された結果も手動編集と同じ `Alignment` format を出力する。

### 16.4 Framework integration

Core を framework-independent に保ったまま、React、Remotion、各種 media player 向け adapter を提供できる。

### 16.5 Explicit range

将来、独立した Cue 終了時刻が必要なユースケースに対応してもよい。

その場合も v1 の start Mark の意味を変更せず、range は additive な概念として追加する。

### 16.6 Multiple tracks

歌詞と scene change のように、同じ clock に対して複数の独立 Cue 列をアラインする機能を将来的に追加できる。

これは v1 の Session model には含めない。

---

## 17. 設計原則

実装判断では以下を維持する。

1. **Alignment, not rendering**  
   ライブラリは既知の Cue がいつ発生するかを記録する。Cue が何を意味するかは consumer が決める。

2. **Headless core**  
   Core は React、DOM event、特定 media player に依存しない。

3. **Pure transitions first**  
   Core の invariant を担う状態変更は純粋関数として実装し、mutable session はその facade とする。

4. **Minimal Cue contract**  
   Core が Cue に要求するのは安定した `id` のみとし、その他のアプリケーション固有プロパティは解釈せず具体型のまま保持する。

5. **Stable ID over positional coupling**  
   Mark は Cue ID を参照し、Cue 配列は意図した順序を定義する。

6. **Minimal canonical data**  
   観測された timestamp のみを保存し、Cue のアプリケーション固有データや表示固有の区間・状態は Alignment に複製しない。

7. **Expected errors are values**  
   ユーザー入力や通常操作で発生し得る失敗は discriminated union と `Result` で扱う。

8. **Fast human input first**  
   リアルタイム同期の1パスは、基本的にメディアを再生し Cue ごとに1キー押すだけで完了できるようにする。

9. **Correction is expected**  
   Undo、navigation、save/resume、将来の精密編集を通常フローとして扱う。

10. **Automation is additive**  
    将来的な自動 Alignment も人間が生成するものと同じ Alignment format を使用する。

---

## 18. v1 Acceptance Criteria

最初の利用可能バージョンは、以下をすべて満たした時点で完成とする。

1. `id` を持ち、任意の追加プロパティを含められる順序付き Cue 配列を読み込める。
2. Core の主要状態遷移が pure function として unit test されている。
3. Session を通して Cue の具体型が保持され、`currentCue` などから追加プロパティへ型安全にアクセスできる。
4. Expected error が `AlignmentError` と `Result` で識別可能である。
5. Reference browser app でローカルの音声を読み込める。
6. メディアを再生し、Cue ごとに Space を押して同期できる。
7. Space を押した瞬間の `HTMLMediaElement.currentTime` を Cue の Mark として記録できる。
8. `event.repeat` による意図しない連続 Mark が発生しない。
9. 誤った打刻を undo できる。
10. Cue cursor を前後へ移動できる。
11. 既存 Cue の Mark を修正できる。
12. 未完成状態を含む Alignment を JSON として export できる。
13. Export 済み Alignment を再度読み込み、作業を継続できる。
14. 不正な Cue / Alignment を明示的な validation error として拒否できる。
15. Core が DOM、React、特定 media player、Remotion に依存しない。
16. Alignment が Cue の追加プロパティを複製せず、downstream renderer から Cue ID と時刻の対応として利用できる。
17. Reference app は `label ?? id` を primary Cue text として表示できる。

Video 対応は `HTMLMediaElement` 共通 API を利用して audio の end-to-end フローが安定した後に追加してよい。

---

## 19. 初期実装で優先する最小フロー

最初の実装では、機能を以下まで絞る。

```text
Cue JSON
   +
Audio file
   ↓
Reference Authoring UI
   ↓
Play
   ↓
Space = markCurrent(audio.currentTime)
   ↓
Alignment JSON
```

推奨実装順序:

1. `src/core` の型、validation、state、pure transition、selector、session facade
2. Core unit test
3. Cue JSON / optional Alignment の読み込み
4. Audio file の local playback
5. Space / Backspace / ArrowLeft / ArrowRight
6. Alignment JSON export
7. Video 対応
8. UX 改善

この最小フローを安定させた後に、波形編集、自動 Alignment、Remotion adapter などを追加する。
