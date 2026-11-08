## The theorem

$$\oint_L \mathbf{A}\cdot d\mathbf{l} = \int_S (\nabla\times\mathbf{A})\cdot d\mathbf{S}$$

Circulation around a closed loop equals the flux of the curl through *any* surface bounded by that loop. Like the divergence theorem it is pure mathematics.

## Why it is true in one sentence

Curl *is* circulation per unit area, so adding up the curl over a surface adds up the circulation around every tiny patch — and the shared edges between neighbouring patches cancel, leaving only the outer loop.

## Two things worth noticing

- **The surface is yours to choose.** Any surface with the loop as its edge gives the same answer. Pick the flat one.
- **Orientation matters.** Walk the loop with the fingers of your right hand; your thumb is the surface normal. Flip one and you flip the sign.

## What it does in this course

It is the translator for the **right column** of Maxwell's equations.

Start from Ampère's law in integral form, $\oint\mathbf{B}\cdot d\mathbf{l}=\mu_0 I_{\text{enc}}$. Write $I_{\text{enc}}$ as $\int\mathbf{J}\cdot d\mathbf{S}$ and the left side via the theorem as $\int(\nabla\times\mathbf{B})\cdot d\mathbf{S}$. Equal for every surface, so equal integrands:

$$\nabla\times\mathbf{B} = \mu_0\mathbf{J}$$

The same move on $\oint\mathbf{E}\cdot d\mathbf{l}=0$ gives $\nabla\times\mathbf{E}=0$.
