import { useState, useCallback, useRef, useEffect } from 'react'

const MAX_HISTORY = 50

/**
 * useUndoRedo - Hook for undo/redo functionality
 * 
 * @param {*} initialState - Initial state value
 * @returns {Object} { state, push, undo, redo, canUndo, canRedo, clear }
 */
export function useUndoRedo(initialState = null) {
  const [state, setState] = useState(initialState)
  const historyRef = useRef([initialState])
  const indexRef = useRef(0)

  /**
   * Push a new state to history
   */
  const push = useCallback((newState) => {
    // Remove any "future" states if we're not at the end
    historyRef.current = historyRef.current.slice(0, indexRef.current + 1)
    
    // Add new state
    historyRef.current.push(newState)
    
    // Limit history size
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift()
    } else {
      indexRef.current++
    }
    
    setState(newState)
  }, [])

  /**
   * Undo to the previous state
   */
  const undo = useCallback(() => {
    if (indexRef.current > 0) {
      indexRef.current--
      setState(historyRef.current[indexRef.current])
    }
  }, [])

  /**
   * Redo to the next state
   */
  const redo = useCallback(() => {
    if (indexRef.current < historyRef.current.length - 1) {
      indexRef.current++
      setState(historyRef.current[indexRef.current])
    }
  }, [])

  /**
   * Clear all history and reset to initial state
   */
  const clear = useCallback(() => {
    historyRef.current = [initialState]
    indexRef.current = 0
    setState(initialState)
  }, [initialState])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + Z = Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      // Cmd/Ctrl + Shift + Z = Redo (also support Cmd/Ctrl + Y)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  return {
    state,
    push,
    undo,
    redo,
    canUndo: indexRef.current > 0,
    canRedo: indexRef.current < historyRef.current.length - 1,
    clear,
    historyLength: historyRef.current.length,
    currentIndex: indexRef.current,
  }
}

/**
 * useActionHistory - More advanced undo/redo with named actions
 * 
 * @param {Object} options - { maxHistory, onAction }
 * @returns {Object} { state, execute, undo, redo, canUndo, canRedo, clear, lastAction }
 */
export function useActionHistory({ maxHistory = MAX_HISTORY, onAction } = {}) {
  const [history, setHistory] = useState([{ state: null, action: null }])
  const [currentIndex, setCurrentIndex] = useState(0)

  const execute = useCallback((actionName, newState) => {
    setHistory(prev => {
      // Remove any "future" states
      const newHistory = prev.slice(0, currentIndex + 1)
      
      // Add new state with action name
      newHistory.push({ state: newState, action: actionName })
      
      // Limit history size
      if (newHistory.length > maxHistory) {
        newHistory.shift()
        return newHistory
      }
      
      return newHistory
    })
    
    setCurrentIndex(prev => Math.min(prev + 1, maxHistory - 1))
    onAction?.(actionName, newState)
  }, [currentIndex, maxHistory, onAction])

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    }
  }, [currentIndex])

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(prev => prev + 1)
    }
  }, [currentIndex, history.length])

  const clear = useCallback(() => {
    setHistory([{ state: null, action: null }])
    setCurrentIndex(0)
  }, [])

  return {
    state: history[currentIndex]?.state,
    lastAction: history[currentIndex]?.action,
    execute,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    clear,
    historyLength: history.length,
    currentIndex,
  }
}
