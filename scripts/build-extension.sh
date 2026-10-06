#!/bin/sh
# Chrome 拡張を zip にまとめて public/ に置く（ツールの設定画面からダウンロードできる）
cd "$(dirname "$0")/../extension" && rm -f ../public/saleshub-extension.zip && zip -qr ../public/saleshub-extension.zip manifest.json background.js popup.html popup.js icon128.png README.md && echo "public/saleshub-extension.zip を更新しました"
