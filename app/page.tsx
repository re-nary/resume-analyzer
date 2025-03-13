import Link from 'next/link';
import { FileText, Briefcase, PieChart, ArrowRight } from 'lucide-react';

export default function Home() {
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
              <Link href="/" className="px-3 py-2 text-blue-700 font-medium border-b-2 border-blue-500">ホーム</Link>
              <Link href="/jd-management" className="px-3 py-2 text-gray-600 font-medium hover:text-blue-700 hover:border-b-2 hover:border-blue-500 transition-all">JD管理</Link>
              <Link href="/resume-analyzer" className="px-3 py-2 text-gray-600 font-medium hover:text-blue-700 hover:border-b-2 hover:border-blue-500 transition-all">レジュメ分析</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* ヒーローセクション */}
        <section className="mb-16 text-center">
          <h2 className="text-4xl font-extrabold text-gray-900 mb-6">最適な人材発掘をサポート</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            AIを活用したレジュメ評価システムで、求人要件と候補者のスキルを効率的にマッチングし、採用プロセスを革新します。
          </p>
          <div className="flex justify-center space-x-4">
            <Link href="/jd-management">
              <button className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center">
                JD管理へ進む
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </Link>
            <Link href="/resume-analyzer">
              <button className="px-6 py-3 bg-white text-blue-600 font-medium rounded-md border border-blue-600 hover:bg-blue-50 transition-colors flex items-center">
                レジュメ分析を開始
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </Link>
          </div>
        </section>

        {/* 機能セクション */}
        <section className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <Briefcase className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">JD管理</h3>
            <p className="text-gray-600">
              求人要件を効率的に管理し、必要なスキルや経験を正確に定義します。カスタマイズ可能なテンプレートで求人プロセスを標準化します。
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">レジュメ分析</h3>
            <p className="text-gray-600">
              AIが候補者のレジュメを自動的に解析し、スキル、経験、教育背景などの重要情報を抽出します。手動でのスクリーニング時間を大幅に削減します。
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <PieChart className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">マッチング評価</h3>
            <p className="text-gray-600">
              高度なアルゴリズムでJDとレジュメを比較し、マッチ度を数値化。最適な候補者を素早く特定し、データに基づいた採用判断をサポートします。
            </p>
          </div>
        </section>

        {/* CTAセクション */}
        <section className="bg-blue-600 text-white p-8 rounded-lg text-center">
          <h2 className="text-2xl font-bold mb-4">今すぐ採用プロセスを改善しましょう</h2>
          <p className="mb-6">AIを活用したレジュメ評価システムで、最適な人材を効率的に見つけ出すことができます。</p>
          <Link href="/jd-management">
            <button className="px-6 py-3 bg-white text-blue-600 font-bold rounded-md hover:bg-blue-50 transition-colors">
              今すぐ始める
            </button>
          </Link>
        </section>
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