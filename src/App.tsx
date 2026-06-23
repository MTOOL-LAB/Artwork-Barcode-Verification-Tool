/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Upload, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface VerificationResult {
  detected_sku: string;
  real_ocr_digits: string;
  real_scan_digits: string;
  user_spec_input: string;
  match_results: {
    barcode_vs_spec: boolean;
    sku_vs_barcode: boolean;
  };
  final_verdict: 'PASS' | 'FAIL';
  fail_reason: string | null;
}

interface LogEntry {
  time: string;
  sku: string;
  barcodeDigits: string;
  printedOcr: string;
  input: string;
  result: 'PASS' | 'FAIL';
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [inputSpec, setInputSpec] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [file]);

  const handlePaste = (e: React.ClipboardEvent) => {
    const item = e.clipboardData?.items[0];
    if (item?.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        setFile(file);
      }
    }
  };

  const exportCSV = () => {
    const headers = ['Time', 'SKU', 'Scanned', 'Printed', 'Input', 'Result'];
    const rows = logs.map(l => [l.time, l.sku, l.barcodeDigits, l.printedOcr, l.input, l.result]);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'qa_logs.csv';
    link.click();
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('artwork', file);
    formData.append('inputSpec', inputSpec);

    const response = await fetch('/api/verify-artwork', {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    setResult(data);
    setLoading(false);

    // Add to logs
    setLogs((prev) => [
      {
        time: new Date().toLocaleTimeString(),
        sku: data.detected_sku,
        barcodeDigits: data.real_scan_digits,
        printedOcr: data.real_ocr_digits,
        input: data.user_spec_input,
        result: data.final_verdict,
      },
      ...prev,
    ]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans" tabIndex={0} onPaste={handlePaste}>
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Artwork Barcode Verification Tool</h1>
        </header>

        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <div className="flex gap-4 items-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
            >
              <Upload size={16} /> Upload Artwork
            </button>
            <input type="file" ref={fileInputRef} onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                placeholder="Enter standard barcode digits"
                value={inputSpec}
                onChange={(e) => setInputSpec(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-md"
              />
              {previewUrl && <img src={previewUrl} alt="Preview" className="h-10 w-auto rounded border" />}
              {file && <span className="text-sm text-green-600 flex items-center">File ready: {file.name}</span>}
            </div>
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Verify'}
            </button>
          </div>
          <p className="text-xs text-gray-400">Tip: You can also paste an image directly into the page.</p>
        </section>

        {result && (
          <section className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-2xl font-semibold mb-6">🏆 Artwork 條碼印刷檢核系統報告</h2>
            <div className="space-y-4 text-gray-700">
              <p>产品型號 (SKU Number) [照片實體抓取]：<span className="font-mono">{result.detected_sku}</span></p>
              <p>條碼印刷文字判讀 (Printed OCR) [照片實體抓取]：<span className="font-mono">{result.real_ocr_digits}</span></p>
              <p>條碼圖形實質讀取 (Barcode Scan) [照片實體抓取]：<span className="font-mono">{result.real_scan_digits}</span></p>
              <p>客戶提供之標準條碼數字 (Input)：<span className="font-mono">{result.user_spec_input}</span></p>
              <div className={`mt-6 p-4 rounded-lg flex items-center gap-2 ${result.final_verdict === 'PASS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {result.final_verdict === 'PASS' ? <CheckCircle2 /> : <XCircle />}
                <span className="font-bold">
                  最終交叉核對結果：{result.final_verdict === 'PASS' ? '【🟢 PASS】' : `【🔴 FAIL (${result.fail_reason})】`}
                </span>
              </div>
            </div>
          </section>
        )}

        <section className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">📊 QA Log 歷史紀錄</h2>
            <button onClick={exportCSV} className="text-sm px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded">Export CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                <tr>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Scanned</th>
                  <th className="px-4 py-2">Printed</th>
                  <th className="px-4 py-2">Input</th>
                  <th className="px-4 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-2 font-mono">{log.time}</td>
                    <td className="px-4 py-2 font-mono">{log.sku}</td>
                    <td className="px-4 py-2 font-mono">{log.barcodeDigits}</td>
                    <td className="px-4 py-2 font-mono">{log.printedOcr}</td>
                    <td className="px-4 py-2 font-mono">{log.input}</td>
                    <td className={`px-4 py-2 font-bold ${log.result === 'PASS' ? 'text-green-600' : 'text-red-600'}`}>{log.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8 p-4 bg-gray-100 rounded-lg text-sm text-gray-600">
            <p><strong>Note on Offline Export:</strong> This application relies on server-side processing for AI analysis and cannot be exported as a standalone static HTML file. To export this project for local use, please use the "Export to ZIP/GitHub" option in the Settings menu of the AI Studio editor.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

