# ArcRaiders

ArcRaiders の戦術マップにピンを置いて、ローカルまたは共有ルームで情報を管理する Web アプリです。
フロントエンドは React + Vite、配信は Flask + Gunicorn、起動は Docker Compose を前提にしています。

この README は、`git clone` した直後の人が別 PC・別環境でも迷わず起動できるように、初回セットアップを中心にまとめています。

## このリポジトリの前提

- Docker で起動する場合、Node.js や Python をホスト PC に直接入れる必要はありません。
- 初回の起動確認だけなら Firebase なしでも動かせます。
- 共有機能を使う場合だけ、Firebase 用の実際の環境変数が必要です。
- 実際の `.env` / `.env.production` の値は GitHub に含めません。

仮定:

- Windows / macOS は Docker Desktop を使う
- Linux は Docker Engine と Docker Compose Plugin を使う
- すべてのコマンドは、このリポジトリを clone した直後のプロジェクト直下で実行する

## まず知っておくこと

起動方法は 2 通りあります。

1. Docker で起動する
  一番おすすめです。別 PC でも再現しやすく、README もこの方法を主線にしています。
2. Node.js で開発サーバーを起動する
  フロントエンドの開発をしたい人向けです。

## 必要なもの

### Docker で起動する場合

- Git
- Docker Desktop
  または Docker Engine + Docker Compose Plugin

確認コマンド:

```bash
git --version
docker --version
docker compose version
```

### 開発サーバーで起動する場合

- Node.js 20 系推奨
- npm

確認コマンド:

```bash
node --version
npm --version
```

## 初回セットアップ手順

### 1. clone する

```bash
git clone https://github.com/IceBoxninaru/ArcRaiders.git
cd ArcRaiders
```

### 2. 環境変数ファイルを作る

Docker 起動では `.env.production` が必要です。
テンプレートは [`.env.production.example`](./.env.production.example) です。

macOS / Linux:

```bash
cp .env.production.example .env.production
```

PowerShell:

```powershell
Copy-Item .env.production.example .env.production
```

作成場所:

- `ArcRaiders/.env.production`

重要:

- `.env.production` は GitHub に push しません
- 実際の Firebase 値が必要な場合は、管理者から個別に共有してもらいます
- 初回の起動確認だけなら、テンプレートのまま `DISABLE_FIREBASE=true` で起動できます

### 3. 起動する

```bash
docker compose up -d --build
```

起動確認:

```bash
docker compose ps
curl http://localhost/api/health
```

ブラウザ:

```text
http://localhost/
```

補足:

- この Compose はデフォルトで `80:8000` を使います
- もし `80` 番が他アプリと競合する場合は、後述の「よくあるエラー」を見てください

## 停止・再起動・ログ確認

### 停止

```bash
docker compose down
```

### 再起動

コンテナだけ再起動:

```bash
docker compose restart
```

イメージを作り直して再起動:

```bash
docker compose up -d --build
```

### ログ確認

```bash
docker compose logs -f web
```

## キャッシュや残骸を消したいとき

### まずは通常停止

```bash
docker compose down --remove-orphans
```

### ローカルに残ったイメージも消したい

```bash
docker compose down --rmi local --remove-orphans
```

### Docker build キャッシュを整理したい

```bash
docker builder prune -f
```

### それでもおかしいとき

```bash
docker system prune -f
```

注意:

- この Compose では named volume は使っていません
- そのため「消えずに残る」のは主にイメージ、コンテナ、build cache です

## 別PC・別環境で起動する場合

### 前提条件

- Git と Docker が入っていること
- プロジェクト直下でコマンドを打つこと
- 必要なら `.env.production` の実値を個別共有してもらうこと

### clone 後に必要な設定

最低限必要なのはこれだけです。

1. `git clone`
2. `.env.production` を作る
3. `docker compose up -d --build`

### `.env` の扱い

用途ごとに置き場所が違います。

- Docker 起動用: `ArcRaiders/.env.production`
- Vite 開発用: `ArcRaiders/.env`

共有相手への渡し方の例:

- GitHub には [`.env.production.example`](./.env.production.example) だけ置く
- 実際の値は個別連絡で送る
- 受け取った人は `ArcRaiders/.env.production` を自分で作る

### OSや環境差異で詰まりやすい点

- Windows PowerShell では `cp` ではなく `Copy-Item` を使う
- `localhost:80` が競合する PC では、ポート変更が必要
- Docker Desktop を起動していないと `docker compose` が失敗する
- 初回 build は Docker イメージ取得と `npm ci` が入るので時間がかかる
- Apple Silicon / ARM 環境では初回イメージ取得に少し時間がかかることがある

### 初回起動に時間がかかる理由

初回は Docker が次をまとめて行います。

- Node イメージの取得
- Python イメージの取得
- `npm ci`
- Vite build
- Python 依存の install

そのため、回線や PC によっては数分かかることがあります。

## Docker での起動方法

このリポジトリでは [docker-compose.yml](./docker-compose.yml) を使います。

内容の要点:

