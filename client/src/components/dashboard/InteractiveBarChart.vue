<template>
  <div class="chart-container">
    <Bar v-if="chartData && chartData.labels" :data="chartData" :options="chartOptions" />
    <Loading v-else label="Loading visualisations…" />
  </div>
</template>

<script setup>
import Loading from '@/components/Loading.vue'
import { computed } from 'vue'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js'
import { Bar } from 'vue-chartjs'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

defineProps({
  chartData: { type: Object, required: true },
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 900, easing: 'easeOutQuart' },
  plugins: {
    legend: {
      position: 'top',
      labels: {
        font: { family: "'Outfit', 'Inter', sans-serif", size: 12, weight: '600' },
        usePointStyle: true,
        padding: 16,
        color: '#292524',
      },
    },
    tooltip: {
      backgroundColor: 'rgba(28, 25, 23, 0.92)',
      titleFont: { family: "'Outfit', sans-serif", size: 13, weight: '700' },
      bodyFont: { family: "'Inter', sans-serif", size: 12 },
      padding: 12,
      cornerRadius: 10,
      boxPadding: 4,
    },
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
  gap: var(--space-sm);
  height: 100%;
  color: var(--color-neutral-500);
  font-size: 0.9rem;
}

@media (max-width: 767.98px) {
  .chart-container {
    height: 240px;
  }
}

@media (max-width: 575.98px) {
  .chart-container {
    height: 210px;
  }
}

@media (max-width: 379.98px) {
  .chart-container {
    height: 185px;
  }
}
</style>
