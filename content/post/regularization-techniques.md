---
title: "Regularization in Neural Networks: What Each Method Actually Does"
date: 2025-01-28
author: "ZZ"
description: "L1, L2, dropout, batch normalization, early stopping — a clear-headed look at what each regularization technique does and why."
tags: ["deep learning", "regularization", "neural networks", "training"]
draft: false
---

Regularization is any technique that reduces overfitting — where a model learns the training data too well and fails to generalize. Here's a breakdown of the main approaches and what they're actually doing mechanically.

## L2 regularization (weight decay)

Add a penalty on large weights to the loss:

$$\mathcal{L}_{\text{reg}} = \mathcal{L} + \frac{\lambda}{2} \|\theta\|^2$$

The gradient of the penalty is $\lambda \theta$, so the update rule becomes:

$$\theta \leftarrow \theta - \eta(\nabla \mathcal{L} + \lambda \theta) = (1 - \eta\lambda)\theta - \eta\nabla\mathcal{L}$$

The $(1 - \eta\lambda)$ term *shrinks* the weights at every step — hence "weight decay." Large weights are penalized more, pushing the model toward solutions where no single parameter dominates.

**Geometric intuition**: L2 regularization constrains the weights to a ball around the origin. The solution trades off fitting the data and staying close to zero.

## L1 regularization (Lasso)

Penalty on the sum of absolute values:

$$\mathcal{L}_{\text{reg}} = \mathcal{L} + \lambda \|\theta\|_1$$

The gradient of $|\theta|$ is $\text{sign}(\theta)$ — constant magnitude regardless of weight size. This produces **sparse solutions**: weights get pushed all the way to exactly zero, effectively removing features. Useful when you want feature selection.

In practice, L1 is less common in deep learning than L2 because the non-differentiability at zero causes issues with gradient-based optimization (though subgradients handle this).

## Dropout

During training, randomly zero out each neuron's activation with probability $p$ (typically 0.1–0.5):

```python
import torch.nn as nn

class MLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Dropout(p=0.3),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(p=0.3),
            nn.Linear(128, 10),
        )
```

At inference time, dropout is disabled and activations are scaled by $(1 - p)$ to account for the expected fraction of active neurons during training.

**Why it works**: Several complementary explanations —
- Forces the network to learn redundant representations (no neuron can rely on others always being present)
- Effectively trains an ensemble of $2^n$ sub-networks sharing weights
- Acts as a form of noise injection that smooths the loss landscape

## Batch normalization

Normalize the activations within each mini-batch, then apply learned scale and shift:

$$\hat{x}_i = \frac{x_i - \mu_B}{\sqrt{\sigma_B^2 + \epsilon}}, \quad y_i = \gamma \hat{x}_i + \beta$$

where $\mu_B$ and $\sigma_B^2$ are the batch mean and variance, and $\gamma$, $\beta$ are learned parameters.

**Why this regularizes**: The normalization depends on the batch, introducing noise that acts like a regularizer. Also: it reduces internal covariate shift (distributions changing across layers as weights update), which allows higher learning rates and makes training more stable.

BN is applied between linear/conv layers and activations. At inference, batch statistics are replaced by running statistics accumulated during training.

## Early stopping

Monitor validation loss during training and stop when it starts increasing:

```python
best_val_loss = float('inf')
patience = 10
epochs_without_improvement = 0

for epoch in range(max_epochs):
    train(model, train_loader)
    val_loss = evaluate(model, val_loader)
    
    if val_loss < best_val_loss:
        best_val_loss = val_loss
        save_checkpoint(model)
        epochs_without_improvement = 0
    else:
        epochs_without_improvement += 1
    
    if epochs_without_improvement >= patience:
        load_checkpoint(model)
        break
```

Simple and effective. The implicit regularization comes from keeping the model in a region of parameter space it reached early in training, before it memorized noise.

## Data augmentation

Expand the effective training set by applying label-preserving transformations: flips, crops, rotations, color jitter (images), synonym replacement, back-translation (text). Forces the model to learn invariances rather than memorizing specific inputs.

This is often the most effective form of regularization when more data isn't available.

## Practical guidance

These aren't mutually exclusive — most modern networks use several simultaneously:

- BN is nearly universal in CNNs
- Dropout is standard in fully connected layers and Transformer heads
- Weight decay (AdamW) is the default for fine-tuning
- Data augmentation whenever the domain allows it
- Early stopping always, as a safety net

The right amount of regularization depends on dataset size and model capacity. More data → less regularization needed. Larger model → more regularization needed.
