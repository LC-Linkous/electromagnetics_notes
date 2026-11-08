## The magnetic potential is a vector

Because $\nabla\cdot\mathbf{B}=0$ everywhere, $\mathbf{B}$ can always be written as the curl of something:

$$\mathbf{B} = \nabla\times\mathbf{A}$$

(the divergence of a curl is identically zero, so this is consistent). For a current distribution,

$$\mathbf{A} = \frac{\mu_0}{4\pi}\int\frac{I\,d\mathbf{l}}{R},$$

which is Biot–Savart without the cross product — and one power of $R$ gentler.

## Why a vector, when $V$ was a scalar

The two potentials come from the two "equals zero" equations. $\nabla\times\mathbf{E}=0$ says $\mathbf{E}$ is a gradient, and gradients are of scalars. $\nabla\cdot\mathbf{B}=0$ says $\mathbf{B}$ is a curl, and curls are of vectors. The shape of the potential follows from which derivative vanishes.

## Gauge freedom

$\mathbf{A}$ is not unique. Add $\nabla\psi$ for any scalar $\psi$ and $\mathbf{B}$ is unchanged, since $\nabla\times\nabla\psi=0$. Picking a $\psi$ is called choosing a gauge; in magnetostatics the usual choice is $\nabla\cdot\mathbf{A}=0$, which makes $\mathbf{A}$ satisfy a vector Poisson equation $\nabla^2\mathbf{A}=-\mu_0\mathbf{J}$ — the exact twin of $\nabla^2 V=-\rho_v/\varepsilon_0$.

## Why bother, in this course

In statics $\mathbf{A}$ is mostly a calculational convenience and a way to see the E/B symmetry completed. It earns its keep later: in time-varying fields $\mathbf{E}$ picks up a $-\partial\mathbf{A}/\partial t$ term, and in radiation and quantum mechanics $\mathbf{A}$ is the natural variable.
