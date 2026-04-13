import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

interface DailyAnalytics {
  date: string;
  detections: number;
  matches: number;
}

interface AnalyticsPanelProps {
  dailyAnalytics: DailyAnalytics[];
}

export default function AnalyticsPanel({ dailyAnalytics }: AnalyticsPanelProps) {
  if (!dailyAnalytics || dailyAnalytics.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-center">
        <p className="text-slate-400">No analytics data available yet.</p>
      </div>
    );
  }

  const labels = dailyAnalytics.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  const detections = dailyAnalytics.map(d => d.detections);
  const matches = dailyAnalytics.map(d => d.matches);

  const lineChartData = {
    labels,
    datasets: [
      {
        label: 'Total Detections',
        data: detections,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#06b6d4',
        pointBorderColor: '#fff',
        pointRadius: 5,
        pointHoverRadius: 7,
      },
      {
        label: 'Matches Found',
        data: matches,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  const barChartData = {
    labels,
    datasets: [
      {
        label: 'Detections',
        data: detections,
        backgroundColor: '#06b6d4',
        borderColor: '#0891b2',
        borderWidth: 1,
      },
      {
        label: 'Matches',
        data: matches,
        backgroundColor: '#10b981',
        borderColor: '#059669',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: {
          color: '#cbd5e1',
          font: { size: 12 },
          padding: 15,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#e2e8f0',
        bodyColor: '#cbd5e1',
        borderColor: '#475569',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(71, 85, 105, 0.2)' },
        ticks: { color: '#cbd5e1' },
      },
      y: {
        grid: { color: 'rgba(71, 85, 105, 0.2)' },
        ticks: { color: '#cbd5e1' },
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">7-Day Detections Trend</h3>
        <div className="h-80">
          <Line data={lineChartData} options={chartOptions} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Detections vs Matches</h3>
        <div className="h-80">
          <Bar data={barChartData} options={chartOptions} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Total Detections</p>
          <p className="text-3xl font-bold text-cyan-400">{detections.reduce((a, b) => a + b, 0)}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Total Matches</p>
          <p className="text-3xl font-bold text-emerald-400">{matches.reduce((a, b) => a + b, 0)}</p>
        </div>
      </div>
    </div>
  );
}
