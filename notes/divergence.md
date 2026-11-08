## Flux density at a point

Take a tiny closed surface around a point, compute the net outward flux, divide by the volume, and let the volume shrink to zero:

$$\nabla\cdot\mathbf{A} = \lim_{\Delta v\to 0}\frac{\oint \mathbf{A}\cdot d\mathbf{S}}{\Delta v}$$

In Cartesian coordinates this works out to $\partial A_x/\partial x + \partial A_y/\partial y + \partial A_z/\partial z$. In other coordinate systems the formula picks up extra factors — look it up rather than guessing.

## What positive, negative and zero mean

- **Positive**: field lines are born here. A source.
- **Negative**: field lines die here. A sink.
- **Zero**: whatever comes in goes out. This is the usual case in empty space.

The field of a point charge is the classic trap. The lines visibly spread apart as you move out, yet $\nabla\cdot\mathbf{E}=0$ everywhere except *at* the charge. Spreading lines that weaken as $1/r^2$ exactly balance; the divergence is concentrated where the charge actually is.

## In Maxwell's equations

$\nabla\cdot\mathbf{E}=\rho_v/\varepsilon_0$ says electric field lines are born on positive charge and die on negative charge. $\nabla\cdot\mathbf{B}=0$ says magnetic field lines are never born and never die — they close on themselves.
