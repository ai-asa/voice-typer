const { contextBridge, ipcRenderer, clipboard } = require('electron')

let isRecordingForCorrection = false;

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, data) => {
      ipcRenderer.send(channel, data)
    },
    on: (channel, func) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args))
    },
    once: (channel, func) => {
      ipcRenderer.once(channel, (event, ...args) => func(...args))
    },
    removeListener: (channel, func) => {
      ipcRenderer.removeListener(channel, func)
    }
  },
  startRecording: () => {
    return new Promise((resolve) => {
      console.log('startRecording called in preload');
      // 新しいイベント名を使用して、renderer.tsxのリスナーと競合しないようにする
      ipcRenderer.once('internal-start-recording', (event, data) => {
        console.log('internal-start-recording event received in preload', data);
        isRecordingForCorrection = data.isCorrection;
        resolve();
      });
      // main.jsに新しいイベントを要求
      ipcRenderer.send('request-start-recording');
    });
  },
  getIsRecordingForCorrection: () => {
    console.log('getIsRecordingForCorrection called:', isRecordingForCorrection);
    return isRecordingForCorrection;
  },
  stopRecording: () => {
    console.log('stopRecording called in preload');
    ipcRenderer.send('recording-stopped');
  },
  onStopRecording: (callback) => {
    console.log('onStopRecording listener added in preload');
    ipcRenderer.on('stop-recording', callback);
  },
  onResetText: (callback) => {
    console.log('onResetText listener added in preload');
    ipcRenderer.on('reset-text', callback);
  },
  writeToClipboard: async (text) => {
    if (!text) {
      return false;
    }
    try {
      const result = await ipcRenderer.invoke('write-to-clipboard', text);
      return result.success;
    } catch (error) {
      console.error('クリップボード操作エラー:', error);
      return false;
    }
  },
  onKeyPress: (callback) => {
    window.addEventListener('keydown', callback);
  },
  minimize: () => {
    ipcRenderer.send('minimize-window');
  },
  close: () => {
    ipcRenderer.send('close-window');
  },
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || ''
  }
});
