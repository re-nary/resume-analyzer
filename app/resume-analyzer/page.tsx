'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { FileText, Briefcase, PieChart, ArrowRight, Upload, CheckCircle, AlertCircle, Clock } from 'lucide-react';

// 型定義
interface JD {
  id: string;
  title: string;
  data: {
    position: string;
    requirements: string;
    responsibilities: string;
  };
}

interface StatusMessage {
  type: string;
  message: string;
}

interface AnalysisResult {
  適合度評価?: {
    スコア: number;
    評価理由: string;
  };
  面接質問リスト?: string[];
  掘り下げポイント?: Array<{
    ポイント: string;
    理由: string;
  }>;
  不足スキル?: Array<{
    スキル: string;
    重要度: string;
  }>;
  勤務履歴?: Array<{
    会社名: string;
    役職: string;
    期間: string;
  }>;
  error?: string;
}

export default function Home() {
  // 状態変数
  const [extractedText, setExtractedText] = useState<string>('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<StatusMessage>({ type: '', message: '' });
  const [analyzeStatus, setAnalyzeStatus] = useState<StatusMessage>({ type: '', message: '' });
  const [jdList, setJdList] = useState<JD[]>([]);
  const [selectedJd, setSelectedJd] = useState<JD | null>(null);
  const [activeTab, setActiveTab] = useState<string>('match');
  
  // 分析結果
  const [matchResult, setMatchResult] = useState<string>('分析結果がここに表示されます');
  const [questionsResult, setQuestionsResult] = useState<string>('面接質問がここに表示されます');
  const [pointsResult, setPointsResult] = useState<string>('掘り下げポイントがここに表示されます');
  const [skillsResult, setSkillsResult] = useState<string>('不足スキルがここに表示されます');
  const [historyResult, setHistoryResult] = useState<string>('勤務履歴がここに表示されます');
  const [rawResult, setRawResult] = useState<string>('生のJSONデータがここに表示されます');
  
  // Azure Functions のエンドポイントURL
  const processResumeUrl = process.env.NEXT_PUBLIC_PROCESS_RESUME_URL;
  const analyzeWithGptUrl = process.env.NEXT_PUBLIC_ANALYZE_WITH_GPT_URL;
  const manageJdUrl = process.env.NEXT_PUBLIC_MANAGE_JD_URL;
  const importJdUrl = process.env.NEXT_PUBLIC_IMPORT_JD_URL;
  
  // ページ読み込み時にJD一覧を取得
  useEffect(() => {
    loadJdOptions();
  }, []);
  
  // JD一覧を取得する関数
  const loadJdOptions = async () => {
    try {
      if (!manageJdUrl) {
        console.error('環境変数 NEXT_PUBLIC_MANAGE_JD_URL が設定されていません');
        return;
      }
      
      const response = await fetch(manageJdUrl);
      if (!response.ok) {
        throw new Error(`JD一覧の取得に失敗しました: ${response.status}`);
      }
      
      const data = await response.json();
      setJdList(data);
    } catch (error) {
      console.error('JD一覧の読み込みエラー:', error);
      setUploadStatus({ 
        type: 'error', 
        message: `JD一覧の読み込みに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}` 
      });
    }
  };
  
  // JD選択時の処理
  const handleJdChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    
    if (!selectedValue) {
      setSelectedJd(null);
      return;
    }
    
    const jd = jdList.find(item => item.id === selectedValue);
    if (jd) {
      setSelectedJd(jd);
    }
  };
  
  // ファイル選択時の処理
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setResumeFile(e.target.files[0]);
    }
  };
  
  // レジュメアップロード処理
  const handleUpload = async () => {
    if (!resumeFile) {
      setUploadStatus({ type: 'error', message: 'ファイルを選択してください' });
      return;
    }
    
    setUploadStatus({ type: 'loading', message: 'アップロード中・テキスト抽出中...' });
    
    try {
      if (!processResumeUrl) {
        console.error('環境変数 NEXT_PUBLIC_PROCESS_RESUME_URL が設定されていません');
        return;
      }
      
      const response = await fetch(processResumeUrl, {
        method: 'POST',
        body: resumeFile,
        headers: {
          'Content-Type': resumeFile.type
        }
      });
      
      if (!response.ok) {
        throw new Error(`サーバーエラー: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      setExtractedText(result.textContent);
      setUploadStatus({ type: 'success', message: 'テキスト抽出に成功しました！' });
    } catch (error) {
      setUploadStatus({ 
        type: 'error', 
        message: `エラー: ${error instanceof Error ? error.message : '不明なエラー'}` 
      });
    }
  };
  
  // GPTで分析する関数
  const handleAnalyze = async () => {
    if (!extractedText) {
      setAnalyzeStatus({ type: 'error', message: 'テキストが抽出されていません' });
      return;
    }
    
    if (!selectedJd) {
      setAnalyzeStatus({ type: 'error', message: 'JDを選択してください' });
      return;
    }
    
    setAnalyzeStatus({ type: 'loading', message: 'GPT分析中...\nこれには1〜2分程度かかる場合があります' });
    
    // 結果表示エリアをクリア
    setMatchResult('分析中...');
    setQuestionsResult('分析中...');
    setPointsResult('分析中...');
    setSkillsResult('分析中...');
    setHistoryResult('分析中...');
    setRawResult('分析中...');
    
    try {
      if (!analyzeWithGptUrl) {
        console.error('環境変数 NEXT_PUBLIC_ANALYZE_WITH_GPT_URL が設定されていません');
        return;
      }
      
      // リクエストのタイムアウト時間を延長（3分）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);
      
      // テキストが長すぎる場合は切り詰める（トークン数の概算）
      const maxLength = 12000;
      const trimmedText = extractedText.length > maxLength 
        ? extractedText.substring(0, maxLength) + "...(省略されました)"
        : extractedText;
      
      // リクエストデータを準備
      const requestData = {
        resumeText: trimmedText,
        jdData: selectedJd.data
      };
      
      console.log('送信するリクエストデータ:', requestData);
      
      const response = await fetch(analyzeWithGptUrl, {
        method: 'POST',
        body: JSON.stringify(requestData),
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API応答エラー:', response.status, errorText);
        
        // OpenAI APIエラーの特別処理
        if (errorText.includes('api.openai.com') || errorText.includes('OpenAI')) {
          throw new Error('OpenAI APIでエラーが発生しました。しばらく時間をおいて再試行してください。');
        }
        
        throw new Error(`サーバーエラー: ${response.status} ${response.statusText}\n${errorText}`);
      }
      
      const result: AnalysisResult = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // 結果を更新
      updateResults(result);
      
      setAnalyzeStatus({ type: 'success', message: '分析が完了しました！' });
    } catch (error) {
      console.error('分析エラー:', error);
      
      let errorMessage = error instanceof Error ? error.message : '不明なエラー';
      
      // OpenAI APIエラーの場合の特別なメッセージ
      if (errorMessage.includes('500 Server Error') && errorMessage.includes('api.openai.com')) {
        errorMessage = 'OpenAI APIでエラーが発生しました。しばらく時間をおいて再試行してください。';
      }
      
      setAnalyzeStatus({ 
        type: 'error', 
        message: `エラー: ${errorMessage}` 
      });
      
      // エラー時は結果表示エリアをリセット
      resetResults();
    }
  };
  
  // 分析結果を更新
  const updateResults = (result: AnalysisResult) => {
    // 生データ
    setRawResult(JSON.stringify(result, null, 2));
    
    // 適合度
    if (result.適合度評価) {
      const score = result.適合度評価.スコア || 0;
      let scoreColorClass = 'text-yellow-500';
      let scoreBgClass = 'bg-yellow-100';
      
      if (score >= 80) {
        scoreColorClass = 'text-green-600';
        scoreBgClass = 'bg-green-100';
      } else if (score < 60) {
        scoreColorClass = 'text-red-600';
        scoreBgClass = 'bg-red-100';
      }
      
      setMatchResult(`
        <div class="flex flex-col items-center mb-6">
          <div class="text-4xl font-bold ${scoreColorClass} mb-2">${score}/100</div>
          <div class="w-full max-w-md h-4 ${scoreBgClass} rounded-full overflow-hidden">
            <div class="h-full ${scoreColorClass} bg-opacity-70" style="width: ${score}%"></div>
          </div>
        </div>
        <div class="bg-white p-6 rounded-lg shadow-md">
          <h3 class="text-xl font-bold text-gray-800 mb-3">評価理由:</h3>
          <p class="text-gray-700">${result.適合度評価.評価理由 || '評価理由が提供されていません'}</p>
        </div>
      `);
    }
    
    // 面接質問
    if (result.面接質問リスト) {
      setQuestionsResult(`
        <div class="bg-white p-6 rounded-lg shadow-md">
          <h3 class="text-xl font-bold text-gray-800 mb-4">推奨面接質問:</h3>
          <ol class="space-y-3">
            ${result.面接質問リスト.map(q => `
              <li class="p-3 bg-blue-50 rounded-md border-l-4 border-blue-500">
                <p class="text-gray-700">${q}</p>
              </li>
            `).join('')}
          </ol>
        </div>
      `);
    }
    
    // 掘り下げポイント
    if (result.掘り下げポイント) {
      setPointsResult(`
        <div class="space-y-4">
          <h3 class="text-xl font-bold text-gray-800 mb-4">掘り下げポイント:</h3>
          ${result.掘り下げポイント.map(p => `
            <div class="bg-white p-5 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <h4 class="text-lg font-semibold text-blue-700 mb-2">${p.ポイント || ''}</h4>
              <p class="text-gray-700">${p.理由 || ''}</p>
            </div>
          `).join('')}
        </div>
      `);
    }
    
    // 不足スキル
    if (result.不足スキル) {
      setSkillsResult(`
        <div class="bg-white p-6 rounded-lg shadow-md">
          <h3 class="text-xl font-bold text-gray-800 mb-4">不足スキル/経験:</h3>
          <div class="flex flex-wrap gap-2">
            ${result.不足スキル.map(s => {
              let tagClass = 'bg-yellow-100 text-yellow-800';
              if (s.重要度 === '高') tagClass = 'bg-red-100 text-red-800';
              if (s.重要度 === '低') tagClass = 'bg-green-100 text-green-800';
              return `<span class="px-3 py-1 rounded-full ${tagClass} text-sm font-medium">${s.スキル || ''} (${s.重要度 || ''})</span>`;
            }).join('')}
          </div>
        </div>
      `);
    }
    
    // 勤務履歴
    if (result.勤務履歴) {
      setHistoryResult(`
        <div class="bg-white p-6 rounded-lg shadow-md">
          <h3 class="text-xl font-bold text-gray-800 mb-4">抽出された勤務履歴:</h3>
          <div class="space-y-4">
            ${result.勤務履歴.map(h => `
              <div class="p-4 border-l-4 border-blue-500 bg-blue-50 rounded-r-md">
                <div class="font-bold text-lg text-gray-800">${h.会社名 || ''}</div>
                <div class="text-gray-600">役職: ${h.役職 || '記載なし'}</div>
                <div class="text-gray-600">期間: ${h.期間 || '記載なし'}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `);
    }
  };
  
  // 結果をリセット
  const resetResults = () => {
    setMatchResult('<div class="p-4 bg-red-100 text-red-700 rounded-md">エラーが発生しました</div>');
    setQuestionsResult('<div class="p-4 bg-red-100 text-red-700 rounded-md">エラーが発生しました</div>');
    setPointsResult('<div class="p-4 bg-red-100 text-red-700 rounded-md">エラーが発生しました</div>');
    setSkillsResult('<div class="p-4 bg-red-100 text-red-700 rounded-md">エラーが発生しました</div>');
    setHistoryResult('<div class="p-4 bg-red-100 text-red-700 rounded-md">エラーが発生しました</div>');
    setRawResult('<div class="p-4 bg-red-100 text-red-700 rounded-md">エラーが発生しました</div>');
  };
  
  // HTMLエスケープ関数
  const escapeHtml = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };
  
  // ステータスメッセージのアイコン
  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'loading':
        return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
      default:
        return null;
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* ヘッダーナビゲーション */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600 mr-2" />
              <h1 className="text-2xl font-bold text-gray-900">レジュメ評価システム</h1>
            </div>
            <nav className="flex space-x-8">
              <Link href="/" className="px-3 py-2 text-gray-600 font-medium hover:text-blue-700 hover:border-b-2 hover:border-blue-500 transition-all">ホーム</Link>
              <Link href="/jd-management" className="px-3 py-2 text-gray-600 font-medium hover:text-blue-700 hover:border-b-2 hover:border-blue-500 transition-all">JD管理</Link>
              <Link href="/resume-analyzer" className="px-3 py-2 text-blue-700 font-medium border-b-2 border-blue-500">レジュメ分析</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* 左側: レジュメアップロード */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center mb-4">
              <Upload className="h-6 w-6 text-blue-600 mr-2" />
              <h2 className="text-xl font-bold text-gray-900">レジュメアップロード</h2>
            </div>
            
            <div className="mb-4">
              <label htmlFor="resumeFile" className="block text-sm font-medium text-gray-700 mb-1">
                レジュメファイル (PDF/DOCX/Excel):
              </label>
              <input 
                type="file" 
                id="resumeFile" 
                accept=".pdf,.docx,.xlsx,.xls"
                onChange={handleFileChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <button 
              onClick={handleUpload}
              className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
              disabled={!resumeFile}
            >
              <Upload className="h-5 w-5 mr-2" />
              アップロードして解析
            </button>
            
            {uploadStatus.message && (
              <div className={`mt-4 p-3 rounded-md flex items-start ${
                uploadStatus.type === 'success' ? 'bg-green-100' : 
                uploadStatus.type === 'error' ? 'bg-red-100' : 
                'bg-blue-100'
              }`}>
                <div className="flex-shrink-0 mt-0.5 mr-3">
                  {getStatusIcon(uploadStatus.type)}
                </div>
                <div className={`text-sm ${
                  uploadStatus.type === 'success' ? 'text-green-700' : 
                  uploadStatus.type === 'error' ? 'text-red-700' : 
                  'text-blue-700'
                }`}>
                  {uploadStatus.message}
                </div>
              </div>
            )}
            
            <div className="mt-6">
              <label htmlFor="extractedText" className="block text-sm font-medium text-gray-700 mb-1">
                抽出されたテキスト:
              </label>
              <textarea 
                id="extractedText" 
                rows={12}
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                readOnly
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-gray-50 text-sm"
              />
            </div>
          </div>
          
          {/* 右側: JD選択と分析 */}
          <div>
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <div className="flex items-center mb-4">
                <Briefcase className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-xl font-bold text-gray-900">JD選択と分析</h2>
              </div>
              
              <div className="mb-4">
                <label htmlFor="jdSelect" className="block text-sm font-medium text-gray-700 mb-1">
                  JDを選択:
                </label>
                <select 
                  id="jdSelect"
                  value={selectedJd ? selectedJd.id : ''}
                  onChange={handleJdChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- JD一覧から選択 --</option>
                  {jdList.map(jd => (
                    <option key={jd.id} value={jd.id}>
                      {jd.title || 'タイトルなし'}
                    </option>
                  ))}
                </select>
              </div>
              
              {selectedJd && (
                <div className="mb-6 p-4 bg-gray-50 rounded-md">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">選択したJD詳細</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-medium text-gray-500">ポジション:</div>
                      <div className="mt-1 text-gray-800">{selectedJd.data.position || ''}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">必須条件/スキル:</div>
                      <div className="mt-1 text-gray-800 text-sm">{selectedJd.data.requirements || ''}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">職務内容:</div>
                      <div className="mt-1 text-gray-800 text-sm">{selectedJd.data.responsibilities || ''}</div>
                    </div>
                  </div>
                </div>
              )}
              
              <button 
                onClick={handleAnalyze}
                disabled={!extractedText || !selectedJd}
                className={`w-full py-2 px-4 rounded-md font-medium flex items-center justify-center ${
                  !extractedText || !selectedJd 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 transition-colors'
                }`}
              >
                <PieChart className="h-5 w-5 mr-2" />
                GPTで分析
              </button>
              
              {analyzeStatus.message && (
                <div className={`mt-4 p-3 rounded-md flex items-start ${
                  analyzeStatus.type === 'success' ? 'bg-green-100' : 
                  analyzeStatus.type === 'error' ? 'bg-red-100' : 
                  'bg-blue-100'
                }`}>
                  <div className="flex-shrink-0 mt-0.5 mr-3">
                    {getStatusIcon(analyzeStatus.type)}
                  </div>
                  <div className={`text-sm ${
                    analyzeStatus.type === 'success' ? 'text-green-700' : 
                    analyzeStatus.type === 'error' ? 'text-red-700' : 
                    'text-blue-700'
                  }`}>
                    {analyzeStatus.message.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* 分析結果タブ */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="flex border-b">
                {[
                  { id: 'match', label: '適合度', icon: <PieChart className="h-4 w-4" /> },
                  { id: 'questions', label: '面接質問', icon: <FileText className="h-4 w-4" /> },
                  { id: 'points', label: '掘り下げポイント', icon: <ArrowRight className="h-4 w-4" /> },
                  { id: 'skills', label: '不足スキル', icon: <Briefcase className="h-4 w-4" /> },
                  { id: 'history', label: '勤務履歴', icon: <Clock className="h-4 w-4" /> },
                  { id: 'raw', label: '生データ', icon: <FileText className="h-4 w-4" /> }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    className={`flex-1 py-3 px-2 text-sm font-medium flex items-center justify-center ${
                      activeTab === tab.id 
                        ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span className="mr-1.5">{tab.icon}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
              
              <div className="p-4">
                <div className={activeTab === 'match' ? 'block' : 'hidden'}
                  dangerouslySetInnerHTML={{ __html: matchResult }}
                />
                
                <div className={activeTab === 'questions' ? 'block' : 'hidden'}
                  dangerouslySetInnerHTML={{ __html: questionsResult }}
                />
                
                <div className={activeTab === 'points' ? 'block' : 'hidden'}
                  dangerouslySetInnerHTML={{ __html: pointsResult }}
                />
                
                <div className={activeTab === 'skills' ? 'block' : 'hidden'}
                  dangerouslySetInnerHTML={{ __html: skillsResult }}
                />
                
                <div className={activeTab === 'history' ? 'block' : 'hidden'}
                  dangerouslySetInnerHTML={{ __html: historyResult }}
                />
                
                <div className={activeTab === 'raw' ? 'block' : 'hidden'}>
                  <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-xs text-gray-800 max-h-96">
                    {rawResult}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* フッター */}
      <footer className="bg-gray-100 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <FileText className="h-6 w-6 text-blue-600 mr-2" />
              <span className="text-gray-600 font-medium">レジュメ評価システム</span>
            </div>
            <nav className="flex space-x-6">
              <Link href="/" className="text-gray-600 hover:text-blue-600">ホーム</Link>
              <Link href="/jd-management" className="text-gray-600 hover:text-blue-600">JD管理</Link>
              <Link href="/resume-analyzer" className="text-gray-600 hover:text-blue-600">レジュメ分析</Link>
            </nav>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-200 text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} レジュメ評価システム. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}