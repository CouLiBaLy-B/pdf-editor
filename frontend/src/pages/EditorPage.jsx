import React, { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { listFiles, uploadFile } from '../services/api'

import FileList from '../components/FileList'
import Toolbar from '../components/Toolbar'
import PDFViewer from '../components/PDFViewer'
import AnnotationLayer from '../components/AnnotationLayer'
import TextEditLayer from '../components/TextEditLayer'
import SignaturePanel from '../components/SignaturePanel'
import MergeSplitPanel from '../components/MergeSplitPanel'
import { AppLogo, Button } from '../components/ui/index.js'

export default function EditorPage() {
  const [files, setFiles] = useState([])
  const [activeFile, setActiveFile] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [activeTool, setActiveTool] = useState('select')
  const [canvasSize, setCanvasSize] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [textItems, setTextItems] = useState([])
  const [textViewport, setTextViewport] = useState(null)

  const handleTextItems = useCallback((items, vp) => {
    setTextItems(items)
    setTextViewport(vp)
  }, [])

  const refresh = useCallback(async () => {
    const data = await listFiles()
    setFiles(data)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleSelectFile = (f) => {
    setActiveFile(f)
    setCurrentPage(1)
    setTotalPages(0)
    setCanvasSize(null)
    setTextItems([])
    setTextViewport(null)
    setPdfUrl(`${f.url}?v=${Date.now()}`)
    setActiveTool('select')
  }

  const handleSaved = () => {
    if (activeFile) {
      setTextItems([])
      setTextViewport(null)
      setPdfUrl(`${activeFile.url}?v=${Date.now()}`)
    }
  }

  const onDrop = useCallback(async (acceptedFiles) => {
    for (const file of acceptedFiles) {
      const result = await uploadFile(file)
      setFiles(prev => [result, ...prev])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    noClick: true,
    noKeyboard: true,
  })

  const showSignPanel  = activeTool === 'sign'  && activeFile
  const showMergePanel = activeTool === 'merge'
  const showSplitPanel = activeTool === 'split' && activeFile

  return (
    <div {...getRootProps()} className="h-screen flex flex-col overflow-hidden bg-surface-base">
      <input {...getInputProps()} />

      {/* Drag overlay */}
      {isDragActive && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm border-2 border-dashed border-brand/60 flex flex-col items-center justify-center z-50 gap-4 pointer-events-none">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand/10 border border-brand/25">
            <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
              <path d="M14 20V8M14 8l-5 5M14 8l5 5" stroke="#00b386" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 24h20" stroke="#00b386" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-brand font-semibold text-sm">Déposez votre PDF ici</p>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center gap-3 px-5 bg-white border-b border-border shadow-header shrink-0" style={{height:'52px'}}>
        <AppLogo />
        {activeFile && (
          <>
            <div className="w-px h-4 bg-border mx-1" />
            <span className="text-xs text-ink-muted truncate max-w-[240px]" title={activeFile.name}>
              {activeFile.name}
            </span>
          </>
        )}
        <div className="ml-auto">
          <Button variant="primary" size="sm" onClick={open}>
            + Importer PDF
          </Button>
        </div>
      </header>

      {/* Toolbar */}
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        currentPage={currentPage}
        totalPages={totalPages}
        onPrevPage={() => setCurrentPage(p => Math.max(1, p - 1))}
        onNextPage={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
        hasFile={!!activeFile}
      />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <FileList
          files={files}
          activeId={activeFile?.id}
          onSelect={handleSelectFile}
          onRefresh={refresh}
        />

        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Viewer or empty state */}
          {!pdfUrl ? (
            <div className="flex-1 viewer-bg flex flex-col items-center justify-center gap-6 select-none">
              <div className="flex items-center justify-center w-20 h-20 rounded-3xl bg-white border border-border shadow-card">
                <svg width="36" height="42" viewBox="0 0 36 42" fill="none" aria-hidden="true">
                  <rect x="1.5" y="1.5" width="33" height="39" rx="3.5" stroke="#cbc7bd" strokeWidth="1.5"/>
                  <path d="M21 1.5v9.5h9" stroke="#cbc7bd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 21h20M8 27h14M8 33h10" stroke="#00b386" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-ink">Aucun document ouvert</p>
                <p className="text-xs text-ink-muted mt-1.5">Sélectionnez un fichier ou importez un nouveau PDF</p>
              </div>
              <Button variant="primary" size="md" onClick={open}>
                + Importer un PDF
              </Button>
              <p className="text-2xs text-ink-faint">ou glissez-déposez un fichier n&apos;importe où</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-8 flex justify-center items-start viewer-bg">
              <div className="relative inline-block shadow-pdf">
                <PDFViewer
                  fileUrl={pdfUrl}
                  currentPage={currentPage}
                  onTotalPages={setTotalPages}
                  onPageRendered={setCanvasSize}
                  onTextItems={handleTextItems}
                />
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

          {/* Panneaux contextuels */}
          {showSignPanel && (
            <SignaturePanel
              fileId={activeFile.id}
              currentPage={currentPage}
              onSaved={handleSaved}
            />
          )}
          {showMergePanel && (
            <MergeSplitPanel
              mode="merge"
              file={activeFile}
              allFiles={files}
              onRefresh={refresh}
            />
          )}
          {showSplitPanel && (
            <MergeSplitPanel
              mode="split"
              file={activeFile}
              allFiles={files}
              onRefresh={refresh}
            />
          )}
        </div>
      </div>
    </div>
  )
}
