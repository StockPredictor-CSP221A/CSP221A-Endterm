import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatShortDate,
} from '@/lib/format'
import type { Prediction, StockHistory } from '@/types'

interface ChartPoint {
  date: string
  observed?: number
  predicted?: number
}

interface HistoryChartProps {
  history: StockHistory
  prediction: Prediction | null
}

export function HistoryChart({ history, prediction }: HistoryChartProps) {
  const data: ChartPoint[] = history.prices.map((point) => ({
    date: point.date,
    observed: point.close,
  }))

  const last = history.prices[history.prices.length - 1]
  const hasForecast = Boolean(
    prediction &&
      last &&
      prediction.symbol === history.symbol &&
      prediction.last_observed_date === last.date,
  )

  if (hasForecast && prediction && last) {
    data[data.length - 1] = {
      ...data[data.length - 1],
      predicted: last.close,
    }
    data.push({
      date: prediction.forecast_date,
      predicted: prediction.predicted_close,
    })
  }

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-6 bg-primary" />
          Observed close
        </span>
        {hasForecast && (
          <span className="inline-flex items-center gap-2">
            <span className="w-6 border-t-2 border-dashed border-gain" />
            Forecast
          </span>
        )}
      </div>
      <div
        className="h-80 w-full"
        aria-label={`${history.symbol} daily closing price chart`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              minTickGap={40}
              tick={{ fill: '#9095a1', fontSize: 11 }}
              tickFormatter={(value) => formatShortDate(String(value))}
            />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              tick={{ fill: '#9095a1', fontSize: 11 }}
              tickFormatter={(value) => formatCompactCurrency(Number(value))}
            />
            <Tooltip
              cursor={{ stroke: 'rgb(255 255 255 / 0.2)', strokeDasharray: '3 3' }}
              contentStyle={{
                backgroundColor: '#18191c',
                borderRadius: 12,
                borderColor: 'rgb(255 255 255 / 0.08)',
                fontSize: 12,
              }}
              labelFormatter={(label) => formatDate(String(label))}
              formatter={(value, name) => [
                formatCurrency(Number(value)),
                String(name),
              ]}
            />
            <Line
              type="monotone"
              name="Observed close"
              dataKey="observed"
              stroke="var(--brand)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
            />
            {hasForecast && (
              <Line
                type="monotone"
                name="Forecast"
                dataKey="predicted"
                stroke="var(--gain)"
                strokeWidth={2}
                strokeDasharray="6 5"
                dot={{ r: 3, fill: 'var(--gain)' }}
                connectNulls={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
