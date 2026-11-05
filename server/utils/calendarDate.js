// Request dates are stored at midnight in Singapore, not the host's timezone.
function dateInSingapore(value) {
  return new Date(`${value}T00:00:00+08:00`);
}

module.exports = { dateInSingapore };
