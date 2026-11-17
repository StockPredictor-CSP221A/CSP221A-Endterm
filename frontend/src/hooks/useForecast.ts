import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { queryKeys } from '@/lib/query-keys'
import { api, errorText } from '@/services/api'

export function useForecast(symbol: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['forecast', symbol],
    mutationFn: () => api.predict(symbol),
    onSuccess: () => {
      toast.success('Forecast saved.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.predictions })
    },
    onError: (error) => {
      toast.error(`${symbol} forecast failed`, { description: errorText(error) })
    },
  })
}
