# 先生向け手順

このファイルは、先生がこのリポジトリを `git clone` してから、

1. Docker でローカル起動する
2. 動作確認する
3. 必要なら EC2 へデプロイする

までを、最短で進められるようにまとめたものです。

詳細版は [README.md](./README.md) を見てください。ここでは最短手順だけに絞ります。

## 1. 前提

必要なもの:

- Git
- Docker Desktop
  または Docker Engine + Docker Compose Plugin

確認コマンド:

```bash
git --version
docker --version
docker compose version
```

## 2. リポジトリを clone する

```bash
git clone https://github.com/IceBoxninaru/ArcRaiders.git
cd ArcRaiders
```

## 3. `.env.production` を作る

Docker 起動では、プロジェクト直下に `.env.production` が必要です。
テンプレートは [`.env.production.example`](./.env.production.example) です。

macOS / Linux:

```bash
cp .env.production.example .env.production
```

PowerShell:

```powershell
Copy-Item .env.production.example .env.production
```

補足:

- 初回の起動確認だけなら、テンプレートのままでも動きます
- この場合は `DISABLE_FIREBASE=true` なので、共有機能は無効です
- 共有機能も確認する場合だけ、Firebase の実際の値を `.env.production` に入れてください

## 4. Docker で起動する

```bash
docker compose up -d --build
```

初回はイメージ取得と依存関係のインストールが入るので、数分かかることがあります。

## 5. 起動確認

状態確認:

```bash
docker compose ps
```

ヘルスチェック:

```bash
curl http://localhost/api/health
```

ブラウザ:

```text
http://localhost/
```

期待する状態:

- `docker compose ps` で `web` が `Up` になっている
- `/api/health` で `status: ok` が返る

## 6. 停止とログ確認

停止:

```bash
docker compose down
```

ログ確認:

```bash
docker compose logs -f web
```

## 7. EC2 に手動デプロイする場合

ローカル起動とは別に、EC2 上へ手動で反映したい場合の手順です。

### EC2 側の前提

- Git が入っている
- Docker / Docker Compose が入っている
- 配置先は `/opt/arcraiders-live`
- `/opt/arcraiders-live/.env.production` が事前に置かれている

初回だけ `.env.production` を EC2 に配置してください。
このファイルは GitHub には含めません。

### デプロイコマンド

```bash
tmpdir=$(mktemp -d)
git clone --depth 1 https://github.com/IceBoxninaru/ArcRaiders "$tmpdir"
sudo mkdir -p /opt/arcraiders-live
sudo chown -R "$USER":"$USER" /opt/arcraiders-live
rsync -a --delete --exclude ".git" --exclude ".env.production" "$tmpdir"/ /opt/arcraiders-live/
rm -rf "$tmpdir"

cd /opt/arcraiders-live
sudo docker compose up -d --build --remove-orphans
curl http://localhost/api/health
```

正常なら、最後の `curl` で JSON が返ります。

## 8. GitHub Actions で自動デプロイする場合

[`main` ブランチへ push](./.github/workflows/deploy.yml) すると、自動で次が実行されます。

1. `npm ci`
2. `npm run build`
3. `docker build`
4. EC2 へ SSH 接続
5. `/opt/arcraiders-live` に同期
6. `docker compose up -d --build --remove-orphans`
7. `/api/health` で確認

必要な GitHub Secrets:

- `EC2_HOST`
- `EC2_PORT`
- `EC2_USER`
- `EC2_SSH_KEY`

注意:

- EC2 上の `/opt/arcraiders-live/.env.production` は自動生成されません
- 初回だけは手動で配置が必要です

## 9. 詰まりやすい点

`.env.production` がない:

```bash
cp .env.production.example .env.production
```

PowerShell:

```powershell
Copy-Item .env.production.example .env.production
```

`docker compose` が失敗する:

- Docker Desktop が起動しているか確認してください
- `docker compose version` が通るか確認してください

`http://localhost/` が開かない:

- `docker compose ps`
- `docker compose logs -f web`

を確認してください。
