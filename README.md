# CCPM 禱告山祭壇服事系統

## 專案設定

### 前置需求
- Node.js (建議 v20 版本)
- npm

### 安裝步驟
1. 複製 (Clone) 此專案
2. 安裝相依套件：
   ```bash
   npm install
   ```


### 開發模式
啟動開發伺服器（同時包含前端網站與後端 API）：
```bash
npm run dev
```
應用程式將會在 `http://localhost:3000` 啟動。

### 資料庫管理
開啟 Prisma Studio 資料庫管理介面（可直接檢視與修改後端資料）：
```bash
npm run db:studio
```
介面將會在 `http://localhost:5555` 啟動。

### 建置專案
建置生產環境版本：
```bash
npm run build
```

## 部署

本專案已設定使用 GitHub Actions 自動部署至 GitHub Pages。

1.前往 GitHub 專案的 **Settings** (設定)。
2. 點選左側的 **Pages**。
3. 在 **Build and deployment** (建置與部署) 下方，將 Source (來源) 選擇為 **GitHub Actions**。
4. 將您的程式碼推送到 `main` 或 `master` 分支。
5. 部署流程將會自動觸發。

## 專案結構
- `src/`: 原始碼
- `dist/`: 建置輸出檔 (執行 build 後產生)
- `.github/workflows/`: GitHub Actions 設定檔
