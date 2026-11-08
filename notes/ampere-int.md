## Circulation counts current

$$\oint_L \mathbf{B}\cdot d\mathbf{l} = \mu_0 I_{\text{enc}}$$

Go around any closed loop adding up $\mathbf{B}$ along the way. The total is $\mu_0$ times the current passing *through* the loop. Current beside the loop contributes nothing net.

This is Gauss's law's twin. Gauss: the flux of $\mathbf{E}$ through a closed surface counts enclosed *charge*. Ampère: the circulation of $\mathbf{B}$ around a closed loop counts threading *current*. Same structure, with the roles of flux and circulation swapped — because $\mathbf{E}$ diverges from its source and $\mathbf{B}$ circulates around its source.

## Using it

Exactly like Gauss's law, it is a statement about a total, and it gives you $\mathbf{B}$ only when symmetry lets you say $|\mathbf{B}|$ is constant along the loop and parallel to it. Then

$$|\mathbf{B}|\cdot(\text{loop length}) = \mu_0 I_{\text{enc}}$$

and you are done. Long straight wires, coaxial cables, solenoids and toroids all have such loops. A finite wire segment or a single loop of current does not — use Biot–Savart.

## Sign

Curl the fingers of your right hand the way you traverse the loop; current along your thumb counts as positive.

## Its differential form

Shrink the loop and Stokes' theorem gives $\nabla\times\mathbf{B}=\mu_0\mathbf{J}$.
