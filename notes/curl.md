## Circulation density at a point

Take a tiny loop around a point, compute the circulation, divide by the area, and shrink the loop. Do this for loops facing each of the three directions and you get a vector:

$$(\nabla\times\mathbf{A})\cdot\hat{\mathbf{a}}_n = \lim_{\Delta S\to 0}\frac{\oint \mathbf{A}\cdot d\mathbf{l}}{\Delta S}$$

The direction of the curl is the axis the field circulates around, by the right-hand rule. Imagine a small paddle wheel placed in the field: curl is how fast and about which axis it would spin.

## What zero curl does and does not mean

Zero curl does **not** mean the field is uniform or straight. The $\mathbf{B}$ field around a long wire circles the wire — yet outside the wire its curl is zero. A paddle wheel placed there is pushed harder on the inner side than the outer, but over a shorter arc, and the two effects cancel exactly.

Zero curl **does** mean the field is conservative: its line integral between two points is path-independent, and it can be written as the gradient of a scalar. That is the whole reason electric potential exists.

## In Maxwell's equations

$\nabla\times\mathbf{E}=0$ (statics) says the electric field never circulates. $\nabla\times\mathbf{B}=\mu_0\mathbf{J}$ says the magnetic field circulates exactly where current flows. Once fields vary in time, each of these gains a term involving the *other* field — that coupling is what makes waves.
