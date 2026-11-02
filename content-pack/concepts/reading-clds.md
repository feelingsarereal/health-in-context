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
A causal loop diagram joins variables with arrows marked **+** or **−**. In this app a **+** arrow means that, all else equal, a change in the cause moves the effect in the same direction, and a **−** arrow means it moves it the opposite way. Each box is read as a quantity that can go up or down, not as an event.

System dynamics uses feedback maps like this to study public-health problems shaped by accumulation and feedback [54].

<!-- framing -->
When arrows close into a loop, the loop's character is the product of its signs. An even number of − links makes it **reinforcing** (R): a change returns amplified, as in a vicious or virtuous cycle. An odd number makes it **balancing** (B): a change returns opposed. This app reads structure only; it does not simulate behaviour over time, so it cannot say which loop dominates. George Richardson's papers on causal-loop diagrams and loop polarity are listed under further reading (not yet verified here).

## The maths, gently

$$ \text{sign}(\text{loop}) = \prod_{\text{links } i \in \text{loop}} s_i, \qquad s_i \in \{+1, -1\} $$

- $s_i$ is the sign of link $i$; the product is $+1$ for a reinforcing loop and $-1$ for a balancing one.

The app lists every loop with Johnson's algorithm, which finds every elementary circuit of a directed graph [52]. It groups nodes that sit inside shared feedback using graph partitions [53], and it ranks nodes with network measures, which can flag central variables as candidate leverage points [55].

## How this app uses it

<!-- framing -->
Each node is read as "how much of this circumstance is present". Loop strength and leverage are structural heuristics, labelled as such: they are prompts for discussion, not findings about the person or group.

<!-- framing -->
Every ICD-11 code here names a problem, so a protective factor — a supportive sister, a benefits advisor, a stable job — is added as an "other" node of type resource. Its links to the problems it eases are − links, and like every link without a matching evidence link they are marked as overrides.
