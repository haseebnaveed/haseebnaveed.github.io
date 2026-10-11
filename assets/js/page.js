// The story's "read the full story".
document.querySelectorAll('.story').forEach(s => {
  const b = s.querySelector('.story-btn');
  if (b) b.addEventListener('click', () => { const o = s.classList.toggle('open'); b.textContent = o ? 'Show less' : 'Read the full story'; b.setAttribute('aria-expanded', o); });
});
