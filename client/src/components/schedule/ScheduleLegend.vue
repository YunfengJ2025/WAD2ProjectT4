<template>
  <div class="legend" aria-label="Schedule legend">
    <div class="legend-group">
      <span class="legend-title">Weather</span>
      <span class="chip chip-rain" title="Rain is forecast, so the watering moved to the next day">
        <span class="chip-icon">🌧️</span>Skipped for rain
      </span>
      <span class="chip chip-heat" title="A hot day is forecast, so an extra watering was added today">
        <span class="chip-icon">☀️</span>Extra for heat
      </span>
    </div>

    <div class="legend-group">
      <span class="legend-title">Status</span>
      <span class="chip"><span class="dot dot-due"></span>Due</span>
      <span class="chip"><span class="dot dot-overdue"></span>Overdue</span>
      <span class="chip"><span class="dot dot-upcoming"></span>Upcoming</span>
    </div>
  </div>
</template>

<style scoped>
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  margin-bottom: 0.75rem;
}
.legend-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}
.legend-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
  margin-right: 0.15rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  font-size: 0.8rem;
  line-height: 1.2;
  color: #334155;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  cursor: help;               /* the hover text explains it */
}
.chip-icon { font-size: 1rem; line-height: 1; }

/* weather chips use the same tints as the adjusted cards */
.chip-rain { background: rgba(96, 165, 250, 0.18); border-color: rgba(96, 165, 250, 0.4); }
.chip-heat { background: rgba(251, 191, 36, 0.25); border-color: rgba(245, 158, 11, 0.5); }

/* the dots match the coloured strip on the left edge of each card */
.dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 50%;
}
.dot-due      { background: #ffc107; box-shadow: 0 0 0 3px rgba(255, 193, 7, 0.25); }
.dot-overdue  { background: #dc3545; box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.25); }
.dot-upcoming { background: #6c757d; box-shadow: 0 0 0 3px rgba(108, 117, 125, 0.25); }
</style>