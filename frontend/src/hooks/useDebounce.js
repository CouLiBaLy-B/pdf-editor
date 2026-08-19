import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * useDebounce - Debounce a value with a configurable delay
 * 
 * @param {*} value - The value to debounce
 * @param {number} delay - Delay in milliseconds (default: 500)
 * @returns {*} The debounced value
 */
export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * useDebouncedCallback - Debounce a callback function
 * 
 * @param {Function} callback - The callback to debounce
 * @param {number} delay - Delay in milliseconds (default: 500)
 * @returns {Function} The debounced callback
 */
export function useDebouncedCallback(callback, delay = 500) {
  const timeoutRef = useRef(null)

  const debouncedCallback = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }, [callback, delay])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}

/**
 * useThrottle - Throttle a value (update at most once per interval)
 * 
 * @param {*} value - The value to throttle
 * @param {number} interval - Minimum interval between updates in milliseconds
 * @returns {*} The throttled value
 */
export function useThrottle(value, interval = 1000) {
  const [throttledValue, setThrottledValue] = useState(value)
  const lastUpdated = useRef(Date.now())

  useEffect(() => {
    const now = Date.now()
    
    if (now - lastUpdated.current >= interval) {
      lastUpdated.current = now
      setThrottledValue(value)
    } else {
      const timer = setTimeout(() => {
        lastUpdated.current = Date.now()
        setThrottledValue(value)
      }, interval - (now - lastUpdated.current))
      
      return () => clearTimeout(timer)
    }
  }, [value, interval])

  return throttledValue
}

/**
 * useTimeout - Execute a callback after a delay
 * 
 * @param {Function} callback - The callback to execute
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Function to cancel the timeout
 */
export function useTimeout(callback, delay = 1000) {
  const timeoutRef = useRef(null)

  const set = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(callback, delay)
  }, [callback, delay])

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    return clear
  }, [clear])

  return { set, clear }
}

/**
 * useInterval - Execute a callback at regular intervals
 * 
 * @param {Function} callback - The callback to execute
 * @param {number} delay - Interval in milliseconds (null to pause)
 * @returns {Function} Function to clear the interval
 */
export function useInterval(callback, delay) {
  const intervalRef = useRef(null)

  useEffect(() => {
    if (delay !== null) {
      intervalRef.current = setInterval(callback, delay)
      return () => clearInterval(intervalRef.current)
    }
  }, [callback, delay])

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }, [])

  return clear
}

/**
 * usePrevious - Get the previous value of a state
 * 
 * @param {*} value - Current value
 * @returns {*} Previous value
 */
export function usePrevious(value) {
  const ref = useRef()
  
  useEffect(() => {
    ref.current = value
  }, [value])
  
  return ref.current
}

/**
 * useLocalStorage - Sync state with localStorage
 * 
 * @param {string} key - localStorage key
 * @param {*} initialValue - Initial value if key doesn't exist
 * @returns {[*, Function]} State and setter
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error)
    }
  }, [key, storedValue])

  return [storedValue, setValue]
}
