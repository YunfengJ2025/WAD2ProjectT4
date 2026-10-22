<template>
  <div class="legend small text-muted d-flex flex-wrap gap-3 mb-2">
    <span>🌧️ Skipped, rain forecast</span>
    <span>☀️ Extra watering, hot day</span>
    <span class="dot due"></span><span class="ms-n2">Due</span>
    <span class="dot overdue"></span><span class="ms-n2">Overdue</span>
  </div>
</template>

<style scoped>
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; align-self: center; }
.due { background: #ffc107; }
.overdue { background: #dc3545; }
</style>