## From a vector field to a scalar

$$V_{AB} = -\int_A^B \mathbf{E}\cdot d\mathbf{l}, \qquad \mathbf{E} = -\nabla V$$

Because the static electric field is conservative ($\oint\mathbf{E}\cdot d\mathbf{l}=0$), the work per unit charge to move from A to B does not depend on the path. That lets you give every point a single number, the potential. Choose a reference (usually $V=0$ at infinity for localized charges, or at ground for circuits) and $V$ is defined everywhere.

## Why this is worth the trouble

$V$ is a scalar. The potential of many charges is the plain sum of their individual potentials — no components, no directions. Compute $V$, then take $-\nabla V$ to get $\mathbf{E}$. For anything beyond a few point charges this is the shorter route.

## The two signs

- $\mathbf{E}=-\nabla V$: the field points *downhill* in potential, from high $V$ to low.
- $V=-\int\mathbf{E}\cdot d\mathbf{l}$: moving *against* the field raises the potential.

Both minus signs come from the same convention; get one and the other follows.

## Where it connects

- Substitute $\mathbf{E}=-\nabla V$ into Gauss's law and you get **Poisson's equation**, the general equation of electrostatics.
- Energy stored in a charge distribution is $\tfrac12\int\rho_v V\,dv$.
- The magnetic twin of $V$ is the vector potential $\mathbf{A}$: because $\nabla\cdot\mathbf{B}=0$, $\mathbf{B}=\nabla\times\mathbf{A}$. Zero curl gives a scalar potential; zero divergence gives a vector one.
