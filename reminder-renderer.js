window.reminder.onShow((pct) => {
  document.getElementById('fill').style.width = `${pct}%`;
  document.body.classList.add('visible');
});

window.reminder.onHide(() => {
  document.body.classList.remove('visible');
});
