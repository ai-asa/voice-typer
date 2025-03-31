const { app, BrowserWindow, globalShortcut, ipcMain, clipboard } = require('electron')
const path = require('path')
const { GlobalKeyboardListener } = require('node-global-key-listener')

let mainWindow
let keyListener
let isRecording = false

function createWindow() {
  const { width, height } = require('electron').screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: 600,
    height: 450,
    minWidth: 400,
    minHeight: 300,
    resizable: true,
    alwaysOnTop: true,
    frame: false,
    x: Math.floor((width - 600) / 2),
    y: Math.floor((height - 450) / 2),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // ウィンドウ操作のIPC通信ハンドラー
  ipcMain.on('minimize-window', () => {
    mainWindow.minimize();
  });

  ipcMain.on('close-window', () => {
    mainWindow.close();
  });

  // クリップボード操作用のIPCハンドラー
  ipcMain.handle('write-to-clipboard', async (event, text) => {
    try {
      clipboard.writeText(text);
      return { success: true };
    } catch (error) {
      console.error('クリップボード書き込みエラー:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  mainWindow.loadFile('index.html')
  
  // デバッグ用のショートカット
  globalShortcut.register('Alt+Shift+D', () => {
    mainWindow.webContents.openDevTools();
  });
}

app.whenReady().then(() => {
  createWindow()

  // グローバルキーリスナーの設定
  keyListener = new GlobalKeyboardListener();
  
  let isCtrlPressed = false;
  let isShiftPressed = false;
  let isSpacePressed = false;
  let isVPressed = false;

  keyListener.addListener(function (e) {
    // キーの状態を更新
    if (e.name === 'LEFT CTRL' || e.name === 'RIGHT CTRL') {
      isCtrlPressed = e.state === 'DOWN';
    }
    if (e.name === 'LEFT SHIFT' || e.name === 'RIGHT SHIFT') {
      isShiftPressed = e.state === 'DOWN';
    }
    if (e.name === 'SPACE') {
      isSpacePressed = e.state === 'DOWN';
    }
    if (e.name === 'V') {
      isVPressed = e.state === 'DOWN';
    }

    // Ctrl + V の検知
    if (isCtrlPressed && isVPressed && e.state === 'DOWN') {
      console.log('Ctrl + V が検知されました: テキストリセット');
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send('reset-text');
          console.log('reset-text イベントを送信しました');
        } catch (error) {
          console.error('reset-text イベント送信エラー:', error);
        }
      }
    }

    // 録音状態の制御
    if ((isCtrlPressed || isShiftPressed) && isSpacePressed && !isRecording) {
      console.log('録音開始: キー検知', isShiftPressed ? '校正モード' : '通常モード');
      if (mainWindow && !mainWindow.isDestroyed()) {
        isRecording = true;
        try {
          // 録音モードを明確に設定
          const mode = {
            isCorrection: isShiftPressed,
            type: isShiftPressed ? 'correction' : 'normal'
          };
          mainWindow.webContents.send('start-recording', mode);
          console.log('start-recording イベントを送信しました:', mode);
        } catch (error) {
          console.error('start-recording イベント送信エラー:', error);
          isRecording = false;
        }
      }
    }
    
    if (isRecording && ((!isCtrlPressed && !isShiftPressed) || !isSpacePressed)) {
      console.log('録音停止: キーが解放された');
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          mainWindow.webContents.send('stop-recording');
          console.log('stop-recording イベントを送信しました');
        } catch (error) {
          console.error('stop-recording イベント送信エラー:', error);
        }
      }
      isRecording = false;
    }
  });

  // IPC通信のハンドラー
  ipcMain.on('recording-stopped', () => {
    isRecording = false;
  });

  // 録音開始リクエストのハンドラー
  ipcMain.on('request-start-recording', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const mode = {
        isCorrection: isShiftPressed,
        type: isShiftPressed ? 'correction' : 'normal'
      };
      mainWindow.webContents.send('internal-start-recording', mode);
      console.log('internal-start-recording イベントを送信しました:', mode);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (keyListener) {
    keyListener.kill();
  }
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// アプリケーション終了時にリソースを解放
app.on('will-quit', () => {
  if (keyListener) {
    keyListener.kill();
  }
  globalShortcut.unregisterAll();
});
