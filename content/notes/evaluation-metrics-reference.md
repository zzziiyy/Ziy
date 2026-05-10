---
title: "Model Evaluation Metrics: A Reference"
date: 2025-01-08
author: "ZZ"
description: "Classification and regression metrics — what they measure, when they mislead, and how to compute them."
tags: ["machine learning", "evaluation", "metrics", "reference"]
draft: false
---

## Classification metrics

### Accuracy

$$\text{Accuracy} = \frac{TP + TN}{TP + TN + FP + FN}$$

Intuitive but misleading on imbalanced datasets. If 95% of samples are class 0, a model that always predicts 0 has 95% accuracy — and is useless.

### Precision and Recall

$$\text{Precision} = \frac{TP}{TP + FP}, \quad \text{Recall} = \frac{TP}{TP + FN}$$

- **Precision**: of the samples you predicted positive, how many actually were?
- **Recall**: of the actual positives, how many did you catch?

They trade off against each other. Lowering the decision threshold increases recall (catch more positives) but decreases precision (more false alarms).

### F1 Score

$$F_1 = 2 \cdot \frac{\text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$$

Harmonic mean of precision and recall. Use when you care about both equally. $F_\beta$ weights recall $\beta$ times more than precision when false negatives are more costly.

### ROC-AUC

Area under the Receiver Operating Characteristic curve. Measures the probability that a randomly chosen positive ranks higher than a randomly chosen negative. Threshold-independent. Range: 0.5 (random) to 1.0 (perfect).

**When AUC misleads**: on very imbalanced datasets, even poor models can have high AUC because true negatives dominate. Prefer Precision-Recall AUC in that case.

### Matthews Correlation Coefficient (MCC)

$$\text{MCC} = \frac{TP \cdot TN - FP \cdot FN}{\sqrt{(TP+FP)(TP+FN)(TN+FP)(TN+FN)}}$$

Range: -1 to +1. Works well on imbalanced datasets. Often underused — it's harder to interpret but more informative than accuracy or F1 in many settings.

---

## Regression metrics

### RMSE

$$\text{RMSE} = \sqrt{\frac{1}{n}\sum_i(y_i - \hat{y}_i)^2}$$

Same units as $y$. Penalizes large errors more than MAE. Most common.

### MAE

$$\text{MAE} = \frac{1}{n}\sum_i |y_i - \hat{y}_i|$$

More interpretable than RMSE ("on average, predictions are off by X units"). Less sensitive to outliers.

### R² (coefficient of determination)

$$R^2 = 1 - \frac{\sum_i(y_i - \hat{y}_i)^2}{\sum_i(y_i - \bar{y})^2}$$

Fraction of variance explained. Range: $(-\infty, 1]$. R² = 1 is perfect; R² = 0 means the model does no better than predicting the mean; R² < 0 means the model is worse than the mean.

**Pitfall**: R² can be high even if the model is biased. Always plot predicted vs. actual.

---

## Cross-validation

For small datasets, a single train/test split gives noisy estimates. K-fold CV averages over $k$ splits:

```python
from sklearn.model_selection import cross_val_score
scores = cross_val_score(model, X, y, cv=5, scoring='r2')
print(f"R² = {scores.mean():.3f} ± {scores.std():.3f}")
```

Use stratified K-fold for classification to preserve class proportions in each fold.

---

## The calibration problem

High accuracy/AUC doesn't mean well-calibrated probabilities. A model that predicts 0.9 probability should be right 90% of the time — if it's only right 60% of the time, it's overconfident.

Check calibration with a reliability diagram. Fix with temperature scaling or Platt scaling as a post-processing step.
