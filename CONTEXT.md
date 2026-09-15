# Cue Alignment Context

`cue-align` は、あらかじめ分かっている順序付きの対象列を、1つの時間軸上の時刻へ対応付けるためのコンテキストである。対象が何を意味するか、また対応付けた結果をどのように表示・再生・レンダリングするかはこのコンテキストの外に置く。

## Language

**Cue**:
Timeline 上の開始位置を割り当てる対象の、Cue Sequence 中の1回の出現。同じ意味の対象が複数回現れる場合でも、それぞれを別の Cue として扱う。
_Avoid_: Event, Item, Step, Line, Token

**Cue ID**:
Cue を一意に識別する安定した識別子。Alignment は Cue の内容や列中の位置ではなく Cue ID を参照する。
_Avoid_: Index, Position, Key

**Cue Sequence**:
Alignment の対象となる Cue の既知の順序付き列。列の順序は、各 Cue に付ける Mark の時間的な順序を定める。
_Avoid_: Script, Queue, Cue List

**Timeline**:
Cue を位置付ける単調増加の時間軸。音声や動画の再生時間が典型例だが、特定のメディア形式には限定しない。
_Avoid_: Clock, Media Timeline

**Timeline Position**:
Timeline 上の1点。Timeline の起点からの経過位置として表され、Mark が Cue に割り当てる値である。
_Avoid_: Timestamp, Timecode, Current Time

**Mark**:
1つの Cue と1つの Timeline Position との対応。Cue が開始する位置を表し、v1 では1つの Cue に対して canonical な Mark は最大1つとする。
_Avoid_: Timestamp, Segment, Range, Marker

**Alignment**:
1つの Cue Sequence と1つの Timeline の対応関係を、0個以上の Mark で表したもの。すべての Cue に Mark がなくても Alignment として成立する。
_Avoid_: Sync, Synchronization, Timing Map

**Partial Alignment**:
Cue Sequence の一部の Cue にのみ Mark がある Alignment。作業途中の状態を含み、そのまま保存・再開できる対象として扱う。
_Avoid_: Incomplete Sync, Draft Timing

**Complete Alignment**:
Cue Sequence のすべての Cue に Mark がある Alignment。
_Avoid_: Finished Sync, Full Timing

**Alignment Session**:
固定された Cue Sequence に対して Alignment を作成または修正している途中の作業コンテキスト。Partial Alignment のまま終了・再開してもよく、Complete Alignment になることを必須としない。
_Avoid_: Session, Editor State, Alignment State

**Current Cue**:
Alignment Session において、現在 mark の対象として選択されている Cue。Current Cue が変わること自体は Alignment を変更しない。
_Avoid_: Cursor, Active Item, Selected Index

**Mark a Cue**:
Cue に Timeline Position を割り当て、Mark を作成または置き換える操作。既存の Mark を変更する場合も同じ語を使う。
_Avoid_: Timestamp a Cue, Sync a Cue, Set Timing

**Align a Cue Sequence**:
Cue を順に mark して Alignment を作成または修正すること。自動処理か手動操作かはこの語では区別しない。
_Avoid_: Synchronize, Timecode
