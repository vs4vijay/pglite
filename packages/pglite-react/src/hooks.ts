import { useEffect, useState, useRef } from 'react'
import { Results } from '@electric-sql/pglite'
import type { LiveQuery } from '@electric-sql/pglite/live'
import { usePGlite } from './provider'
import { query as buildQuery } from '@electric-sql/pglite/template'

function paramsEqual(
  a1: unknown[] | undefined | null,
  a2: unknown[] | undefined | null,
) {
  if (!a1 && !a2) return true
  if (a1?.length !== a2?.length) return false
  for (let i = 0; i < a1!.length; i++) {
    if (!Object.is(a1![i], a2![i])) {
      return false
    }
  }
  return true
}

function useLiveQueryImpl<T = { [key: string]: unknown }>(
  query: string,
  params: unknown[] | undefined | null,
  key?: string,
): Omit<Results<T>, 'affectedRows'> | undefined {
  const db = usePGlite()
  const [results, setResults] = useState<Results<T>>()
  const paramsRef = useRef(params)

  let currentParams = paramsRef.current
  if (!paramsEqual(paramsRef.current, params)) {
    paramsRef.current = params
    currentParams = params
  }

  useEffect(() => {
    let cancelled = false
    const cb = (results: Results<T>) => {
      if (cancelled) return
      setResults(results)
    }
    const ret =
      key !== undefined
        ? db.live.incrementalQuery<T>(query, currentParams, key, cb)
        : db.live.query<T>(query, currentParams, cb)

    return () => {
      cancelled = true
      ret.then(({ unsubscribe }) => unsubscribe())
    }
  }, [db, key, query, currentParams])
  return (
    results && {
      rows: results.rows,
      fields: results.fields,
    }
  )
}

function useLiveQueryResult<T = { [key: string]: unknown }>(
  liveQuery: LiveQuery<T>,
): Results<T> | undefined {
  const [results, setResults] = useState<Results<T>>(liveQuery.initialResults)
  useEffect(() => {
    setResults(liveQuery.initialResults)
    const cb = (results: Results<T>) => {
      setResults(results)
    }
    liveQuery.subscribe(cb)
    return () => {
      liveQuery.unsubscribe(cb)
    }
  }, [liveQuery])
  return results
}

function useLiveQueryPromise<T = { [key: string]: unknown }>(
  liveQueryPromise: Promise<LiveQuery<T>>,
): Results<T> | undefined {
  const [results, setResults] = useState<Results<T>>()
  const [liveQuery, setLiveQuery] = useState<LiveQuery<T>>()
  useEffect(() => {
    liveQueryPromise.then((liveQuery) => {
      setLiveQuery(liveQuery)
    })
  }, [liveQueryPromise])
  useEffect(() => {
    if (liveQuery) {
      setResults(liveQuery.initialResults)
      const cb = (results: Results<T>) => {
        setResults(results)
      }
      liveQuery.subscribe(cb)
      return () => {
        liveQuery.unsubscribe(cb)
      }
    } else {
      setResults(undefined)
      return () => {}
    }
  }, [liveQuery])
  return results
}

export function useLiveQuery<T = { [key: string]: unknown }>(
  query: string,
  params?: unknown[] | null,
): Results<T> | undefined

export function useLiveQuery<T = { [key: string]: unknown }>(
  liveQuery: LiveQuery<T>,
): Results<T>

export function useLiveQuery<T = { [key: string]: unknown }>(
  liveQueryPromise: Promise<LiveQuery<T>>,
): Results<T> | undefined

export function useLiveQuery<T = { [key: string]: unknown }>(
  query: string | LiveQuery<T> | Promise<LiveQuery<T>>,
  params?: unknown[] | null,
): Results<T> | undefined {
  if (typeof query === 'string') {
    return useLiveQueryImpl<T>(query, params)
  } else if (query instanceof Promise) {
    return useLiveQueryPromise<T>(query)
  } else {
    return useLiveQueryResult<T>(query)
  }
}

useLiveQuery.sql = function <T = { [key: string]: unknown }>(
  strings: TemplateStringsArray,
  ...values: any[]
): Results<T> | undefined {
  const { query, params } = buildQuery(strings, ...values)
  // eslint-disable-next-line react-compiler/react-compiler
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useLiveQueryImpl<T>(query, params)
}

export function useLiveIncrementalQuery<T = { [key: string]: unknown }>(
  query: string,
  params: unknown[] | undefined | null,
  key: string,
): Results<T> | undefined {
  return useLiveQueryImpl<T>(query, params, key)
}
