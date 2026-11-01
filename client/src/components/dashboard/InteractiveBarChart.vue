<template>
  <div class="chart-container">
    <!--
      <Bar> is a component from the vue-chartjs library (a Vue 3 wrapper around Chart.js).
      It renders an HTML <canvas> bar chart, styled via the chartOptions computed below.

      v-if / v-else — covered in WAD2 wk4 (Vue Basics I):
        - v-if="chartData && chartData.labels": only render the chart when data has loaded.
          We check BOTH chartData (not null) AND chartData.labels (array exists).
          If we only checked chartData, an empty {} object would pass the check and
          Chart.js would crash trying to render with no labels.
        - v-else: shows a spinner and "Loading..." text while the API call is in-flight.

      [NOT IN WAD2 CONTENT] — vue-chartjs and Chart.js are third-party libraries.
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

// [NOT IN WAD2 CONTENT] — chart.js and vue-chartjs are third-party libraries.
// Chart.js v3+ is tree-shakeable: you only bundle the modules you actually use.
// ChartJS.register() tells Chart.js which modules to activate:
//   - BarElement: draws the actual bars
//   - CategoryScale: the X-axis (month names are string categories, not numbers)
//   - LinearScale: the Y-axis (numeric count/token values)
//   - Title, Tooltip, Legend: UI overlay plugins
// Forgetting to register a module results in a silent broken render.
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

// defineProps — covered in WAD2 wk6 (Vue Components — <script setup>)
// chartData is passed down from DashboardView.vue via :chartData="activityChartData".
// type: Object validates the prop at runtime in dev mode.
// required: true means Vue will warn in the console if the parent forgets to pass it.
const props = defineProps({
  chartData: { type: Object, required: true },
})

// computed — covered in WAD2 wk4/wk5
// chartOptions configures the Chart.js bar chart's visual behaviour.
// Using computed() (instead of a plain const) means if any reactive dependency changes,
// the options update and Chart.js re-renders — though in practice these options are static.
const chartOptions = computed(() => ({
  responsive: true,
  // maintainAspectRatio: false — [NOT IN WAD2 CONTENT]
  // By default Chart.js locks a fixed width:height ratio, breaking responsive layouts.
  // Setting this to false lets the chart fill the parent <div> freely.
  // Height is then controlled via CSS: .chart-container { height: 270px }
  maintainAspectRatio: false,
  // animation — [NOT IN WAD2 CONTENT] Chart.js animation config
  // duration: 900ms means bars grow from 0 upward over 900ms when the chart first renders.
  // easing: 'easeOutQuart' is a CSS-style easing curve (fast start, slow finish).
  animation: { duration: 900, easing: 'easeOutQuart' },
  plugins: {
    legend: {
      position: 'top',
      labels: {
        font: { family: "'Outfit', 'Inter', sans-serif", size: 12, weight: '600' },
        usePointStyle: true, // shows circle markers in legend instead of square boxes
        padding: 16,
        color: '#292524',
      },
    },
    tooltip: {
      // Custom dark tooltip popup on hover — [NOT IN WAD2 CONTENT]
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
      grid: { display: false }, // hides vertical gridlines for a cleaner look
      ticks: { font: { family: "'Inter', sans-serif", size: 11 }, color: '#78716c' }
    },
    y: {
      beginAtZero: true, // always starts Y-axis at 0, even if min data value is higher
      // precision: 0 ensures Y-axis shows whole numbers only (1, 2, 3...) not (1.5, 2.5...)
      ticks: { precision: 0, font: { family: "'Inter', sans-serif", size: 11 }, color: '#78716c' },
      grid: { color: 'rgba(0, 0, 0, 0.04)' } // subtle horizontal gridlines
    }
  }
}))
</script>

<style scoped>
/* scoped styles — covered implicitly in WAD2 wk6 Vue SFC structure */
/* <style scoped> adds a unique data-v-xxxxxxxx attribute to elements in this component
   so these CSS rules only apply here and don't bleed into other components. */
.chart-container {
  position: relative;
  height: 270px; /* fixed height needed because maintainAspectRatio is false */
  width: 100%;
}
.loading-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm); /* CSS custom property — [NOT IN WAD2 CONTENT] */
  height: 100%;
  color: var(--color-neutral-500);
  font-size: 0.9rem;
}
</style>
