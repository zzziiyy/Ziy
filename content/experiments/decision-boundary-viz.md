---
title: "Visualizing Decision Boundaries Across Classifiers"
date: 2024-12-18
author: "ZZ"
description: "Plotting what different classifiers actually learn on 2D toy datasets — a visual intuition builder."
tags: ["classification", "visualization", "sklearn", "experiment"]
draft: false
---

**Status:** Done. Useful as an intuition reference; probably obvious to anyone who's read PRML but worth having.

## Motivation

It's easy to treat classifiers as black boxes that output a label. Plotting decision boundaries on toy data forces you to see what the model actually learned — where the boundaries are, how smooth they are, and how they respond to outliers.

## Setup

Six classifiers on three 2D datasets (moons, circles, linearly separable with noise):

```python
from sklearn.datasets import make_moons, make_circles, make_classification
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neighbors import KNeighborsClassifier
import numpy as np
import matplotlib.pyplot as plt

def plot_decision_boundary(model, X, y, ax, title):
    h = 0.02
    x_min, x_max = X[:, 0].min() - 0.5, X[:, 0].max() + 0.5
    y_min, y_max = X[:, 1].min() - 0.5, X[:, 1].max() + 0.5
    xx, yy = np.meshgrid(np.arange(x_min, x_max, h),
                          np.arange(y_min, y_max, h))
    
    Z = model.predict(np.c_[xx.ravel(), yy.ravel()])
    Z = Z.reshape(xx.shape)
    
    ax.contourf(xx, yy, Z, alpha=0.4)
    ax.scatter(X[:, 0], X[:, 1], c=y, edgecolors='k', s=20)
    ax.set_title(title)
```

## What I observed

**Logistic regression**: perfectly linear boundary. Gets moons and circles badly wrong — the data isn't linearly separable and LR can't do anything about it.

**SVM (RBF kernel)**: smooth, curved boundaries. Handles moons and circles well. Controlled by `C` (margin hardness) and `gamma` (kernel bandwidth). Sensitive to scale — normalizing inputs matters a lot.

**Decision tree**: sharp, axis-aligned boundaries. Overfits badly without pruning — you can see the boundary zigzag around individual points. With `max_depth=3`, it's clean but misses subtleties.

**Random forest**: smoother than a single tree, more flexible than SVM. Handles all three datasets well. Boundaries look "chunky" up close but generalizes well.

**Gradient boosting**: similar to random forest but often sharper boundaries. More sensitive to hyperparameters.

**KNN**: very flexible, nonparametric boundaries. With small $k$ (k=1), perfect training accuracy but jagged, overfitted boundaries. With $k=15$, smooth and reasonable. Fails on test data far from training distribution.

## The key visual lesson

Overfitting looks like a jagged boundary that contorts itself to fit every training point. Underfitting looks like a boundary that can't capture the true shape of the data. The goal is a boundary that's smooth enough to generalize but expressive enough to capture the actual pattern.

This is obvious in text. Seeing it visually on the same datasets across six classifiers makes it stick.

## Code note

The meshgrid approach is expensive for high-dimensional data — only works for visualization because we're using exactly 2 features. For anything higher-dimensional you'd need projection (PCA, t-SNE) first.
