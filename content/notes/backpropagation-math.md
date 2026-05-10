---
title: "Backpropagation: Working Through the Chain Rule"
date: 2025-03-20
author: "ZZ"
description: "A step-by-step derivation of backpropagation for a small network — no hand-waving."
tags: ["neural networks", "backpropagation", "math", "reference"]
draft: false
---

Backpropagation is just the chain rule applied systematically to a computation graph. Here's a clean derivation for a two-layer network.

## Setup

Two-layer network, single output, MSE loss:

- Input: $x \in \mathbb{R}^n$
- Layer 1: $h = \sigma(W_1 x + b_1)$, where $W_1 \in \mathbb{R}^{m \times n}$
- Layer 2: $\hat{y} = W_2 h + b_2$, where $W_2 \in \mathbb{R}^{1 \times m}$
- Loss: $\mathcal{L} = \frac{1}{2}(\hat{y} - y)^2$

We want $\frac{\partial \mathcal{L}}{\partial W_1}$, $\frac{\partial \mathcal{L}}{\partial W_2}$, etc.

## Forward pass (define intermediate quantities)

$$z_1 = W_1 x + b_1$$
$$h = \sigma(z_1)$$
$$z_2 = W_2 h + b_2$$
$$\hat{y} = z_2$$
$$\mathcal{L} = \frac{1}{2}(\hat{y} - y)^2$$

## Backward pass

Start from the loss, work backwards.

**$\frac{\partial \mathcal{L}}{\partial \hat{y}}$:**

$$\frac{\partial \mathcal{L}}{\partial \hat{y}} = \hat{y} - y$$

**$\frac{\partial \mathcal{L}}{\partial W_2}$** (chain rule through $z_2 = W_2 h + b_2$):

$$\frac{\partial \mathcal{L}}{\partial W_2} = \frac{\partial \mathcal{L}}{\partial \hat{y}} \cdot h^T = (\hat{y} - y) h^T$$

**$\frac{\partial \mathcal{L}}{\partial h}$:**

$$\frac{\partial \mathcal{L}}{\partial h} = W_2^T \cdot \frac{\partial \mathcal{L}}{\partial \hat{y}} = W_2^T (\hat{y} - y)$$

**$\frac{\partial \mathcal{L}}{\partial z_1}$** (elementwise, through $\sigma$):

$$\frac{\partial \mathcal{L}}{\partial z_1} = \frac{\partial \mathcal{L}}{\partial h} \odot \sigma'(z_1)$$

**$\frac{\partial \mathcal{L}}{\partial W_1}$:**

$$\frac{\partial \mathcal{L}}{\partial W_1} = \frac{\partial \mathcal{L}}{\partial z_1} \cdot x^T$$

## The pattern

Each layer's gradient follows the same structure:
1. Receive gradient from the layer above
2. Multiply by the local Jacobian (derivative of this layer's output w.r.t. its input)
3. Pass result to layer below

This is why it's called *back*propagation — gradients flow backward through the computation graph.

## Vanishing gradients

If $\sigma = \tanh$, then $\sigma'(z) \in (0, 1]$. In a deep network, the gradient is multiplied by $\sigma'$ at each layer. With many layers, this product approaches zero — gradients vanish and early layers learn very slowly.

ReLU ($\sigma'(z) = 1$ for $z > 0$) avoids this for active neurons. Residual connections (skip connections) in ResNets provide gradient highways that bypass the multiplicative chain entirely.

## Numerical gradient check

Always useful for verifying your implementation:

```python
def numerical_gradient(f, x, eps=1e-5):
    grad = np.zeros_like(x)
    for i in range(x.size):
        x_plus = x.copy(); x_plus.flat[i] += eps
        x_minus = x.copy(); x_minus.flat[i] -= eps
        grad.flat[i] = (f(x_plus) - f(x_minus)) / (2 * eps)
    return grad
```

Compare with analytical gradient. If they match to ~5 decimal places, your backprop is correct.
