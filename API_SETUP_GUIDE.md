# 🎫 ライブ情報API設定ガイド

## 🎪 Ticketmaster Discovery API（推奨・無料）

### **取得手順**
1. **https://developer.ticketmaster.com/products-and-docs/apis/getting-started/** にアクセス
2. **「Get your API Key」**をクリック
3. **アカウント作成**（無料）
4. **Consumer Key（APIキー）**を取得

### **制限**
- **無料版**: 5,000リクエスト/日
- **レート制限**: 5リクエスト/秒
- **データ**: 全世界のライブ情報

### **日本のイベント特化**
- 東京・横浜エリアの主要会場データあり
- 国際的アーティストの日本公演情報
- チケット販売リンク付き

---

## 🎫 代替情報源（即利用可能）

### **1. eプラス（Webスクレイピング）**
- **URL**: `https://eplus.jp/`
- **特徴**: 日本最大級のチケット販売
- **対象**: 横浜・東京の主要ライブ

### **2. チケットぼん（API風アクセス）**
- **URL**: `https://www.ticketweb.jp/`
- **特徴**: ライブハウス系に強い
- **対象**: 小規模〜中規模会場

### **3. Livehouse.in（オープンデータ）**
- **URL**: `https://livehouse.in/`
- **特徴**: ライブハウス情報特化
- **対象**: インディーズ・地下系

---

## 🔧 設定方法

### **Ticketmaster APIキー設定**
```bash
# 取得後、APIキーを設定
echo 'TICKETMASTER_API_KEY=your-api-key-here' >> ~/ai-agent-ecosystem/.env
```

### **即座テスト実行**
```bash
cd ~/ai-agent-ecosystem
node -e "
const LiveEventsIntegration = require('./src/integrations/live-events-integration');
const liveEvents = new LiveEventsIntegration();
liveEvents.testAPIs().then(console.log);
"
```

---

## 🎯 完全稼働時の威力

### **516人のアーティスト監視**
- **毎日自動チェック**: フォロー中全アーティスト
- **即座通知**: 新ライブ発表時にDiscord通知
- **Notion管理**: ライブ情報・参加予定・チケット状況

### **地域特化フィルター**
```
横浜エリア: 横浜アリーナ、パシフィコ横浜、赤レンガ
東京エリア: 東京ドーム、武道館、Zepp、各ライブハウス
```

### **自動カレンダー連携**
```
ライブ発見 → Notion記録 → Google Calendar追加 → チケット購入リマインド
```

---

**APIキー取得は5分程度で完了し、即座にシステムが大幅パワーアップします！**