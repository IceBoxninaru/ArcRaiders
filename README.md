# ArcRaiders

ArcRaiders のマップにピンを置いて、攻略情報や集合場所、敵の位置メモを共有できる Web アプリです。  
フロントエンドは React + Vite、配信サーバーは Flask、公開は Docker + AWS EC2 で行います。

この README は、アプリを初めて見る人でも「何ができるか」「どう使うか」「どう構築するか」が分かるようにまとめています。

## 提出情報

- GitHub リポジトリ URL: `https://github.com/IceBoxninaru/ArcRaiders`
- EC2 動作確認 URL: `http://18.212.71.82/`
- 使用技術: React 19 / Vite 7 / Flask 3 / Gunicorn / Docker / Docker Compose / GitHub Actions / Firebase Firestore

補足:

- 今回は Elastic IP を使っていないため、AWS Academy / Vocareum の lab を再起動すると公開 IP が変わる可能性があります。
- URL が変わった場合は、README の動作確認 URL と GitHub Secrets の `EC2_HOST` を更新してください。

## このアプリでできること

- ArcRaiders の各マップを表示して、戦術メモをピンで可視化できます。
- 敵、アイテム、補給地点、カスタムピンなど、種類ごとにピンを置けます。
- ピンに名前やメモを付けて、あとから見返せます。
- 複数のマップを切り替えて確認できます。
- ローカルモードでは、自分のブラウザ内だけでメモを保存できます。
- 共有モードでは、ルーム ID を使って他の人と同じマップ情報を共有できます。
- 共有リンクのコピーや、現在の画面のスクリーンショット保存ができます。
- プロファイルを分けて、用途別にマーカー構成を保存できます。

## 初めて使う人向けの使い方

### 1. アプリを開く

ブラウザで次の URL を開きます。

```text
http://18.212.71.82/
```

### 2. モードを選ぶ

起動直後にモード選択が表示されます。

- `ローカル`
  - 自分のブラウザだけで使うモードです。
  - とりあえず試したいときに向いています。
- `共有（オンライン）`
  - ルーム ID を使って他の人と同じデータを共有するモードです。
  - チームで攻略情報をまとめたいときに向いています。

### 3. マップを選ぶ

画面上部のマップ選択欄から、表示したいマップを選びます。  
マップによっては地上 / 地下レイヤーの切り替えもできます。

### 4. ピンを置く

- `Drop Pin` ボタン、またはサイドバーのピン一覧から使いたい種類を選びます。
- マップ上の置きたい位置をクリックまたはタップします。
- ピン名やメモを入力して追加します。

### 5. ピンを整理する

- 置いたピンは編集、削除ができます。
- 検索欄を使うと、名前やメモで絞り込めます。
- プロファイルを追加すれば、用途別に構成を分けられます。

### 6. 共有モードを使う

- `共有（オンライン）` を選びます。
- `ルームID発行` で新しい部屋を作るか、既存のルーム ID を入力して参加します。
- オーナーは参加者を承認できます。
- `共有` ボタンでリンクをコピーし、他の人に送れます。

### 7. 画像として保存する

右上のダウンロードボタンを押すと、現在のマップ画面を画像として保存できます。

## 画面の見方

- 上部:
  - マップ切り替え、プロファイル管理、共有ボタン、スクリーンショット保存
- 左側サイドバー:
  - ピンの種類一覧、検索、フィルタ
- 中央:
  - 実際のマップ表示エリア
- 共有モード時:
  - ルーム ID、オーナー承認、共有メンバー向けの同期 UI が有効

## システム構成

- React + Vite でフロントエンドを build します。
- Flask が build 済みの `dist` を配信します。
- Flask は `/config.js` で Firebase 設定を実行時に注入します。
- Gunicorn が本番用 WSGI サーバーとして動きます。
- Docker multi-stage build で、Node 側 build と Python 側配信を 1 イメージにまとめています。
- EC2 には Docker と Git だけを入れ、アプリ依存はすべてコンテナ内に閉じ込めています。

