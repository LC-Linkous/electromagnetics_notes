## No work around a loop

$$\oint_L \mathbf{E}\cdot d\mathbf{l} = 0$$

Carry a test charge around any closed path in a static electric field and the net work is zero. Whatever the field gives you going down it takes back going up.

## Why this is the important consequence

Zero around every loop means the integral from A to B is the same along *any* route. So you can assign a single number to every point — the work per unit charge to get there from a reference — and that number is the **electric potential** $V$:

$$V_{AB} = -\int_A^B \mathbf{E}\cdot d\mathbf{l}$$

A scalar field that adds as plain numbers, instead of a vector field that adds component by component. Almost every practical electrostatics calculation goes through $V$ for this reason.

## Why it is true

Coulomb's law is a central force: each charge's field points straight toward or away from it and depends only on distance. Central forces are conservative. Sum any number of them and the sum is still conservative.

## Its differential form and its twin

Shrink the loop and Stokes' theorem gives $\nabla\times\mathbf{E}=0$: the static electric field has no curl anywhere. This is the cell that Faraday's law will later fill — a changing magnetic field *does* produce circulating $\mathbf{E}$.

On the magnetic side, the matching "equals zero" cell is $\oint\mathbf{B}\cdot d\mathbf{S}=0$: no magnetic charge. The two zero-cells are twins; together they are the empty seats where time-dependence sits down.
