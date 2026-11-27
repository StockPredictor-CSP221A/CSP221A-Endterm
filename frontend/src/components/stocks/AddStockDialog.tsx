import { Plus } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { FormAlert } from '@/components/auth/FormAlert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MAX_ADDED_STOCKS, normalizeTicker } from '@/data/stocks'
import { useAddStock, useWatchlist } from '@/hooks/useWatchlist'
import { errorText } from '@/services/api'

interface AddStockDialogProps {
  /** Custom trigger; defaults to an "Add stock" button. */
  trigger?: ReactNode
  /** Open the stock's page after it is added. */
  openAfterAdd?: boolean
}

export function AddStockDialog({ trigger, openAfterAdd = false }: AddStockDialogProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const addStock = useAddStock()
  const watchlist = useWatchlist()
  const navigate = useNavigate()

  const addedCount = watchlist.data?.filter((entry) => !entry.is_default).length ?? 0
  const atLimit = addedCount >= MAX_ADDED_STOCKS
  const error = localError ?? (addStock.error ? errorText(addStock.error) : null)

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setValue('')
      setLocalError(null)
      addStock.reset()
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ticker = normalizeTicker(value)
    if (!ticker) {
      setLocalError('Enter a ticker like AAPL, MSFT, or BRK-B.')
      return
    }
    if (watchlist.data?.some((entry) => entry.symbol === ticker)) {
      setLocalError(`${ticker} is already on your watchlist.`)
      return
    }
    setLocalError(null)
    addStock.mutate(ticker, {
      onSuccess: (entry) => {
        onOpenChange(false)
        if (openAfterAdd) navigate(`/stocks/${entry.symbol}`)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="h-9">
            <Plus aria-hidden data-icon="inline-start" />
            Add stock
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <DialogHeader>
            <DialogTitle>Add a stock</DialogTitle>
            <DialogDescription>
              Track any ticker alongside SPY, NVDA, and KO. You can see its prices and news
              and run forecasts on it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="add-stock-ticker">Ticker symbol</Label>
            <Input
              id="add-stock-ticker"
              value={value}
              onChange={(event) => {
                setValue(event.target.value.toUpperCase())
                setLocalError(null)
                if (addStock.isError) addStock.reset()
              }}
              placeholder="e.g. AAPL"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={10}
              autoFocus
              disabled={addStock.isPending || atLimit}
              aria-invalid={error ? true : undefined}
              aria-describedby="add-stock-hint"
              className="h-10 font-medium tracking-wide"
            />
            <p id="add-stock-hint" className="text-xs text-muted-foreground tabular-nums">
              {atLimit
                ? `You have added the maximum of ${MAX_ADDED_STOCKS} stocks. Remove one to add another.`
                : `${addedCount} of ${MAX_ADDED_STOCKS} added stocks used.`}
            </p>
          </div>

          <FormAlert message={error} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addStock.isPending || atLimit || !value.trim()}>
              {addStock.isPending ? 'Checking ticker…' : 'Add to watchlist'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
