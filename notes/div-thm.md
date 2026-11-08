## The theorem

$$\oint_S \mathbf{A}\cdot d\mathbf{S} = \int_v (\nabla\cdot\mathbf{A})\,dv$$

Net flux out of a closed surface equals the volume integral of the divergence inside. It is pure mathematics: it holds for any smooth vector field, with no physics in it.

## Why it is true in one sentence

Divergence *is* flux per unit volume, so adding up the divergence over a volume adds up the flux out of every tiny cell — and the flux between neighbouring cells cancels, leaving only the flux out of the outer boundary.

## What it does in this course

It is the translator for the **left column** of Maxwell's equations.

Start from Gauss's law in integral form, $\oint\mathbf{E}\cdot d\mathbf{S}=Q_{\text{enc}}/\varepsilon_0$. Write $Q_{\text{enc}}$ as $\int\rho_v\,dv$ and the left side via the theorem as $\int(\nabla\cdot\mathbf{E})\,dv$. The two volume integrals are equal for *every* volume, so the integrands must be equal:

$$\nabla\cdot\mathbf{E} = \frac{\rho_v}{\varepsilon_0}$$

The same move on $\oint\mathbf{B}\cdot d\mathbf{S}=0$ gives $\nabla\cdot\mathbf{B}=0$. Run the argument backwards and you recover the integral forms. Neither form is more fundamental; they are one law in two languages.

The **right column** has its own translator — Stokes' theorem — doing the same job for circulation and curl.
