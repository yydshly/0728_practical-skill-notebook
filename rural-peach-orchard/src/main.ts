const root = document.querySelector<HTMLElement>('#app')!

if (window.location.pathname === '/feasibility') {
  const { bootstrapFeasibility } = await import(
    './feasibility/bootstrapFeasibility'
  )
  await bootstrapFeasibility(root)
} else {
  const { createAppShell } = await import('./app/createAppShell')
  createAppShell(root)
}

export {}
