import React, { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { listFiles, uploadFile, compressPdf, exportImages, applyOcr, fetchPdfBlob } from '../services/api'
import { toast } from 'sonner'
import { PanelLeftClose, PanelLeftOpen, UploadCloud } from 'lucide-react'

import FileList from '../components/FileList'
import Toolbar from '../components/Toolbar'
import PDFViewer from '../components/PDFViewer'
import AnnotationLayer from '../components/AnnotationLayer'
import TextEditLayer from '../components/TextEditLayer'
import SignaturePanel from '../components/SignaturePanel'
import MergeSplitPanel from '../components/MergeSplitPanel'
import MetadataPanel from '../components/MetadataPanel'
import PagesPanel from '../components/PagesPanel'
import { AppLogo, Button } from '../components/ui/index.js'
import UserMenu from '../components/UserMenu'
import PaywallModal from '../components/PaywallModal'
import OnboardingTooltip from '../components/OnboardingTooltip'

export default function EditorPage() {
  const [files, setFiles] = useState([])
  const [filesLoading, setFilesLoading] = useState(true)
  const [activeFile, setActiveFile] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [activeTool, setActiveTool] = useState('select')
  const [canvasSize, setCanvasSize] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [textItems, setTextItems] = useState([])
  const [textViewport, setTextViewport] = useState(null)
  const [paywallMsg, setPaywallMsg] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [toolbarCollapsed] = useState(false)
  const [pdfScale, setPdfScale] = useState(1.5)
  const pdfUrlRef = React.useRef(null)

  const handleTextItems = useCallback((items, vp) => {
    setTextItems(items)
    setTextViewport(vp)
  }, [])

  const handleTotalPages = useCallback((count) => {
    setTotalPages(count)
    setCurrentPage(page => Math.min(page, count))
  }, [])

  const refresh = useCallback(async () => {
    const data = await listFiles()
    setFiles(data)
    setFilesLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Listen for paywall events
  useEffect(() => {
    const handler = (e) => setPaywallMsg(e.detail || 'Crédits insuffisants.')
    window.addEventListener('paywall', handler)
    return () => window.removeEventListener('paywall', handler)
  }, [])

  // Load PDF as blob URL, without retaining previous documents in memory.
  const loadPdf = useCallback(async (f) => {
    const blobUrl = await fetchPdfBlob(f.id)
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
    pdfUrlRef.current = blobUrl
    setPdfUrl(blobUrl)
  }, [])

  useEffect(() => () => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
  }, [])

  const handleSelectFile = (f) => {
    setActiveFile(f)
    setCurrentPage(1)
    setTotalPages(0)
    setCanvasSize(null)
    setTextItems([])
    setTextViewport(null)
    setActiveTool('select')
    loadPdf(f)
  }

  const handleSaved = useCallback(async () => {
    if (activeFile) {
      setTextItems([])
      setTextViewport(null)
      const updated = await listFiles()
      setFiles(updated)
      const f = updated.find(x => x.id === activeFile.id)
      if (f) {
        setActiveFile(f)
        await loadPdf(f)
      }
    }
  }, [activeFile, loadPdf])

  const onDrop = useCallback(async (acceptedFiles) => {
    for (const file of acceptedFiles) {
      try {
        await uploadFile(file)
        await refresh()
      } catch (err) {
        if (err.response?.status === 402) setPaywallMsg(err.response?.data?.detail)
      }
    }
  }, [refresh])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    noClick: true,
    noKeyboard: true,
  })

  // Handle tool changes
  const handleToolChange = async (tool) => {
    // Handle direct action tools
    if (tool === 'compress' && activeFile) {
      try {
        const r = await compressPdf(activeFile.id)
        toast.success(`Compressé — réduit de ${r.ratio}%`)
        handleSaved()
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Erreur compression')
      }
      return
    }

    if (tool === 'export' && activeFile) {
      try {
        const r = await exportImages(activeFile.id)
        const bin = atob(r.zip_b64)
        const bytes = new Uint8Array(bin.length).map((_, i) => bin.charCodeAt(i))
        const blob = new Blob([bytes], { type: 'application/zip' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${activeFile.name.replace('.pdf', '')}_images.zip`
        a.click()
        URL.revokeObjectURL(a.href)
        toast.success(`${r.pages} pages exportées`)
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Erreur export')
      }
      return
    }

    if (tool === 'ocr' && activeFile) {
      try {
        toast.info('OCR en cours...')
        await applyOcr(activeFile.id)
        toast.success('OCR appliqué')
        handleSaved()
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Erreur OCR')
      }
      return
    }

    setActiveTool(tool)
  }

  // Panel visibility
  const showSignPanel = activeTool === 'sign' && activeFile
  const showMetaPanel = activeTool === 'metadata' && activeFile
  const showMergePanel = activeTool === 'merge'
  const showSplitPanel = activeTool === 'split' && activeFile
  const showPagesPanel = activeTool === 'pages' && activeFile

  return (
    <div {...getRootProps()} className="h-screen flex flex-col overflow-hidden bg-surface-base">
      <input {...getInputProps()} />

      {/* Drag overlay */}
      {isDragActive && (
        <div className="fixed inset-0 bg-white/85 backdrop-blur-sm border-2 border-dashed border-brand/50 flex flex-col items-center justify-center z-50 gap-4 pointer-events-none">
          <div className="w-14 h-14 rounded-2xl bg-brand-light border border-brand/20 flex items-center justify-center">
            <UploadCloud size={24} className="text-brand" />
          </div>
          <p className="text-sm font-semibold text-brand">Déposez votre PDF ici</p>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center gap-3 px-4 bg-white border-b border-border shadow-header shrink-0" style={{ height: 48 }}>
        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-raised transition-colors"
          aria-label={sidebarOpen ? 'Masquer les fichiers' : 'Afficher les fichiers'}
        >
          {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </button>

        <AppLogo />

        {/* File path */}
        {activeFile && (
          <>
            <span className="text-border-strong select-none">/</span>
            <span className="text-xs text-ink-muted truncate max-w-[200px]" title={activeFile.name}>
              {activeFile.name}
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={open}>
            <UploadCloud size={13} /> Importer
          </Button>
          <UserMenu />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Vertical toolbar */}
        <Toolbar
          activeTool={activeTool}
          onToolChange={handleToolChange}
          currentPage={currentPage}
          totalPages={totalPages}
          onPrevPage={() => setCurrentPage(p => Math.max(1, p - 1))}
          onNextPage={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          hasFile={!!activeFile}
          collapsed={toolbarCollapsed}
        />

        {/* Sidebar */}
        <div
          className="overflow-hidden transition-all duration-200 ease-in-out shrink-0"
          style={{ width: sidebarOpen ? 232 : 0 }}
        >
          <FileList
            files={files}
            activeId={activeFile?.id}
            onSelect={handleSelectFile}
            onRefresh={refresh}
            onUpload={open}
            loading={filesLoading}
          />
        </div>

        {/* Main viewer area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {!pdfUrl ? (
            <div className="flex-1 viewer-bg flex flex-col items-center justify-center gap-5 select-none">
              <div className="w-16 h-16 rounded-2xl bg-white border border-border shadow-card flex items-center justify-center">
                <svg width="32" height="38" viewBox="0 0 32 38" fill="none">
                  <rect x="1.5" y="1.5" width="29" height="35" rx="3" stroke="#d1d5db" strokeWidth="1.5"/>
                  <path d="M19 1.5v8.5h8" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 19h18M7 24.5h13M7 30h9" stroke="#00b386" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-ink">Aucun document ouvert</p>
                <p className="text-xs text-ink-muted mt-1">Sélectionnez un fichier ou importez un PDF</p>
              </div>
              <Button variant="primary" size="md" onClick={open}>
                <UploadCloud size={14} /> Importer un PDF
              </Button>
              <p className="text-2xs text-ink-faint">ou glissez-déposez un fichier n'importe où</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-8 flex justify-center items-start viewer-bg">
              <div className="relative inline-block shadow-pdf rounded-sm">
                <PDFViewer
                  fileUrl={pdfUrl}
                  currentPage={currentPage}
                  onTotalPages={handleTotalPages}
                  onPageRendered={setCanvasSize}
                  onTextItems={handleTextItems}
                  scale={pdfScale}
                  onScaleChange={setPdfScale}
                />
                
                {/* Annotation/Text editing layers */}
                {activeFile && canvasSize && ['select', 'highlight', 'image'].includes(activeTool) && (
                  <AnnotationLayer
                    fileId={activeFile.id}
                    currentPage={currentPage}
                    canvasSize={canvasSize}
                    activeTool={activeTool}
                    onSaved={handleSaved}
                  />
                )}
                
                {activeFile && canvasSize && activeTool === 'text' && (
                  <TextEditLayer
                    fileId={activeFile.id}
                    currentPage={currentPage}
                    textItems={textItems}
                    viewport={textViewport}
                    canvasSize={canvasSize}
                    onSaved={handleSaved}
                  />
                )}
              </div>
            </div>
          )}

          {/* Contextual panels */}
          {showSignPanel && (
            <SignaturePanel
              fileId={activeFile.id}
              currentPage={currentPage}
              canvasSize={canvasSize}
              onSaved={handleSaved}
              onClose={() => setActiveTool('select')}
            />
          )}
          {showMetaPanel && (
            <MetadataPanel fileId={activeFile.id} onSaved={handleSaved} onClose={() => setActiveTool('select')} />
          )}
          {showMergePanel && (
            <MergeSplitPanel mode="merge" file={activeFile} allFiles={files} onRefresh={refresh} />
          )}
          {showSplitPanel && (
            <MergeSplitPanel mode="split" file={activeFile} allFiles={files} onRefresh={refresh} />
          )}
          {showPagesPanel && (
            <PagesPanel
              fileId={activeFile.id}
              totalPages={totalPages}
              currentPage={currentPage}
              onSaved={handleSaved}
              onClose={() => setActiveTool('select')}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <PaywallModal isOpen={!!paywallMsg} onClose={() => setPaywallMsg(null)} message={paywallMsg} />
      <OnboardingTooltip />
    </div>
  )
}
