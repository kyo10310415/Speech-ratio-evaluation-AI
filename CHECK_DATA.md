# データ確認ガイド

## 🔍 問題の確認

### 問題1: 担当者列が空欄
- UIに「-」が表示されている
- `person_name` が取得できていない可能性

### 問題2: 混乱率が全て30%
- すべてのデータで同じ値になっている
- Google Sheetsのデータに問題がある可能性

---

## 📊 Render Shell での確認コマンド

### ステップ1: Google Sheets のデータを確認

```bash
cd /opt/render/project/src

node -e "
import { sheetsService } from './src/services/sheetsService.js';

(async () => {
  await sheetsService.initialize();
  
  // sales_evaluations シートを取得
  const data = await sheetsService.getSheetData('sales_evaluations');
  
  console.log('📊 ヘッダー行:');
  console.log(data[0]);
  console.log('');
  
  // person_name の列番号を確認
  const personNameIdx = data[0].indexOf('person_name');
  const confusionIdx = data[0].indexOf('confusion_ratio_est');
  
  console.log('🔍 列番号:');
  console.log('  person_name:', personNameIdx);
  console.log('  confusion_ratio_est:', confusionIdx);
  console.log('');
  
  // 最初の5行のデータを表示
  console.log('📝 最初の5行のデータ:');
  data.slice(1, 6).forEach((row, i) => {
    console.log(\`Row \${i+1}:\`);
    console.log('  month:', row[0]);
    console.log('  subfolder:', row[1]);
    console.log('  person_name:', row[personNameIdx]);
    console.log('  confusion_ratio_est:', row[confusionIdx]);
    console.log('  status:', row[data[0].indexOf('status')]);
    console.log('');
  });
  
  process.exit(0);
})();
"
```

---

## 🔧 予想される問題と解決策

### 問題1: person_name が空

#### **原因A: Y列のデータが書き込まれていない**
- セールス評価ジョブがまだ実行されていない
- または、古いバージョンで実行された

**解決策**: 再度セールス評価を実行
```bash
cd /opt/render/project/src

CURRENT_MONTH=$(date -u +"%Y-%m")
node -e "
import { runSalesEvaluation } from './src/jobs/salesEvaluation.js';
runSalesEvaluation('$CURRENT_MONTH').then(() => process.exit(0));
"
```

#### **原因B: person_name が Y列以外にある**
- ヘッダーの順番が違う可能性

**確認方法**: ステップ1のコマンドでヘッダーを確認

---

### 問題2: 混乱率が全て30%

#### **原因A: Google Sheets のデータが実際に30%**
- 評価ジョブでデフォルト値が使用されている
- 感情分析が正しく動作していない

**確認方法**: ステップ1のコマンドで実際の値を確認

#### **原因B: confusion_ratio_est が空で、デフォルト値0を使用**
```javascript
confusion_ratio: parseFloat(row[headers.indexOf('confusion_ratio_est')] || 0)
```
この場合、0が返されるはず。30%になる理由が不明。

**解決策**: Google Sheets で直接確認
- https://docs.google.com/spreadsheets/d/1gFrIbkRxNcpKuT0vRNfaUdSrJWynlCdfqhGQz9vWwWo/edit
- `sales_evaluations` シート
- O列（confusion_ratio_est）の値を確認

---

## 🎯 クイック診断コマンド

```bash
cd /opt/render/project/src && node -e "import { sheetsService } from './src/services/sheetsService.js'; (async () => { await sheetsService.initialize(); const data = await sheetsService.getSheetData('sales_evaluations'); const personNameIdx = data[0].indexOf('person_name'); const confusionIdx = data[0].indexOf('confusion_ratio_est'); console.log('person_name列:', personNameIdx); console.log('confusion_ratio_est列:', confusionIdx); console.log(''); console.log('サンプルデータ:'); data.slice(1, 4).forEach((row, i) => { console.log(\`Row \${i+1}: person=\${row[personNameIdx]}, confusion=\${row[confusionIdx]}\`); }); process.exit(0); })();"
```

---

## 📝 次のステップ

1. **Render Shell で上記コマンドを実行**
2. **結果を確認**
3. **問題に応じて対応**:
   - person_name が空 → セールス評価を再実行
   - confusion_ratio_est が全て0.3 → 感情分析の問題を調査
   - confusion_ratio_est が空 → デフォルト値の問題

---

**まず診断コマンドを実行して結果を教えてください！**
