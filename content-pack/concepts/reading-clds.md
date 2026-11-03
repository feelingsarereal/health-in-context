---
id: reading-clds
title: Reading a causal loop diagram
one_liner: "Arrows marked + or − join circumstances; where arrows close into a loop, a change can feed itself or check itself."
why_here: "Your map is a causal loop diagram; the Loops, Paths and Leverage panels all read it this way."
prerequisites: []
terms: [cld, link-polarity, reinforcing-loop, balancing-loop, elementary-circuit, scc, leverage-hint]
further_reading:
  - { title: "Richardson (1986), Problems with causal-loop diagrams", url: "https://doi.org/10.1002/sdr.4260020207", kind: review }
  - { title: "Homer & Hirsch (2006), System dynamics modeling for public health", url: "https://doi.org/10.2105/AJPH.2005.062059", kind: review }
  - { title: "McGlashan et al. (2016), Quantifying a systems map", url: "https://doi.org/10.1371/journal.pone.0165459", kind: review }
---

## What it is

<!-- framing -->
A causal loop diagram joins variables with arrows marked **+** or **−**. In this app a **+** arrow means that, all else equal, a rise in the cause leaves the effect higher than it would otherwise have been (and a fall leaves it lower); a **−** arrow means the reverse. That is Richardson's wording: the simpler "moves in the same direction" fails when the cause is a flow filling something that accumulates [52]. Each box is read as a quantity that can go up or down, not as an event.

Causal loop diagrams spread as a way to make system dynamics accessible to more people [52]. System dynamics, which portrays processes of accumulation and feedback, is well suited to the dynamic complexity of many public-health problems [56].

<!-- framing -->
When arrows close into a loop, the loop's character is the product of its signs. An even number of − links makes it **reinforcing** (R): a change comes back pushing the same way, as in a vicious or virtuous cycle. An odd number makes it **balancing** (B): a change comes back pushing against itself. The sign gives the direction only, not how strong the loop is. Richardson recommends defining a loop's polarity by the number of its − links, and warns against reading behaviour off a causal-loop diagram alone [52]; which loop dominates can shift as behaviour unfolds [53]. This app reads structure only and does not simulate behaviour over time, so it cannot say which loop dominates.

## The maths, gently

$$ \text{sign}(\text{loop}) = \prod_{\text{links } i \in \text{loop}} s_i, \qquad s_i \in \{+1, -1\} $$

- $s_i$ is the sign of link $i$; the product is $+1$ for a reinforcing loop and $-1$ for a balancing one.

The app lists every loop with Johnson's algorithm, which finds every elementary circuit of a directed graph [54]. It groups nodes that sit inside shared feedback using graph partitions [55], and it ranks nodes with network measures, which can flag central variables as candidate leverage points [57].

## How this app uses it

<!-- framing -->
Each node is read as "how much of this circumstance is present". Loop strength and leverage are structural heuristics, labelled as such: they are prompts for discussion, not findings about the person or group.

<!-- framing -->
Every ICD-11 code here names a problem, so a protective factor — a supportive sister, a benefits advisor, a stable job — is added as an "other" node of type resource. Its links to the problems it eases are − links, and like every link without a matching evidence link they are marked as overrides.
