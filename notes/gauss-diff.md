## Same law, zoomed in

$$\nabla\cdot\mathbf{E} = \frac{\rho_v}{\varepsilon_0}$$

This says the same thing as $\oint\mathbf{E}\cdot d\mathbf{S}=Q_{\text{enc}}/\varepsilon_0$, but at a point instead of over a region. The divergence theorem converts one into the other; neither is more true than the other.

## Reading it

At any point, the divergence of $\mathbf{E}$ is set by the charge density *at that point*. Where there is no charge, $\nabla\cdot\mathbf{E}=0$ however large $\mathbf{E}$ is. Where there is positive charge, field lines are born; where there is negative charge, they end.

## Why you want this form

The integral form is for *computing* $\mathbf{E}$ when there is enough symmetry. The differential form is for *reasoning*: substitute $\mathbf{E}=-\nabla V$ and you get Poisson's equation,

$$\nabla^2 V = -\frac{\rho_v}{\varepsilon_0},$$

a single scalar equation you can solve — analytically with boundary conditions, or numerically on a grid. Most of the field-solver software you will meet is solving this equation (or its time-varying cousins).

## Its twin

On the magnetic side the matching cell is $\nabla\cdot\mathbf{B}=0$: no magnetic charge, so no sources or sinks, ever.
