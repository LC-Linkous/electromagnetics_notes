## Circulation is a push around a loop

Pick a closed path. Circulation is how much the field pushes you along it as you go around:

$$\oint_L \mathbf{A}\cdot d\mathbf{l}$$

Again the dot product selects: only the component of $\mathbf{A}$ *along* the path counts. A field that is everywhere perpendicular to your loop has zero circulation around it no matter how strong it is.

## Two fields, two answers

For the static electric field the answer is always zero. Go around any loop and the pushes cancel; that is what lets you define a potential $V$ — the work from A to B does not depend on the route.

For the magnetic field the answer is $\mu_0$ times the current threading the loop. $\mathbf{B}$ circles currents, and a loop that encloses one picks up net circulation.

## Where it leads

- **Curl** is circulation per unit area: shrink the loop to a point and divide by the area it bounds.
- **Stokes' theorem** says the total circulation around a loop is the flux of the curl through any surface it bounds.
- The right-hand column of Maxwell's equations — $\nabla\times\mathbf{E}=0$ and Ampère's law — is about circulation.
