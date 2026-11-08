## Flux is a count

Pick a surface. Flux is how much of a vector field passes through it:

$$\Psi = \int_S \mathbf{A}\cdot d\mathbf{S}$$

The dot product does the real work. Only the component of $\mathbf{A}$ *normal* to the surface counts; field running parallel to the surface contributes nothing. Picture field lines as threads and the surface as a net — flux is how many threads the net catches.

## Open vs. closed surfaces

Through an **open** surface (a disk, a coil's cross-section) flux can be anything, and its sign depends on which way you call the normal.

Through a **closed** surface the normal always points outward, and flux becomes a statement about what is *inside*: lines that start inside add to it; lines that pass through add nothing (in once, out once). That is why $\oint \mathbf{E}\cdot d\mathbf{S}$ measures enclosed charge, and $\oint \mathbf{B}\cdot d\mathbf{S}$ is always zero.

## Where it leads

- **Divergence** is flux per unit volume: shrink the closed surface to a point and divide by the volume.
- The **divergence theorem** says the total flux out of a closed surface is the volume integral of that density.
- The whole left-hand column of Maxwell's equations — Gauss's law and $\nabla\cdot\mathbf{B}=0$ — is about flux.
