<template>
  <div class="chart-container">
    <!--
      [NOT IN WAD2 CONTENT] — <Bar> is a component from the vue-chartjs library
      (a Vue 3 wrapper around Chart.js). WAD2 weekly notes do not cover
      third-party charting libraries. Chart.js renders a canvas-based bar chart.
      v-if / v-else are covered in WAD2 wk4 (Vue Basics I).
    -->
    <Bar v-if="chartData && chartData.labels" :data="chartData" :options="chartOptions" />
    <div v-else class="loading-chart">
      <div class="spinner"></div>
      <p>Loading visualisations...</p>
    </div>
  </div>
</template>

<script setup>
// computed is covered in WAD2 wk4/wk5 (Vue Basics)
import { computed } from 'vue'

// [NOT IN WAD2 CONTENT] — chart.js and vue-chartjs are third-party libraries
// not taught in WAD2 weekly notes. They must be installed separately:
// pnpm add chart.js vue-chartjs
// ChartJS.register() registers the required chart modules (axes, tooltips, etc.)
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js'
import { Bar } from 'vue-chartjs'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// defineProps is covered in WAD2 wk6 (Vue Components — <script setup>)
const props = defineProps({
  chartData: { type: Object, required: true },
})

// computed is covered in WAD2 wk4/wk5
// chartOptions configures the Chart.js bar chart appearance
const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  // [NOT IN WAD2 CONTENT] — Chart.js animation config, not WAD2 content
  animation: { duration: 900, easing: 'easeOutQuart' },
  plugins: {
    legend: {
      position: 'top',
      labels: {
        font: { family: "'Outfit', 'Inter', sans-serif", size: 12, weight: '600' },
        usePointStyle: true,
        padding: 16,
        color: '#292524'
      }
    },
    tooltip: {
      backgroundColor: 'rgba(28, 25, 23, 0.92)',
      titleFont: { family: "'Outfit', sans-serif", size: 13, weight: '700' },
      bodyFont: { family: "'Inter', sans-serif", size: 12 },
      padding: 12,
      cornerRadius: 10,
      boxPadding: 4,
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { family: "'Inter', sans-serif", size: 11 }, color: '#78716c' }
    },
    y: {
      beginAtZero: true,
      ticks: { precision: 0, font: { family: "'Inter', sans-serif", size: 11 }, color: '#78716c' },
      grid: { color: 'rgba(0, 0, 0, 0.04)' }
    }
  }
}))
</script>

<style scoped>
/* scoped styles — covered implicitly in WAD2 wk6 Vue SFC structure */
.chart-container {
  position: relative;
  height: 270px;
  width: 100%;
}
.loading-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm); /* uses CSS custom property — [NOT IN WAD2 CONTENT] */
  height: 100%;
  color: var(--color-neutral-500);
  font-size: 0.9rem;
}
</style>
