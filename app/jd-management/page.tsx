'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// 型定義
interface JD {
  id: string;
  title?: string;
  category?: string;
  updatedAt?: string;
  data: {
    position: string;
    category?: string;
    requirements: string;
    responsibilities: string;
    qualifications?: string;
    preferredSkills?: string;
    notes?: string;
  };
}

interface StatusMessage {
  type: string;
  message: string;
}

export default function JdManagement() {
  // 状態変数
  const [activeTab, setActiveTab] = useState<string>('list');
  const [jdList, setJdList] = useState<JD[]>([]);
  const [jdListStatus, setJdListStatus] = useState<StatusMessage>({ type: '', message: '' });
  const [saveStatus, setSaveStatus] = useState<StatusMessage>({ type: '', message: '' });
  const [importStatus, setImportStatus] = useState<StatusMessage>({ type: '', message: '' });
  
  // フォーム状態
  const [jdId, setJdId] = useState<string>('');
  const [position, setPosition] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [requirements, setRequirements] = useState<string>('');
  const [responsibilities, setResponsibilities] = useState<string>('');
  const [qualifications, setQualifications] = useState<string>('');
  const [preferredSkills, setPreferredSkills] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Azure Functions URL
  const manageJdUrl = process.env.NEXT_PUBLIC_MANAGE_JD_URL;
  const importJdUrl = process.env.NEXT_PUBLIC_IMPORT_JD_URL;
  
  // ページ読み込み時にJD一覧を取得
  useEffect(() => {
    loadJDList();
  }, []);
  
  // JD一覧の読み込み
  const loadJDList = async () => {
    try {
      setJdListStatus({ type: '', message: 'JDを読み込み中...' });
      
      if (!manageJdUrl) {
        throw new Error('APIエンドポイントが設定されていません');
      }
      
      try {
        // APIを呼び出し
        const response = await fetch(manageJdUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        console.log('Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`サーバーエラー: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received data:', data);
        
        if (Array.isArray(data)) {
          setJdList(data.map(jd => ({
            id: jd.id,
            title: jd.title || '',
            category: jd.category || '',
            updatedAt: jd.updatedAt || '',
            data: jd.data || {}
          })));
        } else {
          throw new Error('Invalid data format');
        }
      } catch (apiError) {
        console.warn('API error, using mock data:', apiError);
        // テスト用のモックデータ
        const mockData = [
          {
            id: 'mock-1',
            title: 'フルスタックエンジニア',
            category: '技術職',
            updatedAt: new Date().toISOString(),
            data: {
              position: 'フルスタックエンジニア',
              category: '技術職',
              requirements: 'React, Node.js, TypeScript の実務経験',
              responsibilities: 'Webアプリケーションの設計・開発',
            }
          },
          {
            id: 'mock-2',
            title: 'プロジェクトマネージャー',
            category: '管理職',
            updatedAt: new Date().toISOString(),
            data: {
              position: 'プロジェクトマネージャー',
              category: '管理職',
              requirements: 'プロジェクトマネジメント経験5年以上',
              responsibilities: 'チームマネジメント、プロジェクト推進',
            }
          }
        ];
        setJdList(mockData);
      }
      
      setJdListStatus({ type: '', message: '' });
    } catch (error) {
      console.error('Detailed error:', error);
      setJdListStatus({ 
        type: 'error', 
        message: `読み込みエラー: ${error instanceof Error ? error.message : '不明なエラー'}` 
      });
    }
  };
  
  // JDの保存（新規/更新）
  const saveJD = async () => {
    // 必須フィールドのバリデーション
    if (!position || !requirements || !responsibilities) {
      setSaveStatus({ type: 'error', message: '必須項目を入力してください' });
      return;
    }
    
    // JDデータの構築
    const jdData = {
      position,
      category,
      requirements,
      responsibilities,
      qualifications,
      preferredSkills,
      notes
    };
    
    try {
      setSaveStatus({ type: '', message: '保存中...' });
      
      if (!manageJdUrl) {
        throw new Error('APIエンドポイントが設定されていません');
      }
      
      const response = await fetch(manageJdUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: jdId || null,
          data: jdData
        })
      });
      
      if (!response.ok) {
        throw new Error(`サーバーエラー: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        setSaveStatus({ type: 'success', message: 'JDが正常に保存されました' });
        
        // フォームをリセット
        setTimeout(() => {
          resetForm();
          // JD一覧タブを表示
          setActiveTab('list');
          // JD一覧を再読み込み
          loadJDList();
        }, 1500);
      } else {
        throw new Error('保存に失敗しました');
      }
    } catch (error) {
      setSaveStatus({ 
        type: 'error', 
        message: `保存エラー: ${error instanceof Error ? error.message : '不明なエラー'}` 
      });
    }
  };
  
  // JDの編集
  const editJD = async (id: string) => {
    try {
      if (!manageJdUrl) {
        throw new Error('APIエンドポイントが設定されていません');
      }
      
      // JD一覧から該当するJDを検索
      const response = await fetch(`${manageJdUrl}&id=${id}`);
      if (!response.ok) {
        throw new Error(`サーバーエラー: ${response.status}`);
      }
      
      const jdList = await response.json();
      const jd = jdList.find((item: JD) => item.id === id);
      
      if (!jd) {
        throw new Error('JDが見つかりません');
      }
      
      // 編集フォームに値を設定
      setJdId(jd.id);
      setPosition(jd.data.position || '');
      setCategory(jd.data.category || '');
      setRequirements(jd.data.requirements || '');
      setResponsibilities(jd.data.responsibilities || '');
      setQualifications(jd.data.qualifications || '');
      setPreferredSkills(jd.data.preferredSkills || '');
      setNotes(jd.data.notes || '');
      
      // 編集タブに切り替え
      setActiveTab('add');
      setSaveStatus({ type: '', message: '' });
    } catch (error) {
      alert(`JDの読み込みエラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  };
  
  // JDの削除
  const deleteJD = async (id: string) => {
    if (!confirm('このJDを削除してもよろしいですか？')) {
      return;
    }
    
    try {
      if (!manageJdUrl) {
        throw new Error('APIエンドポイントが設定されていません');
      }
      
      // 削除APIがない場合、特別なパラメータでPOSTリクエストを送信
      const response = await fetch(manageJdUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id,
          delete: true
        })
      });
      
      if (!response.ok) {
        throw new Error(`サーバーエラー: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        // JD一覧を再読み込み
        loadJDList();
      } else {
        throw new Error('削除に失敗しました');
      }
    } catch (error) {
      alert(`削除エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  };
  
  // フォームのリセット
  const resetForm = () => {
    setJdId('');
    setPosition('');
    setCategory('');
    setRequirements('');
    setResponsibilities('');
    setQualifications('');
    setPreferredSkills('');
    setNotes('');
    setSaveStatus({ type: '', message: '' });
  };
  
  // Excel一括インポート
  const importExcel = async (e: React.FormEvent) => {
    const fileInput = document.getElementById('excelFile') as HTMLInputElement;
    
    if (!fileInput?.files?.length) {
      setImportStatus({ type: 'error', message: 'Excelファイルを選択してください' });
      return;
    }
    
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      setImportStatus({ type: '', message: 'インポート中...' });
      
      if (!importJdUrl) {
        throw new Error('APIエンドポイントが設定されていません');
      }
      
      const response = await fetch(importJdUrl, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `サーバーエラー: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.status === 'success') {
        setImportStatus({ 
          type: 'success', 
          message: `${result.imported || 0}件のJDが正常にインポートされました` 
        });
        
        // フォームをリセット
        fileInput.value = '';
        
        // 少し待ってからJD一覧を再読み込み
        setTimeout(() => {
          setActiveTab('list');
          loadJDList();
        }, 2000);
      } else {
        throw new Error(result.message || 'インポートに失敗しました');
      }
    } catch (error) {
      setImportStatus({ 
        type: 'error', 
        message: `インポートエラー: ${error instanceof Error ? error.message : '不明なエラー'}` 
      });
    }
  };
  
  // JD一覧の検索/フィルタリング
  const filterJDList = (jd: JD) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toUpperCase();
    const title = (jd.title || '').toUpperCase();
    const category = (jd.category || '').toUpperCase();
    
    return title.includes(query) || category.includes(query);
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
  
  // 日付フォーマット関数
  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };
  
  // テンプレートのダウンロード
  const downloadTemplate = (e: React.MouseEvent) => {
    e.preventDefault();
    alert('この機能は現在実装中です。以下の列を持つExcelファイルを準備してください：position, category, requirements, responsibilities, qualifications, preferredSkills, notes');
  };
  
  return (
    <div>
      <div className="nav-bar">
        <h1>レジュメ評価システム</h1>
        <div className="nav-links">
          <Link href="/">ホーム</Link>
          <Link href="/jd-management" className="active">JD管理</Link>
          <Link href="/resume-analyzer">レジュメ分析</Link>
        </div>
      </div>

      <div className="tabs">
        <div 
          className={`tab ${activeTab === 'list' ? 'active' : ''}`} 
          onClick={() => setActiveTab('list')}
        >
          JD一覧
        </div>
        <div 
          className={`tab ${activeTab === 'add' ? 'active' : ''}`} 
          onClick={() => setActiveTab('add')}
        >
          新規JD登録
        </div>
        <div 
          className={`tab ${activeTab === 'import' ? 'active' : ''}`} 
          onClick={() => setActiveTab('import')}
        >
          Excel一括インポート
        </div>
      </div>

      <div className={`tab-content ${activeTab === 'list' ? 'active' : ''}`}>
        <div className="panel full-width">
          <h2>JD一覧</h2>
          <div className="form-group">
            <input 
              type="text" 
              placeholder="JDを検索..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {jdListStatus.message && (
            <div className={`status-message ${jdListStatus.type}`}>
              {jdListStatus.message}
            </div>
          )}
          
          <table>
            <thead>
              <tr>
                <th>ポジション名</th>
                <th>カテゴリ</th>
                <th>最終更新日</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {jdList.length === 0 ? (
                <tr>
                  <td colSpan={4}>登録されているJDはありません</td>
                </tr>
              ) : (
                jdList.filter(filterJDList).map(jd => (
                  <tr key={jd.id}>
                    <td>{jd.title || ''}</td>
                    <td>{jd.category || ''}</td>
                    <td>{formatDate(jd.updatedAt)}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          onClick={() => editJD(jd.id)} 
                          className="action-button"
                        >
                          編集
                        </button>
                        <button 
                          onClick={() => deleteJD(jd.id)} 
                          className="action-button danger"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`tab-content ${activeTab === 'add' ? 'active' : ''}`}>
        <div className="panel full-width">
          <h2>{jdId ? 'JD編集' : '新規JD登録'}</h2>
          <div>
            <input type="hidden" value={jdId} />
            <div className="form-group">
              <label htmlFor="position">ポジション名 *</label>
              <input 
                type="text" 
                id="position" 
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="category">カテゴリ</label>
              <input 
                type="text" 
                id="category" 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="例: 技術職/営業職/管理職" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="requirements">必須条件/スキル *</label>
              <textarea 
                id="requirements" 
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="responsibilities">職務内容 *</label>
              <textarea 
                id="responsibilities" 
                value={responsibilities}
                onChange={(e) => setResponsibilities(e.target.value)}
                required 
              />
            </div>
            <div className="form-group">
              <label htmlFor="qualifications">資格要件</label>
              <textarea 
                id="qualifications" 
                value={qualifications}
                onChange={(e) => setQualifications(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="preferredSkills">歓迎スキル</label>
              <textarea 
                id="preferredSkills" 
                value={preferredSkills}
                onChange={(e) => setPreferredSkills(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="notes">備考</label>
              <textarea 
                id="notes" 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="form-group">
              <button 
                type="button" 
                onClick={saveJD} 
                className="success"
              >
                保存
              </button>
              <button 
                type="button" 
                onClick={resetForm} 
                className="secondary"
              >
                クリア
              </button>
            </div>
            
            {saveStatus.message && (
              <div className={`status-message ${saveStatus.type}`}>
                {saveStatus.message}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`tab-content ${activeTab === 'import' ? 'active' : ''}`}>
        <div className="panel full-width">
          <h2>Excel一括インポート</h2>
          <div className="form-group">
            <label htmlFor="excelFile">Excelファイル (.xlsx)</label>
            <input type="file" id="excelFile" accept=".xlsx" />
          </div>
          <div className="form-group">
            <p>以下の列を含むExcelファイルをアップロードしてください：</p>
            <ul>
              <li><strong>position</strong>: ポジション名 (必須)</li>
              <li><strong>category</strong>: カテゴリ</li>
              <li><strong>requirements</strong>: 必須条件/スキル (必須)</li>
              <li><strong>responsibilities</strong>: 職務内容 (必須)</li>
              <li><strong>qualifications</strong>: 資格要件</li>
              <li><strong>preferredSkills</strong>: 歓迎スキル</li>
              <li><strong>notes</strong>: 備考</li>
            </ul>
            <a href="#" onClick={downloadTemplate}>Excelテンプレートをダウンロード</a>
          </div>
          <div className="form-group">
            <button 
              type="button" 
              onClick={importExcel} 
              className="success"
            >
              インポート実行
            </button>
          </div>
          
          {importStatus.message && (
            <div className={`status-message ${importStatus.type}`}>
              {importStatus.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}