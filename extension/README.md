# 紹介案件管理 セールスハブ連携（Chrome 拡張）

1. この `extension` フォルダ（または配布 zip を解凍したフォルダ）を用意
2. Chrome で `chrome://extensions` → 右上「デベロッパーモード」ON
3. 「パッケージ化されていない拡張機能を読み込む」→ このフォルダを選択
4. ツールバーの拡張アイコンを開き、ツールのURLと接続トークン（ツールの 設定 → セールスハブ連携）を貼って保存
5. Chrome で https://saleshub.jp にログインしておく

Chrome が起動している間、5分おきに `saleshub.jp/my/messages` を取得し、ツールの `/api/saleshub/ingest` に HTML を送ります。
ログイン情報（Cookie）はツールへ送られません。解析・通知・MTG自動登録はツール側で行います。
