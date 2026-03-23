import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { dataLabelsPlugin } from './dataLabelsPlugin';

let registered = false;

/** Call once from client components before rendering charts */
export function registerDashboardCharts() {
  if (registered) return;
  registered = true;
  ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    dataLabelsPlugin,
  );
}
