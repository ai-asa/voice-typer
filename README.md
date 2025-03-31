# Voice Typer

音声認識でテキスト入力を行うデスクトップアプリケーション

## 概要

Voice Typerは、タイピングの代わりに音声認識で文字を入力するためのツールです。最小限のショートカットキーとマイクで音声入力ができるように設計されています。あくまで個人用に開発したアプリケーションです。

![Voice Typerのスクリーンショット](https://github.com/user-attachments/assets/4ca317d2-a41e-4956-aa76-28923bfdaa14)

## 主な機能

- Whisperによる高精度な音声認識
- GPT-4oモデルによる文章校正機能
- グローバルショートカットキーによる簡単操作
- 認識したテキストの自動クリップボードコピー
- カスタマイズ可能なシステムプロンプト

## 必要条件

- マイク
- OpenAI APIキー
- Node.js (v16以上推奨)
- npm (v8以上推奨)

## インストール方法

1. リポジトリをクローンまたはダウンロードします
   ```
   git clone https://github.com/yourusername/voice-typer.git
   cd voice-typer
   ```

2. 依存パッケージをインストールします
   ```
   npm install
   ```

3. アプリケーションをビルドします
   ```
   npm run build
   ```

## 実行方法

アプリケーションを起動するには以下のコマンドを実行します：

```
npm run start
```

初回起動時に設定画面でOpenAI APIキーを設定してください。

## 使用方法

### ショートカットキー

- **Ctrl + Space**: 通常モードで音声認識開始（キーを離すと停止）
- **Shift + Space**: 校正モードで音声認識開始（キーを離すと停止）
- **Ctrl + V**: テキストリセット
- **Alt + Shift + D**: 開発者ツールを開く

### 通常モード

Ctrl + Spaceを押しながら話すと、音声がテキストに変換されメインテキストエリアに追加されます。認識されたテキストは自動的にクリップボードにコピーされます。

![通常音声認識モードのスクリーンショット](https://github.com/user-attachments/assets/1aef5917-8ffc-4e09-a874-7f51da4f7e8c)

### 校正モード

1. まず通常モードでメインテキストを入力
2. Shift + Spaceを押しながら校正指示を話す
3. GPT-4oが指示に基づいてメインテキストを修正
4. 修正されたテキストは自動的にクリップボードにコピーされる

![校正モードのスクリーンショット](https://github.com/user-attachments/assets/d365e75e-980d-4244-963b-fcc77a0648eb)

## 設定

アプリケーション内の「設定」ボタンから以下の設定が可能です：

- マイクデバイスの選択
- OpenAI APIキーの設定
- システムプロンプトのカスタマイズ（校正時のGPT-4oへの指示）

![設定画面のスクリーンショット](https://github.com/user-attachments/assets/c110deb3-ee46-4996-8f6a-712ff69b62b7)

## 技術スタック

- Electron
- React
- TypeScript
- OpenAI API (Whisper, GPT-4o)
- TailwindCSS

## 注意事項

- このアプリケーションは個人利用を目的として開発されたものです
- OpenAI APIの使用には料金が発生します
- 音声認識の精度は環境やマイクの品質に依存します

## ライセンス

ISC
