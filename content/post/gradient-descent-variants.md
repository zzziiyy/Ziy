---
title: "Gradient Descent Variants: SGD, Momentum, Adam"
date: 2025-03-05
author: "ZZ"
description: "A practical comparison of gradient descent variants — what problem each one solves and when to use which."
tags: ["optimization", "deep learning", "training", "python"]
draft: false
---

Optimization algorithms are one of those areas where the theory is clean and the practice is messy. Here's a walkthrough of the main variants and what they're actually doing.

## Vanilla gradient descent

The basic update rule:

$$\theta \leftarrow \theta - \eta \nabla_\theta \mathcal{L}(\theta)$$

Compute the gradient of the loss with respect to all parameters, scale by learning rate $\eta$, subtract. Simple.

**Problems:**
- **Full-batch GD**: gradient is computed over the entire dataset — slow and memory-intensive for large datasets
- **SGD** (stochastic): gradient from a single sample — fast but very noisy, loss bounces around
- **Mini-batch SGD**: compromise — gradient from a small batch (typically 32–512 samples)

In practice "SGD" usually means mini-batch SGD.

## The problem SGD alone doesn't solve: ravines

Imagine a loss surface shaped like a narrow valley. Gradient descent oscillates across the narrow dimension while making slow progress along the valley floor. The gradients perpendicular to the direction of steepest descent cancel out poorly.

## Momentum

Add a velocity term that accumulates gradients:

$$v_t = \beta v_{t-1} + (1 - \beta) \nabla_\theta \mathcal{L}$$
$$\theta \leftarrow \theta - \eta v_t$$

$\beta$ is typically 0.9. The velocity averages recent gradients — consistent directions accumulate, oscillating directions cancel. This damps the ravine problem and speeds up progress in smooth directions.

**Nesterov momentum** computes the gradient at the "lookahead" position $\theta - \beta v_{t-1}$ rather than at the current position. Slightly better convergence in practice.

## AdaGrad

Adapts the learning rate per parameter based on historical gradient magnitudes:

$$G_t = G_{t-1} + g_t^2$$
$$\theta \leftarrow \theta - \frac{\eta}{\sqrt{G_t + \epsilon}} g_t$$

Parameters that receive large gradients get a smaller effective learning rate; rarely-updated parameters get a larger one. Useful for sparse features (e.g., word embeddings where most words appear rarely).

**Problem**: $G_t$ only grows, so the learning rate shrinks monotonically and eventually becomes vanishingly small.

## RMSProp

Fix AdaGrad's shrinking learning rate with an exponential moving average:

$$G_t = \gamma G_{t-1} + (1 - \gamma) g_t^2$$
$$\theta \leftarrow \theta - \frac{\eta}{\sqrt{G_t + \epsilon}} g_t$$

The window size is controlled by $\gamma$ (typically 0.99). Old gradients decay, so the denominator reflects recent curvature rather than accumulated history.

## Adam

Combines momentum (first moment) with RMSProp (second moment):

$$m_t = \beta_1 m_{t-1} + (1 - \beta_1) g_t \quad \text{(mean)}$$
$$v_t = \beta_2 v_{t-1} + (1 - \beta_2) g_t^2 \quad \text{(variance)}$$

Bias correction (both moments are initialized at zero, so they're biased toward zero early in training):

$$\hat{m}_t = \frac{m_t}{1 - \beta_1^t}, \quad \hat{v}_t = \frac{v_t}{1 - \beta_2^t}$$

Update:

$$\theta \leftarrow \theta - \frac{\eta}{\sqrt{\hat{v}_t} + \epsilon} \hat{m}_t$$

Default hyperparameters ($\beta_1 = 0.9$, $\beta_2 = 0.999$, $\epsilon = 10^{-8}$) work well across a wide range of problems. This is why Adam is the default optimizer for most deep learning work.

## Quick implementation comparison

```python
import torch.optim as optim

# SGD with momentum
optimizer = optim.SGD(model.parameters(), lr=0.01, momentum=0.9)

# Adam
optimizer = optim.Adam(model.parameters(), lr=1e-3)

# AdamW (Adam with decoupled weight decay — usually better than Adam)
optimizer = optim.AdamW(model.parameters(), lr=1e-3, weight_decay=0.01)
```

## When to use what

| Optimizer | When |
|-----------|------|
| SGD + momentum | When you want tight control, CNNs for vision |
| Adam | Default for most tasks, especially NLP |
| AdamW | Fine-tuning pretrained models |
| RMSProp | RNNs, RL |

## The generalization gap

There's a known phenomenon where Adam converges faster but SGD with careful learning rate scheduling sometimes achieves better final test accuracy. The intuition: Adam adapts to the curvature locally, which can lead it to sharp minima that don't generalize as well. SGD with momentum tends toward flatter minima.

This is not a universal finding — it's problem-dependent — but it's why some practitioners switch to SGD late in training or use schedulers aggressively.
