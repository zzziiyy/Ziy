---
title: "Loss Functions: When to Use What"
date: 2025-02-14
author: "ZZ"
description: "A reference for common loss functions in supervised learning — regression, classification, and the cases where the standard choice is wrong."
tags: ["machine learning", "loss functions", "reference", "training"]
draft: false
---

## Regression

### MSE (Mean Squared Error)

$$\mathcal{L} = \frac{1}{n}\sum_i (y_i - \hat{y}_i)^2$$

Default choice. Penalizes large errors heavily (quadratic). Differentiable everywhere. Sensitive to outliers because squaring amplifies them.

### MAE (Mean Absolute Error)

$$\mathcal{L} = \frac{1}{n}\sum_i |y_i - \hat{y}_i|$$

Robust to outliers. Gradient is constant ($\pm 1$), which can cause instability near the minimum. Better when your data has genuine outliers you don't want to overfit.

### Huber Loss

$$\mathcal{L}_\delta = \begin{cases} \frac{1}{2}(y - \hat{y})^2 & \text{if } |y - \hat{y}| \leq \delta \\ \delta |y - \hat{y}| - \frac{1}{2}\delta^2 & \text{otherwise} \end{cases}$$

MSE near zero, MAE for large errors. Best of both: smooth gradients when close, robust when far. $\delta$ is a hyperparameter controlling the transition.

### When MSE is wrong

If your target distribution has heavy tails or frequent outliers, MSE trains the model to "chase" the outliers (high penalty = large gradient). MAE or Huber Loss is usually better in that case.

---

## Binary Classification

### Binary Cross-Entropy

$$\mathcal{L} = -\frac{1}{n}\sum_i \left[ y_i \log \hat{p}_i + (1-y_i)\log(1-\hat{p}_i) \right]$$

The standard. Pairs naturally with sigmoid output. Penalizes confident wrong predictions heavily (log of probability near 0 goes to $-\infty$).

### Focal Loss

$$\mathcal{L}_{\text{focal}} = -\alpha (1 - \hat{p})^\gamma \log \hat{p}$$

Addresses class imbalance. Down-weights easy examples ($(1 - \hat{p})^\gamma \to 0$ when the model is confident and correct) so training focuses on hard examples. Common in object detection.

---

## Multi-class Classification

### Categorical Cross-Entropy (Softmax Loss)

$$\mathcal{L} = -\sum_i y_i \log \hat{p}_i$$

Standard for multi-class. One-hot $y$, softmax $\hat{p}$. Minimizing this is equivalent to maximizing log-likelihood under a categorical distribution.

### Label Smoothing

Replace one-hot targets with soft targets: $(1 - \epsilon)$ for the true class, $\epsilon / (K-1)$ for others. Prevents overconfident predictions. Common in image classification, helps generalization.

```python
# PyTorch
criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
```

---

## Ranking / Metric Learning

### Contrastive Loss

Pulls similar pairs together, pushes dissimilar pairs apart:

$$\mathcal{L} = y \cdot d^2 + (1-y) \cdot \max(0, m - d)^2$$

where $d$ is distance between embeddings and $m$ is a margin.

### Triplet Loss

Given an anchor, a positive (same class), and a negative (different class):

$$\mathcal{L} = \max(0, d(a, p) - d(a, n) + \text{margin})$$

Directly optimizes relative distances. Requires careful triplet mining — random triplets are mostly easy and provide no gradient.

---

## Quick decision guide

| Problem | Default loss |
|---------|-------------|
| Regression, clean data | MSE |
| Regression, outliers present | Huber |
| Binary classification | BCE |
| Multi-class | Cross-entropy |
| Imbalanced classes | Focal loss |
| Embedding learning | Triplet / contrastive |
| Sequence generation | Cross-entropy (token-level) |
