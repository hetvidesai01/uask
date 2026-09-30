import { useSyncExternalStore } from 'react'
import {
  getPreferredCurrency,
  setPreferredCurrency,
  subscribeToCurrencyPreference,
} from '../utils/formatCurrency'

// Live view of the Default Currency preference. Persistence and the
// conversion rates live in utils/formatCurrency.js.
export function useCurrencyPreference() {
  const currency = useSyncExternalStore(subscribeToCurrencyPreference, getPreferredCurrency)
  return [currency, setPreferredCurrency]
}
