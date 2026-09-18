# 弘文社 プライスカード作成

GitHub Pagesでそのまま公開できる、ブラウザ完結型のプライスカード作成アプリです。

## 主な機能

- 商品写真アップロード
- 日本語商品名 / 英語商品名
- 価格 / 税込表示
- シンプル / 手書き風 の2デザイン
- 名刺サイズ 91×55mm / A7 105×74mm
- 写真を左配置 / 上配置
- PNG保存（300dpi相当）
- 印刷
- 商品登録
  - Firebase未設定: ブラウザのlocalStorageに保存
  - Firebase設定済み: Firestoreに保存

## GitHub Pagesで公開

1. GitHubで新しいリポジトリを作成（例: `kobunsha-price-card`）
2. このフォルダ内のファイルをアップロード
3. GitHubの `Settings` → `Pages`
4. `Deploy from a branch` を選択
5. `main` / `/ (root)` を選択して保存
6. 数分後に表示されたURLをiPadやPCで開く

## Firebaseを使う場合

1. Firebase Consoleでプロジェクト作成
2. Webアプリを追加
3. Firestore Databaseを作成
4. `firebase-config.js` の `window.FIREBASE_CONFIG` に設定値を貼り付け
5. Firestoreのルールを設定

> 注意: FirebaseのWeb設定値は公開される前提の値です。安全性はFirestoreルールで担保してください。

### 社内運用の推奨

本番利用ではFirebase Authenticationを追加し、Firestoreルールを次のようにするのがおすすめです。

```txt
match /priceCards/{docId} {
  allow read, write: if request.auth != null;
}
```

## 補足

商品写真をFirestoreドキュメント内にData URLで保存すると、画像サイズによってはFirestoreの1MB上限に達します。商品数が増える場合は、画像はFirebase Storageに保存し、Firestoreには画像URLだけを保存する構成に変更してください。
