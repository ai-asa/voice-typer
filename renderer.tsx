import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import * as ReactDOM from 'react-dom/client';
import OpenAI from 'openai';
import './styles.css';

const App = () => {
  const [isListening, setIsListening] = useState(false);
  const [text, setText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [systemPrompt, setSystemPrompt] = useState(localStorage.getItem('system_prompt') || '');
  const [correctionText, setCorrectionText] = useState('');
  const [isGlobalListening, setIsGlobalListening] = useState(false);
  const [isCorrection, setIsCorrection] = useState(false);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState(localStorage.getItem('selected_mic') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [lastKeyPress, setLastKeyPress] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success', visible: false });

  // 最新のfinalTextの値を追跡するためのref
  const finalTextRef = useRef('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const openai = new OpenAI({
    apiKey: apiKey || (window as any).electron?.env?.OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
  });

  // finalTextが更新されるたびにrefも更新
  useEffect(() => {
    finalTextRef.current = finalText;
  }, [finalText]);

  useEffect(() => {
    // テキストリセットイベントのリスナー
    const electron = (window as any).electron;
    if (electron?.onResetText) {
      electron.onResetText(() => {
        console.log('テキストリセットイベントを受信しました');
        setFinalText('');
        showToast('メインテキストをリセットしました');
      });
    }

    // グローバルショートカットのリスナー
    // 録音開始イベントのリスナー
    const startRecordingHandler = async () => {
      console.log('録音を開始しました');
      const electron = (window as any).electron;
      
      if (!electron?.startRecording) {
        console.error('startRecording関数が見つかりません');
        return;
      }

      try {
        setIsGlobalListening(true);
        await electron.startRecording();
        const isCorrection = electron.getIsRecordingForCorrection();
        console.log('録音モード:', isCorrection ? '校正' : '通常');
        
        // 校正モードの場合は前回の校正テキストをクリア
        if (isCorrection) {
          setCorrectionText('');
        }
        
        handleStartRecording({ isCorrection });
      } catch (error) {
        console.error('録音開始エラー:', error);
        setIsGlobalListening(false);
        showToast('録音の開始に失敗しました', 'error');
      }
    };

    const stopRecordingHandler = () => {
      console.log('録音を終了しました');
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsListening(false);
      setIsGlobalListening(false);
      
      // 録音終了時に録音状態のみリセット
      setIsCorrection(false);
      
      const electron = (window as any).electron;
      if (electron?.stopRecording) {
        electron.stopRecording();
      }
    };

    // マイクデバイスを取得
    const updateDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        if (audioInputs.length === 0) {
          console.warn('マイクデバイスが見つかりませんでした。');
        }
        setMicDevices(audioInputs);
        if (audioInputs.length > 0 && !selectedMic) {
          setSelectedMic(audioInputs[0].deviceId);
        }
      } catch (error) {
        console.error('デバイスの取得に失敗しました:', error);
        setMicDevices([]);
      }
    };

    if (electron?.ipcRenderer) {
      electron.ipcRenderer.on('start-recording', startRecordingHandler);
    }

    if (electron?.onStopRecording) {
      electron.onStopRecording(stopRecordingHandler);
    }

    // 初期デバイスリスト取得
    updateDevices().catch(error => {
      console.error('デバイスの取得に失敗しました:', error);
      setMicDevices([]);
    });

    // マイクアクセス許可後にデバイスリストを更新
    navigator.mediaDevices.addEventListener('devicechange', updateDevices);

    // クリーンアップ関数
    return () => {
      if (electron?.ipcRenderer) {
        electron.ipcRenderer.removeListener('start-recording', startRecordingHandler);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      navigator.mediaDevices.removeEventListener('devicechange', updateDevices);
    };
  }, [isListening, selectedMic]);

  type RecordingMode = {
    isCorrection: boolean;
  };

  const handleStartRecording = async (mode: RecordingMode): Promise<void> => {
    setIsListening(true);
    setIsCorrection(mode.isCorrection);
    try {
      const constraints = selectedMic ? { 
        audio: { 
          deviceId: { exact: selectedMic } 
        } 
      } : { audio: true };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      // 録音開始時にデータ収集を開始
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start();

      // モードを確実に保持
      const currentMode = mode;

      recorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          const audioFile = new File([audioBlob], 'recording.wav');

          const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: "whisper-1",
          });
          const newText = transcription.text.trim();

          if (currentMode.isCorrection) {
            // 校正モードの場合は校正用テキストエリアに保存
            setCorrectionText(newText);
            
            try {
              // クリップボードにコピー
              const writeToClipboard = (window as any).electron?.writeToClipboard;
              if (writeToClipboard) {
                await writeToClipboard(newText);
                showToast('校正テキストをクリップボードにコピーしました');
              }
              
              // 最新のfinalTextの値を使用
              const currentFinalText = finalTextRef.current;
              console.log('校正モード処理中のメインテキスト:', currentFinalText);
              
              // GPT-4oを使ってメインテキストを修正
              if (currentFinalText && newText) {
                showToast('テキストを修正中...', 'success');
                
                try {
                  // GPT-4oのAPIを呼び出し
                  const completion = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                      {
                        role: "system",
                        content: systemPrompt || "あなたは文章校正の専門家です。与えられた指示に従って文章を修正してください。"
                      },
                      {
                        role: "user",
                        content: `以下の文章を修正してください：\n\n${currentFinalText}\n\n修正指示：\n${newText}`
                      }
                    ],
                  });
                  
                  // 修正されたテキストを取得
                  const correctedText = completion.choices[0]?.message?.content;
                  
                  if (correctedText) {
                    // メインテキストを更新
                    setFinalText(correctedText);
                    
                    // クリップボードに修正後のテキストをコピー
                    if (writeToClipboard) {
                      await writeToClipboard(correctedText);
                      showToast('修正されたテキストをクリップボードにコピーしました');
                    }
                  } else {
                    throw new Error('GPT-4oからの応答が空でした');
                  }
                } catch (gptError) {
                  console.error('GPT-4oによるテキスト修正中にエラーが発生しました:', gptError);
                  showToast('テキスト修正中にエラーが発生しました', 'error');
                }
              } else {
                // メインテキストまたは校正指示が空の場合
                if (!currentFinalText) {
                  console.log('メインテキストが空です。現在の値:', currentFinalText);
                  showToast('メインテキストが空のため修正できません', 'error');
                }
              }
            } catch (error) {
              console.error('クリップボードへのコピーに失敗しました:', error);
              showToast('クリップボードへのコピーに失敗しました', 'error');
            }
            
            return;
          }

          // 通常モードの場合のみメインテキストを更新
          setFinalText(prevText => {
            const updatedText = (prevText + ' ' + newText).trim();
            
            // クリップボードにコピー
            try {
              const writeToClipboard = (window as any).electron?.writeToClipboard;
              if (typeof writeToClipboard !== 'function') {
                throw new Error('writeToClipboard関数が見つかりません');
              }

              writeToClipboard(updatedText).then((result: boolean) => {
                if (result) {
                  showToast('テキストをクリップボードにコピーしました');
                } else {
                  throw new Error('クリップボードへのコピーに失敗しました');
                }
              }).catch((clipboardError: unknown) => {
                console.error('クリップボードへのコピーに失敗しました:', clipboardError);
                const errorMessage = clipboardError instanceof Error ? clipboardError.message : '不明なエラー';
                showToast(`クリップボードへのコピーに失敗しました: ${errorMessage}`, 'error');
              });

              return updatedText;
            } catch (clipboardError) {
              console.error('クリップボードへのコピーに失敗しました:', clipboardError);
              const errorMessage = clipboardError instanceof Error ? clipboardError.message : '不明なエラー';
              showToast(`クリップボードへのコピーに失敗しました: ${errorMessage}`, 'error');
              return updatedText;
            }
          });
        } catch (error) {
          console.error('音声認識処理中にエラーが発生しました:', error);
          showToast('音声認識中にエラーが発生しました', 'error');
        }
      };

    } catch (error) {
      console.error('Error accessing microphone:', error);
      showToast('マイクへのアクセスに失敗しました', 'error');
      setIsListening(false);
      setIsGlobalListening(false);
    }
  };

  const saveSettings = () => {
    localStorage.setItem('openai_api_key', apiKey);
    localStorage.setItem('selected_mic', selectedMic);
    localStorage.setItem('system_prompt', systemPrompt);
    setShowSettings(false);
  };

  return (
    <div className="flex flex-col h-screen bg-white app-container">
      <div className="titlebar-container">
        <div className="titlebar">
          <div className="titlebar-drag-region">
            <div className="flex items-center">
              <h1>Voice Typer</h1>
            </div>
          </div>
          <div className="titlebar-buttons">
            <button
              onClick={() => (window as any).electron?.minimize()}
              className="titlebar-button"
            >
              ─
            </button>
            <button
              onClick={() => (window as any).electron?.close()}
              className="titlebar-button close"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 window-content">
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="mb-4 bg-blue-500 text-white px-3 py-1 rounded"
        >
          設定
        </button>

        {showSettings && (
          <div className="mb-4 p-4 bg-white rounded shadow">
            <h2 className="text-lg font-semibold mb-2">設定</h2>
            <div className="mb-3">
              <label className="block mb-1">マイクデバイス</label>
              <select
                value={selectedMic}
                onChange={(e) => setSelectedMic(e.target.value)}
                className="w-full p-2 border rounded"
              >
                {micDevices.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `マイク ${micDevices.indexOf(device) + 1}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="block mb-1">OpenAI APIキー</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="mb-3">
              <label className="block mb-1">システムプロンプト</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="校正のための指示を入力してください"
                className="w-full p-2 border rounded h-32"
              />
            </div>
            <button
              onClick={saveSettings}
              className="bg-green-500 text-white px-4 py-2 rounded"
            >
              保存
            </button>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <div className={`mb-2 p-2 rounded ${isListening && !isCorrection ? 'bg-green-100' : 'bg-gray-100'}`}>
              {isListening && !isCorrection ? '音声認識中...' : 'メインテキスト入力：Ctrl + Spaceを押しながら話してください'}
            </div>
            <div className="p-4 border rounded bg-white text-area">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メインテキスト
              </label>
              <div className="whitespace-pre-wrap">
                {finalText}
                <span className="text-gray-500">{text}</span>
              </div>
            </div>
          </div>

          <div>
            <div className={`mb-2 p-2 rounded ${isListening && isCorrection ? 'bg-green-100' : 'bg-gray-100'}`}>
              {isListening && isCorrection ? '音声認識中...' : '校正指示テキストの入力：Shift + Spaceを押しながら話してください'}
            </div>
            <div className="p-4 border rounded bg-gray-50 text-area">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                校正指示テキスト
              </label>
              <div className="whitespace-pre-wrap">
                {correctionText}
              </div>
            </div>
          </div>
        </div>
      </div>
      {toast.visible && (
        <div className={`fixed bottom-4 right-4 p-4 rounded shadow-lg ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