## ディレクトリ構成

- `src/`
  - React フロントエンド
- `backend/app.py`
  - Flask アプリ本体
- `public/`
  - マップ画像やアイコンなどの静的ファイル
- `Dockerfile`
  - multi-stage build 定義
- `docker-compose.yml`
  - EC2 起動用 Compose 定義
- `.env.production.example`
  - 本番用環境変数テンプレート
- `.github/workflows/deploy.yml`
  - GitHub Actions の自動デプロイ設定

## 環境変数

### EC2 / Docker 実行用

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

配置場所:

- EC2 では `/opt/arcraiders/.env.production` に置きます。
- `docker-compose.yml` と同じ階層に置く必要があります。

意味:

- `FIREBASE_*`
  - Firebase の Web アプリ設定値です。
- `APP_ID`
  - Firestore 上の保存先パスを分ける識別子です。
- `INITIAL_AUTH_TOKEN`
  - カスタムトークン認証を使う場合に設定します。通常は空欄で問題ありません。
- `DISABLE_FIREBASE`
  - `true` にすると共有機能を止めてローカルモード中心で動かせます。

Firebase をまだ使わない場合は、`FIREBASE_*` を空欄にして `DISABLE_FIREBASE=true` で起動できます。

実際の Firebase 値を含む `.env.production` は GitHub には置かず、必要な人にだけ個別連絡で共有します。  
GitHub にはテンプレートとして `.env.production.example` だけを置きます。

### ローカルの Vite 開発用

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_APP_ID=arcraidersmap
```

配置場所:

- ローカル開発ではプロジェクト直下の `.env` に置きます。
- 例: `ArcRaiders/.env`

## ローカルで動かす方法

Node.js が入っている PC 上で行います。

### 開発サーバーを使う場合

```bash
npm ci
cp .env.example .env
npm run dev
```

起動後:

- 画面: `http://localhost:5173/`

### Docker で本番相当を確認する場合

```bash
cp .env.production.example .env.production
docker compose up --build
```

このとき作る `.env.production` の場所は、プロジェクト直下です。

- 例: `ArcRaiders/.env.production`

起動後:

- 画面: `http://localhost/`
- ヘルスチェック: `http://localhost/api/health`

## EC2 に手動デプロイする方法

この課題では、EC2 に Node.js や Python を直接入れず、Docker と Git だけを入れて動かします。

### 1. AWS で EC2 を作る

- OS: Ubuntu 24.04
- Instance type: `t3.small` 以上推奨
- Security Group:
  - `22/tcp`: 自分の IP のみ
  - `80/tcp`: `0.0.0.0/0`
- Elastic IP は必須ではない

補足:

- Elastic IP を使わない場合、公開 IPv4 が変わることがあります。

### 2. SSH で入る

```bash
ssh -i /path/to/your-key.pem ubuntu@<EC2のPublicIPv4>
```

### 3. Docker と Git を入れる

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
newgrp docker

docker --version
docker compose version
```

### 4. リポジトリを置く

```bash
sudo mkdir -p /opt/arcraiders
sudo chown -R $USER:$USER /opt/arcraiders
git clone https://github.com/IceBoxninaru/ArcRaiders /opt/arcraiders
cd /opt/arcraiders
```

### 5. 本番用 env を作る

```bash
cp .env.production.example .env.production
nano .env.production
```

作成場所:

- `/opt/arcraiders/.env.production`

注意:

- 実際の Firebase 値が入った `.env.production` は GitHub に push しません。
- 共有したい相手には、個人の連絡先で `.env.production` の内容だけを送って、各自で `/opt/arcraiders/.env.production` を作成してもらいます。

共有機能を使う場合の例:

```env
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
FIREBASE_MEASUREMENT_ID=...
APP_ID=arcraidersmap
INITIAL_AUTH_TOKEN=
DISABLE_FIREBASE=false
```

共有機能を使わず、まず起動確認だけしたい場合の例:

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
DISABLE_FIREBASE=true
```

