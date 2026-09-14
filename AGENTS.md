# cue-align

順序付き Cue 列をメディアのタイムラインへ手動で対応付けるツール + headless TypeScript ライブラリ。詳細は `SPEC.md` を参照。

- Core は React / DOM / media element に依存しない。Cue の契約は `id` のみ。
- Canonical データは `{ cueId, at }` の Mark 列のみ。`end` は保存しない。
- Reference authoring app は TanStack Start + Cloudflare Workers。

## Runtime / Toolchain

- ローカルランタイムは Node.js ではなく **bun** を利用する（`packageManager: bun@1.4.2`）。
- ツールチェーンは **Vite+** に統一。`vp <name>` はビルトイン、`vp run <name>` は `package.json` スクリプトを実行する。
- 検証ループは `vp check` を優先。移行後の確認は `vp install`, `vp check`, `vp test`, `vp build`。

## Commands

- `vp install` — 依存インストール
- `vp check` — format / lint / type check
- `vp test` — Vitest（テストは `src/**/*.test.{ts,tsx}`）
- `vp build` — 本番ビルド（TanStack Start + Cloudflare plugin）
- `vp run dev` — `vite dev --port 3000`（`vp dev` ではない点に注意）
- `bun run deploy` — `vite build && wrangler deploy`（初回デプロイ済み）
- `bun run cf-typegen` — `wrangler types` で bindings の型生成

## Cloudflare Workers + TanStack Start

- `vite.config.ts` に `@cloudflare/vite-plugin`（`viteEnvironment: { name: 'ssr' }`）+ `tanstackStart()` + React plugin。
- `wrangler.jsonc`: `name: cue-align`, `compatibility_date`, `nodejs_compat`, `main: @tanstack/react-start/server-entry`, `observability.enabled: true`。
- Vitest 実行時は Cloudflare plugin をスキップする（`process.env.VITEST` で条件分岐）。`vp test` が Cloudflare plugin の `resolve.external` エラーで落ちたらこの分岐を確認する。
- 本番: https://cue-align.niboshi.workers.dev
- Workers Builds は Web UI から設定する（PR で preview、main push で production）。wrangler から直接設定できないため、初回はコマンドでデプロイ済み。

## Secrets (1Password)

- 1Password Environment 名はリポジトリ名と同一（`cue-align`）。
- `CLOUDFLARE_API_TOKEN` を格納。値は 1Password item（Cloudflare）の `general-api-token`。
- シークレット値をログやファイルに出力しない。使うときは `op run` で注入する：

```sh
printf 'CLOUDFLARE_API_TOKEN="%s"\n' "op://Personal/<item-id>/add more/general-api-token" > /tmp/cue-align-env.tmp
op run --env-file /tmp/cue-align-env.tmp -- bunx wrangler whoami
```

## Skills

Project scope（`.agents/skills`）で導入済み：

- `mpppk/skills`（全件）
- `helpfeel/cosense-cli`（全件: `cosense`, `version-bump`）
- `mattpocock/skills` から `productivity/grilling`, `engineering/domain-modeling`

追加は `gh skill install <repo> --all --scope project --agent opencode` または個別指定で行う。

## CI

- `.github/workflows/check.yml` で `vp install`, `vp check`, `vp test`, `vp build` を実行（`voidzero-dev/setup-vp@v1` 使用）。

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
