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
} from '../lib/format'
import type { Prediction, StockHistory } from '../types'

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
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-6 bg-slate-900" />
          Observed close
        </span>
        {hasForecast && (
          <span className="inline-flex items-center gap-2">
            <span className="w-6 border-t-2 border-dashed border-emerald-600" />
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
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickFormatter={(value) => formatShortDate(String(value))}
            />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickFormatter={(value) => formatCompactCurrency(Number(value))}
            />
            <Tooltip
              cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }}
              contentStyle={{
                borderRadius: 12,
                borderColor: '#e2e8f0',
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
              stroke="#0f172a"
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
                stroke="#059669"
                strokeWidth={2}
                strokeDasharray="6 5"
                dot={{ r: 3, fill: '#059669' }}
                connectNulls={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
