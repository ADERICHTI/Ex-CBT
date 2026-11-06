import { useState } from 'react'
import { AlertCircle, Check, Copy, Download, QrCode as QrCodeIcon } from 'lucide-react'
import QrCode from '../../lib/QrCode.jsx'
import { downloadQrPng } from '../../lib/qr.js'
import QtWindow, { QtActions } from '../../lib/QtWindow.jsx'

export default function QrCodeDialog({ open, onClose, testId, testTitle, status = 'draft', onToast }) {
  const [copied, setCopied] = useState(false)
  const url = `https://hypercbt-qt.web.app/test/${testId}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      onToast?.(status === 'open' ? 'Link copied' : 'Link copied — open the test so candidates can start')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      onToast?.('Couldn’t copy the link')
    }
  }

  async function handleDownload() {
    try {
      const slug = (testTitle || 'test').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'test'
      await downloadQrPng(url, `${slug}-qr.png`, 1024)
      onToast?.('QR code saved to your downloads')
    } catch {
      onToast?.('Couldn’t download the QR code')
    }
  }

  return (
    <QtWindow
      open={open}
      onClose={onClose}
      icon={QrCodeIcon}
      label="QR code"
      context={testTitle || 'Untitled test'}
      title="Scan to open the test"
      hint="Project this on a slide or screen so candidates can scan it with their phone camera."
    >
      {status !== 'open' && (
        <div
          role="note"
          style={{
            background: 'var(--warning-soft)',
            color: 'var(--warning)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-control)',
            fontSize: '13px',
            fontWeight: 500,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>
            {status === 'closed'
              ? 'This test is closed, so candidates who scan it can’t start it. Reopen it first.'
              : 'Publish the test so candidates can start it.'}
          </span>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '4px 0 16px',
        }}
      >
        <QrCode value={url} size={280} />
        <span
          style={{
            marginTop: '12px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            wordBreak: 'break-all',
            textAlign: 'center',
          }}
        >
          {url}
        </span>
      </div>

      <QtActions align="between">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline" onClick={handleCopy}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            <span>{copied ? 'Copied' : 'Copy link'}</span>
          </button>
          <button type="button" className="btn btn-outline" onClick={handleDownload}>
            <Download size={15} />
            <span>Download PNG</span>
          </button>
        </div>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </QtActions>
    </QtWindow>
  )
}
