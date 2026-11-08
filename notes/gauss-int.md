## What the law actually says

Gauss's law counts field lines. Draw *any* closed surface, add up how much $\mathbf{E}$ pokes out through it, and the answer is fixed by the charge inside:

$$\oint_S \mathbf{E}\cdot d\mathbf{S} = \frac{Q_{\text{enc}}}{\varepsilon_0}$$

Three things follow immediately:

- Charge *outside* the surface contributes nothing to the net flux. Its field lines go in one side and out the other.
- The shape of the surface doesn't matter. A sphere, a cube and a potato around the same charge all give the same flux.
- The law is a statement about a *total*. It says nothing about $\mathbf{E}$ at any particular point unless you can argue, from symmetry, that $|\mathbf{E}|$ is the same everywhere on the surface.

## Why it's the same as Coulomb's law

Put a point charge $Q$ at the center of a sphere of radius $r$. Coulomb gives $|\mathbf{E}| = Q/(4\pi\varepsilon_0 r^2)$, radial. The flux is $|\mathbf{E}|$ times the area:

$$\frac{Q}{4\pi\varepsilon_0 r^2}\cdot 4\pi r^2 = \frac{Q}{\varepsilon_0}$$

The $r^2$ cancels — that cancellation *is* Gauss's law. It works because the field falls off exactly as $1/r^2$ while area grows exactly as $r^2$.

## Where it sits in the map

This is the top-left cell of the static Maxwell equations: the **divergence** half of the **electric** field. Its twin on the magnetic side is Ampère's law, which does the same job with circulation instead of flux. Its differential form, $\nabla\cdot\mathbf{E} = \rho_v/\varepsilon_0$, is what you get by shrinking the surface to a point — the divergence theorem is the bridge.