- `Dockerfile` の multi-stage build を使う
- フロントを build して `dist/` を作る
- Flask + Gunicorn が `dist/` を配信する
- `.env.production` をそのままコンテナへ渡す
- ヘルスチェックで `/api/health` を確認する

### デフォルトポートを変えたい場合

例: `8080` で開きたい場合

macOS / Linux:

```bash
APP_PORT=8080 docker compose up -d --build
```

PowerShell:

```powershell
$env:APP_PORT=8080
docker compose up -d --build
```

その場合の URL:

```text
http://localhost:8080/
```

## 開発サーバーで起動する方法

Docker を使わずにフロントエンドを触りたい場合だけ使ってください。

### 1. `.env` を作る

テンプレートは [`.env.example`](./.env.example) です。

macOS / Linux:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

作成場所:

- `ArcRaiders/.env`

### 2. 依存を入れて起動

```bash
npm ci
npm run dev
```

起動先:

```text
http://localhost:5173/
```

注意:

- これはフロントエンド開発用です
- Flask / Docker での本番相当起動とは少し動作が違います

## Firebase を使う場合

共有ルームやリアルタイム同期を使うときだけ必要です。

必要な値:

```env
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
FIREBASE_MEASUREMENT_ID=
APP_ID=arcraidersmap
INITIAL_AUTH_TOKEN=
DISABLE_FIREBASE=false
```

方針:

- `.env.production.example` には実値を書かない
- 実値は個別共有する
- 値を受け取った人は `ArcRaiders/.env.production` に保存する

Firebase を使わずにまず動かしたい場合:

```env
DISABLE_FIREBASE=true
```

この場合でもアプリ自体は起動できますが、共有機能は使えません。

## EC2 へ手動デプロイする場合

このリポジトリは、EC2 では Docker と Git だけを入れる前提です。

### 配置先

- 本番ディレクトリ: `/opt/arcraiders-live`
- 本番 env: `/opt/arcraiders-live/.env.production`

### 手動デプロイ例

```bash
tmpdir=$(mktemp -d)
git clone --depth 1 https://github.com/IceBoxninaru/ArcRaiders "$tmpdir"
rsync -a --delete --exclude ".git" --exclude ".env.production" "$tmpdir"/ /opt/arcraiders-live/
rm -rf "$tmpdir"

cd /opt/arcraiders-live
docker compose up -d --build
curl http://localhost/api/health
```

## GitHub Actions による自動デプロイ

[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) は、`main` push 時に次を実行します。

1. `npm ci`
2. `npm run build`
3. `docker build`
4. EC2 に SSH
5. 一時 clone を `/opt/arcraiders-live` に同期
6. `docker compose up -d --build --remove-orphans`
7. `/api/health` を確認

必要な Secrets:

- `EC2_HOST`
- `EC2_PORT`
- `EC2_USER`
- `EC2_SSH_KEY`

注意:

- `EC2_HOST` は Public IP が変わったら更新が必要
- `.env.production` は自動生成されないので、初回は EC2 上に手動配置が必要

## よくあるエラーと簡単な対処

### 1. `.env.production not found`

原因:

- `ArcRaiders/.env.production` を作っていない

対処:

```bash
cp .env.production.example .env.production
```

PowerShell:

```powershell
Copy-Item .env.production.example .env.production
```

### 2. `docker compose` が動かない

原因:

- Docker Desktop が起動していない
- Docker Engine / Compose Plugin が未インストール

対処:

```bash
docker --version
docker compose version
```

### 3. `localhost` が開かない

原因:

- コンテナが起動していない
- 80番ポートが他アプリと競合している

対処:

```bash
docker compose ps
docker compose logs -f web
```

ポート競合時:

macOS / Linux:

```bash
APP_PORT=8080 docker compose up -d --build
```

PowerShell:

```powershell
$env:APP_PORT=8080
docker compose up -d --build
```

### 4. `curl http://localhost/api/health` は通るが共有が動かない

原因:

- Firebase 値が空欄
- `DISABLE_FIREBASE=true`

対処:

- `.env.production` の Firebase 値を確認
- 共有を使うなら `DISABLE_FIREBASE=false`

### 5. 初回 build が遅い

原因:

- イメージ取得と依存 install が初回だけ重い

対処:

- 異常ではないので、まずは数分待つ
- 進捗は `docker compose logs -f web` ではなく、`docker compose up --build` 実行中の出力を見る

## ファイルごとの役割

- [Dockerfile](./Dockerfile)
  - フロント build と Flask 配信をまとめた multi-stage build
- [docker-compose.yml](./docker-compose.yml)
  - ローカル / EC2 の起動定義
- [.env.example](./.env.example)
  - Vite 開発用テンプレート
- [.env.production.example](./.env.production.example)
  - Docker / EC2 用テンプレート
- [backend/app.py](./backend/app.py)
  - Flask アプリ本体と `/config.js` / `/api/health`
- [.github/workflows/deploy.yml](./.github/workflows/deploy.yml)
  - EC2 への自動デプロイ

## 補足

この README は、まず「clone して起動できること」を優先して書いています。
共有機能まで使う場合は、追加で Firebase の実値が必要です。実値は個別共有し、GitHub には含めない運用を前提にしています。