### 6. Docker で起動する

```bash
docker compose up -d --build
docker compose ps
curl http://localhost/api/health
```

正常なら次が返ります。

```json
{"status":"ok","service":"arcraiders-web"}
```

ブラウザでは次を開きます。

```text
http://<EC2のPublicIPv4>/
```

## GitHub Actions による自動デプロイ

`main` へ push すると、GitHub Actions がビルド検証と EC2 への SSH デプロイを行います。

流れ:

1. `npm ci`
2. `npm run build`
3. `docker build`
4. EC2 へ SSH 接続
5. `git pull --ff-only`
6. `docker compose up -d --build --remove-orphans`
7. `curl http://localhost/api/health`

登録する GitHub Secrets:

- `EC2_HOST`
- `EC2_PORT`
- `EC2_USER`
- `EC2_SSH_KEY`

設定例:

- `EC2_HOST`: 現在の Public IPv4
- `EC2_PORT`: `22`
- `EC2_USER`: `ubuntu`
- `EC2_SSH_KEY`: PEM ファイルの中身

注意:

- Elastic IP を使わない場合、IP が変わったら `EC2_HOST` を更新する必要があります。
- `.env.production` は自動生成されないため、初回は EC2 上に手動で置く必要があります。
- GitHub-hosted runner から SSH する場合、Security Group の `22/tcp` を自分の IP だけにしていると接続できません。

## 動作確認

今回確認できたこと:

- EC2 上で `docker compose up -d --build` が成功する
- `docker compose ps` で `arcraiders-web` が `Up` になる
- `curl http://localhost/api/health` が成功する
- `http://18.212.71.82/` にブラウザからアクセスできる

## 開かないときの確認

- Security Group で `80/tcp` が開いているか
- EC2 の Public IPv4 が変わっていないか
- `docker compose ps` で `arcraiders-web` が `Up` か
- `docker compose logs -f` にエラーがないか
- EC2 内で `curl http://localhost/api/health` が通るか
- `.env.production` の `DISABLE_FIREBASE` や Firebase 値に誤字がないか

## 工夫点

- React 製の既存 UI をそのまま捨てず、Flask + Gunicorn で配信する形に組み替えて課題条件へ合わせました。
- Firebase 設定をビルド時固定ではなく `/config.js` に逃がし、実行時に切り替えられる構成にしました。
- Docker multi-stage build を使い、Node の build と Python の配信を 1 つの Dockerfile にまとめました。
- `docker-compose.yml` と `.env.production` を使い、EC2 側では `docker compose up -d --build` だけで更新できるようにしました。
- Firebase を使わない場合でも `DISABLE_FIREBASE=true` で起動確認できるようにして、デプロイ検証のしやすさを上げました。

## 苦労点

- 元の構成が GitHub Pages 寄りだったため、EC2 上で Flask アプリとして成立するように責務を整理し直す必要がありました。
- フロントエンドのビルド成果物を Flask 配信に自然につなぐため、ファイル構成と起動方法の見直しが必要でした。
- Firebase の共有機能を残しつつ、Firebase なしでも落ちないようにローカルモードとの両立を作るのに調整が必要でした。
- AWS Academy / Vocareum 環境では権限失効や Public IPv4 の変更があり、接続確認とデプロイ手順を通常の AWS より慎重に整理する必要がありました。

## まとめ

このアプリは、ArcRaiders の戦術共有を目的にした Web アプリで、以下を一通り実現しています。

- Flask を使った Web アプリ構成
- Dockerfile によるコンテナ化
- Docker Compose による起動
- AWS EC2 への公開
- GitHub によるソースコード管理
- README による構築・利用手順の明文化
