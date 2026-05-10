---
title: "Training an MLP from Scratch in NumPy"
date: 2025-04-15
author: "ZZ"
description: "Building a two-layer neural network with forward pass, backprop, and training loop — no PyTorch, no autograd."
tags: ["neural networks", "numpy", "from scratch", "experiment"]
draft: false
---

**Status:** Done. Works on XOR and MNIST subset.

## Why bother

Frameworks hide the mechanics. Writing backprop by hand once is worth it — afterwards you understand what autograd is doing and gradient debugging feels less like guesswork.

## The network

Two-layer MLP: input → hidden (ReLU) → output (softmax) → cross-entropy loss.

```python
import numpy as np

class MLP:
    def __init__(self, input_dim, hidden_dim, output_dim, lr=0.01):
        # He initialization for ReLU
        self.W1 = np.random.randn(input_dim, hidden_dim) * np.sqrt(2 / input_dim)
        self.b1 = np.zeros((1, hidden_dim))
        self.W2 = np.random.randn(hidden_dim, output_dim) * np.sqrt(2 / hidden_dim)
        self.b2 = np.zeros((1, output_dim))
        self.lr = lr

    def relu(self, x):
        return np.maximum(0, x)

    def softmax(self, x):
        e = np.exp(x - x.max(axis=1, keepdims=True))  # numerical stability
        return e / e.sum(axis=1, keepdims=True)

    def forward(self, X):
        self.X = X
        self.z1 = X @ self.W1 + self.b1
        self.h = self.relu(self.z1)
        self.z2 = self.h @ self.W2 + self.b2
        self.probs = self.softmax(self.z2)
        return self.probs

    def loss(self, probs, y):
        n = y.shape[0]
        log_probs = -np.log(probs[np.arange(n), y] + 1e-9)
        return log_probs.mean()

    def backward(self, y):
        n = y.shape[0]

        # Output layer gradient
        dz2 = self.probs.copy()
        dz2[np.arange(n), y] -= 1
        dz2 /= n

        dW2 = self.h.T @ dz2
        db2 = dz2.sum(axis=0, keepdims=True)

        # Hidden layer gradient
        dh = dz2 @ self.W2.T
        dz1 = dh * (self.z1 > 0)  # ReLU derivative

        dW1 = self.X.T @ dz1
        db1 = dz1.sum(axis=0, keepdims=True)

        # Update
        self.W2 -= self.lr * dW2
        self.b2 -= self.lr * db2
        self.W1 -= self.lr * dW1
        self.b1 -= self.lr * db1

    def train_step(self, X, y):
        probs = self.forward(X)
        l = self.loss(probs, y)
        self.backward(y)
        return l
```

## Training loop

```python
model = MLP(input_dim=784, hidden_dim=128, output_dim=10, lr=0.1)

for epoch in range(50):
    # Mini-batch SGD
    indices = np.random.permutation(len(X_train))
    total_loss = 0
    for i in range(0, len(X_train), 64):
        batch = indices[i:i+64]
        loss = model.train_step(X_train[batch], y_train[batch])
        total_loss += loss
    
    if epoch % 10 == 0:
        preds = model.forward(X_val).argmax(axis=1)
        acc = (preds == y_val).mean()
        print(f"Epoch {epoch}: loss={total_loss:.3f}, val_acc={acc:.3f}")
```

## Results on MNIST (1000 training samples)

| Hidden dim | Epochs | Val accuracy |
|-----------|--------|-------------|
| 64 | 50 | 87.2% |
| 128 | 50 | 89.4% |
| 256 | 50 | 90.1% |

Not state-of-the-art, but respectable for pure NumPy with no augmentation or regularization.

## What I verified

- **Gradient check**: numerical gradient matches analytical gradient to 5 decimal places on a small network — backprop is correct
- **Loss decreases**: training loss consistently decreases with correct learning rates
- **Overfit test**: small network on 100 samples reaches ~100% train accuracy (as expected)

## Lessons

The softmax numerical stability issue (`x - x.max()`) trips people up. Without it, `np.exp` overflows for large logits. Adding the constant doesn't change the output mathematically but keeps the values in range.

The ReLU gradient (`z1 > 0`) is just a binary mask — zero where the pre-activation was negative, one where it was positive. Simple but easy to get wrong if you store the wrong intermediate.
